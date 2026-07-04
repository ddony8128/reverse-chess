import { Game } from '@/engine/game';
import { buildBoardFromPieces } from '@/engine/boardUtils';
import {
  Color,
  PieceType,
  File,
  Rank,
  difficultyLevel,
  type DifficultyLevel,
} from '@/engine/types';
import type { SerializablePiece } from '@/types/workerMessage';

/**
 * 진행 중인 게임(싱글/2인)의 localStorage 저장/복원.
 *
 * 모바일 브라우저(특히 iOS Safari)는 메모리 압박 시 탭을 강제 리로드하므로,
 * 매 수마다 게임 상태를 저장해 두고 리로드 후 이어서 플레이할 수 있게 한다.
 * 엔진은 매 수마다 (기물 배치 + 차례)만으로 동작하므로 이 두 가지면 복원에 충분하다.
 * (캐슬링/앙파상/반복수 규칙이 없어 히스토리가 필요 없음)
 */
export type SavedSingleGame = {
  version: number;
  difficulty: DifficultyLevel;
  pieces: SerializablePiece[];
  currentPlayer: Color;
  humanColor: Color;
  boardFlipped: boolean;
  gameId: string;
  gameStartAt: number;
  savedAt: number;
};

export type SavedTwoPlayerGame = {
  version: number;
  pieces: SerializablePiece[];
  currentPlayer: Color;
  gameId: string;
  gameStartAt: number;
  savedAt: number;
};

const STORAGE_VERSION = 1;

const VALID_COLORS = new Set<string>(Object.values(Color));
const VALID_TYPES = new Set<string>(Object.values(PieceType));
const VALID_FILES = new Set<string>(Object.values(File));
const VALID_RANKS = new Set<number>(Object.values(Rank));

function storageKey(difficulty: DifficultyLevel): string {
  return `reverse-chess:saved-game:single:${difficulty === difficultyLevel.Hard ? 'hard' : 'easy'}`;
}

const TWO_PLAYER_STORAGE_KEY = 'reverse-chess:saved-game:two';

function getDefaultStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    // 일부 브라우저 설정(사생활 보호 모드 등)에서는 접근 자체가 throw할 수 있다
    return null;
  }
}

export function saveSingleGame(
  state: Omit<SavedSingleGame, 'version' | 'savedAt'>,
  storage: Storage | null = getDefaultStorage(),
): void {
  if (!storage) return;
  const payload: SavedSingleGame = {
    ...state,
    version: STORAGE_VERSION,
    savedAt: Date.now(),
  };
  try {
    storage.setItem(storageKey(state.difficulty), JSON.stringify(payload));
  } catch {
    // 저장 실패(쿼터 초과 등)는 치명적이지 않다 — 이어하기만 못 할 뿐
  }
}

export function clearSingleGame(
  difficulty: DifficultyLevel,
  storage: Storage | null = getDefaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(storageKey(difficulty));
  } catch {
    // 무시
  }
}

function isValidPiece(value: unknown): value is SerializablePiece {
  if (typeof value !== 'object' || value === null) return false;
  const piece = value as Record<string, unknown>;
  return (
    typeof piece.color === 'string' &&
    VALID_COLORS.has(piece.color) &&
    typeof piece.type === 'string' &&
    VALID_TYPES.has(piece.type) &&
    typeof piece.file === 'string' &&
    VALID_FILES.has(piece.file) &&
    typeof piece.rank === 'number' &&
    VALID_RANKS.has(piece.rank as number)
  );
}

/** 두 모드가 공유하는 필드(version/pieces/currentPlayer/gameId/gameStartAt) 검증. */
function hasValidCommonFields(saved: Record<string, unknown>): boolean {
  return (
    saved.version === STORAGE_VERSION &&
    Array.isArray(saved.pieces) &&
    saved.pieces.length >= 2 &&
    saved.pieces.length <= 32 &&
    saved.pieces.every(isValidPiece) &&
    typeof saved.currentPlayer === 'string' &&
    VALID_COLORS.has(saved.currentPlayer) &&
    typeof saved.gameId === 'string' &&
    typeof saved.gameStartAt === 'number'
  );
}

