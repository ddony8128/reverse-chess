import { Game, FIFTY_MOVE_LIMIT_PLIES, type RuleState } from '@/engine/game';
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
 *
 * 무승부 규칙(3회 동형·50수)이 경로 의존적이므로 (기물 배치 + 차례)만으로는
 * 복원이 부족하다. halfmoveClock과 반복 카운트를 함께 저장한다.
 * 반복 카운트의 키는 Zobrist 해시(bigint)를 문자열로 직렬화한 것이다.
 * (zobristHash.ts의 시드/테이블 생성 로직을 바꾸면 저장된 해시가 어긋나므로
 *  STORAGE_VERSION을 반드시 함께 올릴 것)
 */
export type SavedSingleGame = {
  version: number;
  difficulty: DifficultyLevel;
  pieces: SerializablePiece[];
  currentPlayer: Color;
  humanColor: Color;
  boardFlipped: boolean;
  halfmoveClock: number;
  repetitionCounts: [string, number][];
  gameId: string;
  gameStartAt: number;
  savedAt: number;
};

export type SavedTwoPlayerGame = {
  version: number;
  pieces: SerializablePiece[];
  currentPlayer: Color;
  halfmoveClock: number;
  repetitionCounts: [string, number][];
  gameId: string;
  gameStartAt: number;
  savedAt: number;
};

// v1 → v2: halfmoveClock / repetitionCounts 추가. v1 저장본은 버전 검증에서 폐기된다.
const STORAGE_VERSION = 2;

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

/** 반복 카운트 엔트리([해시 문자열, 횟수]) 하나의 유효성 검증. */
function isValidRepetitionEntry(value: unknown): value is [string, number] {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const [hash, count] = value;
  if (typeof hash !== 'string') return false;
  try {
    BigInt(hash);
  } catch {
    return false;
  }
  // 이미 3회면 무승부로 끝났어야 하므로 재개 대상이 아니다
  return typeof count === 'number' && Number.isInteger(count) && count >= 1 && count <= 2;
}

/** 두 모드가 공유하는 필드 검증. */
function hasValidCommonFields(saved: Record<string, unknown>): boolean {
  return (
    saved.version === STORAGE_VERSION &&
    Array.isArray(saved.pieces) &&
    saved.pieces.length >= 2 &&
    saved.pieces.length <= 32 &&
    saved.pieces.every(isValidPiece) &&
    typeof saved.currentPlayer === 'string' &&
    VALID_COLORS.has(saved.currentPlayer) &&
    typeof saved.halfmoveClock === 'number' &&
    Number.isInteger(saved.halfmoveClock) &&
    saved.halfmoveClock >= 0 &&
    // 이미 50수 무승부면 재개 대상이 아니다
    saved.halfmoveClock < FIFTY_MOVE_LIMIT_PLIES &&
    Array.isArray(saved.repetitionCounts) &&
    saved.repetitionCounts.every(isValidRepetitionEntry) &&
    typeof saved.gameId === 'string' &&
    typeof saved.gameStartAt === 'number'
  );
}

/** 저장된 규칙 상태를 엔진용 RuleState로 복원. */
function toRuleState(saved: {
  halfmoveClock: number;
  repetitionCounts: [string, number][];
}): RuleState {
  return {
    halfmoveClock: saved.halfmoveClock,
    repetitionCounts: saved.repetitionCounts.map(([hash, count]) => [BigInt(hash), count] as const),
  };
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
function isResumablePosition(
  pieces: SerializablePiece[],
  currentPlayer: Color,
  ruleState: RuleState,
): boolean {
  const board = buildBoardFromPieces(pieces);

  // setPiece가 중복 칸을 덮어쓰므로 개수 불일치로 중복을 감지할 수 있다
  if (board.getAllPieces().length !== pieces.length) return false;

  for (const color of [Color.White, Color.Black]) {
    if (board.getAllPiecesByPieceKey(`${color}_${PieceType.King}`).length !== 1) return false;
  }

  const game = new Game(board, currentPlayer, undefined, ruleState);
  const isEnded =
    game.isOnlyKingLeft(currentPlayer) ||
    game.checkForCheckmate(currentPlayer).isInCheckmate ||
    game.isStalemate(currentPlayer) ||
    game.isLoneIsland(currentPlayer) ||
    game.isThreefoldRepetition() ||
    game.isFiftyMoveDraw();
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
    if (!isResumablePosition(parsed.pieces, parsed.currentPlayer, toRuleState(parsed))) {
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
      !isResumablePosition(parsed.pieces, parsed.currentPlayer, toRuleState(parsed))
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