function isStructurallyValid(value: unknown): value is SavedSingleGame {
  if (typeof value !== 'object' || value === null) return false;
  const saved = value as Record<string, unknown>;
  return (
    hasValidCommonFields(saved) &&
    (saved.difficulty === difficultyLevel.Easy || saved.difficulty === difficultyLevel.Hard) &&
    typeof saved.humanColor === 'string' &&
    VALID_COLORS.has(saved.humanColor) &&
    typeof saved.boardFlipped === 'boolean'
  );
}

function isStructurallyValidTwoPlayer(value: unknown): value is SavedTwoPlayerGame {
  if (typeof value !== 'object' || value === null) return false;
  return hasValidCommonFields(value as Record<string, unknown>);
}

/**
 * 재개 가능한 포지션인지 엔진으로 확인한다:
 * 색상별 킹 정확히 1개, 중복 칸 없음, 게임이 이미 끝난 상태가 아닐 것.
 */
function isResumablePosition(pieces: SerializablePiece[], currentPlayer: Color): boolean {
  const board = buildBoardFromPieces(pieces);

  // setPiece가 중복 칸을 덮어쓰므로 개수 불일치로 중복을 감지할 수 있다
  if (board.getAllPieces().length !== pieces.length) return false;

  for (const color of [Color.White, Color.Black]) {
    if (board.getAllPiecesByPieceKey(`${color}_${PieceType.King}`).length !== 1) return false;
  }

  const game = new Game(board, currentPlayer);
  const isEnded =
    game.isOnlyKingLeft(currentPlayer) ||
    game.checkForCheckmate(currentPlayer).isInCheckmate ||
    game.isStalemate(currentPlayer) ||
    game.isLoneIsland(currentPlayer);
  return !isEnded;
}

/**
 * 저장된 게임을 불러온다. 손상됐거나 재개 불가능한 데이터는 지우고 null을 반환한다.
 */
export function loadSingleGame(
  difficulty: DifficultyLevel,
  storage: Storage | null = getDefaultStorage(),
): SavedSingleGame | null {
  if (!storage) return null;

  const key = storageKey(difficulty);
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isStructurallyValid(parsed) || parsed.difficulty !== difficulty) {
      storage.removeItem(key);
      return null;
    }
    if (!isResumablePosition(parsed.pieces, parsed.currentPlayer)) {
      storage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // 무시
    }
    return null;
  }
}

export function saveTwoPlayerGame(
  state: Omit<SavedTwoPlayerGame, 'version' | 'savedAt'>,
  storage: Storage | null = getDefaultStorage(),
): void {
  if (!storage) return;
  const payload: SavedTwoPlayerGame = {
    ...state,
    version: STORAGE_VERSION,
    savedAt: Date.now(),
  };
  try {
    storage.setItem(TWO_PLAYER_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 저장 실패(쿼터 초과 등)는 치명적이지 않다 — 이어하기만 못 할 뿐
  }
}

export function clearTwoPlayerGame(storage: Storage | null = getDefaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(TWO_PLAYER_STORAGE_KEY);
  } catch {
    // 무시
  }
}

/**
 * 저장된 2인 플레이 게임을 불러온다. 손상됐거나 재개 불가능한 데이터는 지우고 null을 반환한다.
 */
export function loadTwoPlayerGame(
  storage: Storage | null = getDefaultStorage(),
): SavedTwoPlayerGame | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(TWO_PLAYER_STORAGE_KEY);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      !isStructurallyValidTwoPlayer(parsed) ||
      !isResumablePosition(parsed.pieces, parsed.currentPlayer)
    ) {
      storage.removeItem(TWO_PLAYER_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      storage.removeItem(TWO_PLAYER_STORAGE_KEY);
    } catch {
      // 무시
    }
    return null;
  }
}
