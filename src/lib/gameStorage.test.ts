import { describe, it, expect } from 'vitest';
import { Game } from '@/engine/game';
import { buildBoardFromPieces, serializeBoard } from '@/engine/boardUtils';
import { Color, PieceType, difficultyLevel } from '@/engine/types';
import { boardSnapshot, loc, moveKeys } from '@/engine/testHelpers';
import { computeZobristHash } from './zobristHash';
import {
  saveSingleGame,
  loadSingleGame,
  clearSingleGame,
  saveTwoPlayerGame,
  loadTwoPlayerGame,
  clearTwoPlayerGame,
  type SavedSingleGame,
  type SavedTwoPlayerGame,
} from './gameStorage';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, String(value)),
  };
}

function midGameState(): Omit<SavedSingleGame, 'version' | 'savedAt'> {
  const game = new Game();
  game.startGame();
  game.progressTurn(Color.Black, loc('b', 7), loc('b', 5));
  game.progressTurn(Color.White, loc('e', 2), loc('e', 4));

  return {
    difficulty: difficultyLevel.Easy,
    pieces: serializeBoard(game.getBoard()),
    currentPlayer: game.getCurrentPlayer(),
    humanColor: Color.Black,
    boardFlipped: false,
    halfmoveClock: game.getHalfmoveClock(),
    repetitionCounts: game.getRepetitionCounts().map(([hash, count]) => [hash.toString(), count]),
    gameId: 'test-game-id',
    gameStartAt: 1700000000000,
  };
}

describe('gameStorage 저장/복원', () => {
  it('저장 → 복원 왕복: 보드/차례/메타데이터가 보존된다', () => {
    const storage = createMemoryStorage();
    const state = midGameState();
    saveSingleGame(state, storage);

    const loaded = loadSingleGame(difficultyLevel.Easy, storage);
    expect(loaded).not.toBeNull();
    expect(loaded!.currentPlayer).toBe(state.currentPlayer);
    expect(loaded!.humanColor).toBe(Color.Black);
    expect(loaded!.gameId).toBe('test-game-id');
    expect(loaded!.gameStartAt).toBe(1700000000000);
    expect(loaded!.savedAt).toBeGreaterThan(0);

    // 복원한 보드가 원본과 완전히 같은 포지션인지 (해시/합법수까지)
    const originalBoard = buildBoardFromPieces(state.pieces);
    const restoredBoard = buildBoardFromPieces(loaded!.pieces);
    expect(boardSnapshot(restoredBoard)).toBe(boardSnapshot(originalBoard));
    expect(computeZobristHash(restoredBoard, loaded!.currentPlayer)).toBe(
      computeZobristHash(originalBoard, state.currentPlayer),
    );

    const restoredGame = new Game(restoredBoard, loaded!.currentPlayer);
    restoredGame.startGame();
    const originalGame = new Game(originalBoard, state.currentPlayer);
    originalGame.startGame();
    expect(moveKeys(restoredGame.getLegalMoves(loaded!.currentPlayer))).toEqual(
      moveKeys(originalGame.getLegalMoves(state.currentPlayer)),
    );
  });

  it('난이도별로 따로 저장된다', () => {
    const storage = createMemoryStorage();
    saveSingleGame(midGameState(), storage);
    expect(loadSingleGame(difficultyLevel.Hard, storage)).toBeNull();
    expect(loadSingleGame(difficultyLevel.Easy, storage)).not.toBeNull();
  });

  it('저장이 없으면 null', () => {
    expect(loadSingleGame(difficultyLevel.Easy, createMemoryStorage())).toBeNull();
  });

  it('clearSingleGame 후에는 null', () => {
    const storage = createMemoryStorage();
    saveSingleGame(midGameState(), storage);
    clearSingleGame(difficultyLevel.Easy, storage);
    expect(loadSingleGame(difficultyLevel.Easy, storage)).toBeNull();
  });

  it('손상된 JSON은 null을 반환하고 엔트리를 지운다', () => {
    const storage = createMemoryStorage();
    storage.setItem('reverse-chess:saved-game:single:easy', '{not valid json');
    expect(loadSingleGame(difficultyLevel.Easy, storage)).toBeNull();
    expect(storage.getItem('reverse-chess:saved-game:single:easy')).toBeNull();
  });

  it('버전이 다르면 무효 처리한다', () => {
    const storage = createMemoryStorage();
    const state = midGameState();
    saveSingleGame(state, storage);
    const raw = JSON.parse(storage.getItem('reverse-chess:saved-game:single:easy')!);
    raw.version = 999;
    storage.setItem('reverse-chess:saved-game:single:easy', JSON.stringify(raw));
    expect(loadSingleGame(difficultyLevel.Easy, storage)).toBeNull();
  });

  it('킹이 없는 포지션은 무효 처리한다', () => {
    const storage = createMemoryStorage();
    const state = midGameState();
    state.pieces = state.pieces.filter(
      (p) => !(p.color === Color.White && p.type === PieceType.King),
    );
    saveSingleGame(state, storage);
    expect(loadSingleGame(difficultyLevel.Easy, storage)).toBeNull();
  });

  it('중복 칸이 있는 포지션은 무효 처리한다', () => {
    const storage = createMemoryStorage();
    const state = midGameState();
    state.pieces = [...state.pieces, { ...state.pieces[0] }];
    saveSingleGame(state, storage);
    expect(loadSingleGame(difficultyLevel.Easy, storage)).toBeNull();
  });

  it('이미 끝난 포지션(킹만 남음)은 무효 처리한다', () => {
    const storage = createMemoryStorage();
    const state = midGameState();
    state.pieces = [
      { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
      { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
    ];
    state.currentPlayer = Color.White;
    saveSingleGame(state, storage);
    expect(loadSingleGame(difficultyLevel.Easy, storage)).toBeNull();
  });

  it('기물 필드가 오염된 경우 무효 처리한다', () => {
    const storage = createMemoryStorage();
    const state = midGameState();
    saveSingleGame(state, storage);
    const raw = JSON.parse(storage.getItem('reverse-chess:saved-game:single:easy')!);
    raw.pieces[0].file = 'z';
    storage.setItem('reverse-chess:saved-game:single:easy', JSON.stringify(raw));
    expect(loadSingleGame(difficultyLevel.Easy, storage)).toBeNull();
  });

  it('halfmoveClock과 반복 카운트가 저장 → 복원 왕복된다', () => {
    const storage = createMemoryStorage();
    const state = midGameState();
    state.halfmoveClock = 42;
    state.repetitionCounts = [['12345678901234567890', 2]];
    saveSingleGame(state, storage);

    const loaded = loadSingleGame(difficultyLevel.Easy, storage);
    expect(loaded).not.toBeNull();
    expect(loaded!.halfmoveClock).toBe(42);
    expect(loaded!.repetitionCounts).toEqual([['12345678901234567890', 2]]);
  });

  it('클럭이 이미 100 이상(50수 무승부)인 저장본은 무효 처리한다', () => {
    const storage = createMemoryStorage();
    const state = midGameState();
    state.halfmoveClock = 100;
    saveSingleGame(state, storage);
    expect(loadSingleGame(difficultyLevel.Easy, storage)).toBeNull();
  });

  it('반복 카운트가 3 이상(이미 무승부)인 저장본은 무효 처리한다', () => {
    const storage = createMemoryStorage();
    const state = midGameState();
    state.repetitionCounts = [['123', 3]];
    saveSingleGame(state, storage);
    expect(loadSingleGame(difficultyLevel.Easy, storage)).toBeNull();
  });

  it('반복 카운트 해시가 BigInt로 파싱 불가능하면 무효 처리한다', () => {
    const storage = createMemoryStorage();
    const state = midGameState();
    state.repetitionCounts = [['not-a-hash', 1]];
    saveSingleGame(state, storage);
    expect(loadSingleGame(difficultyLevel.Easy, storage)).toBeNull();
  });

  it('storage가 null이면 조용히 무시된다 (SSR/접근 불가 환경)', () => {
    expect(() => saveSingleGame(midGameState(), null)).not.toThrow();
    expect(loadSingleGame(difficultyLevel.Easy, null)).toBeNull();
    expect(() => clearSingleGame(difficultyLevel.Easy, null)).not.toThrow();
  });

  it('setItem이 throw해도 (쿼터 초과) saveSingleGame은 throw하지 않는다', () => {
    const storage = createMemoryStorage();
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => saveSingleGame(midGameState(), storage)).not.toThrow();
  });
});

function midTwoPlayerState(): Omit<SavedTwoPlayerGame, 'version' | 'savedAt'> {
  const game = new Game();
  game.startGame();
  game.progressTurn(Color.Black, loc('g', 7), loc('g', 5));
  game.progressTurn(Color.White, loc('d', 2), loc('d', 4));

  return {
    pieces: serializeBoard(game.getBoard()),
    currentPlayer: game.getCurrentPlayer(),
    halfmoveClock: game.getHalfmoveClock(),
    repetitionCounts: game.getRepetitionCounts().map(([hash, count]) => [hash.toString(), count]),
    gameId: 'two-player-game-id',
    gameStartAt: 1700000000000,
  };
}

describe('gameStorage 2인 플레이 저장/복원', () => {
  it('저장 → 복원 왕복: 보드/차례/메타데이터가 보존된다', () => {
    const storage = createMemoryStorage();
    const state = midTwoPlayerState();
    saveTwoPlayerGame(state, storage);

    const loaded = loadTwoPlayerGame(storage);
    expect(loaded).not.toBeNull();
    expect(loaded!.currentPlayer).toBe(state.currentPlayer);
    expect(loaded!.gameId).toBe('two-player-game-id');
    expect(loaded!.gameStartAt).toBe(1700000000000);

    const originalBoard = buildBoardFromPieces(state.pieces);
    const restoredBoard = buildBoardFromPieces(loaded!.pieces);
    expect(boardSnapshot(restoredBoard)).toBe(boardSnapshot(originalBoard));
    expect(computeZobristHash(restoredBoard, loaded!.currentPlayer)).toBe(
      computeZobristHash(originalBoard, state.currentPlayer),
    );

    const restoredGame = new Game(restoredBoard, loaded!.currentPlayer);
    restoredGame.startGame();
    const originalGame = new Game(originalBoard, state.currentPlayer);
    originalGame.startGame();
    expect(moveKeys(restoredGame.getLegalMoves(loaded!.currentPlayer))).toEqual(
      moveKeys(originalGame.getLegalMoves(state.currentPlayer)),
    );
  });

  it('싱글플레이 저장과 키가 분리되어 서로 간섭하지 않는다', () => {
    const storage = createMemoryStorage();
    saveSingleGame(midGameState(), storage);
    expect(loadTwoPlayerGame(storage)).toBeNull();

    saveTwoPlayerGame(midTwoPlayerState(), storage);
    expect(loadSingleGame(difficultyLevel.Easy, storage)).not.toBeNull();
    expect(loadTwoPlayerGame(storage)).not.toBeNull();

    clearTwoPlayerGame(storage);
    expect(loadTwoPlayerGame(storage)).toBeNull();
    expect(loadSingleGame(difficultyLevel.Easy, storage)).not.toBeNull();
  });

  it('저장이 없으면 null', () => {
    expect(loadTwoPlayerGame(createMemoryStorage())).toBeNull();
  });

  it('손상된 JSON은 null을 반환하고 엔트리를 지운다', () => {
    const storage = createMemoryStorage();
    storage.setItem('reverse-chess:saved-game:two', '{broken');
    expect(loadTwoPlayerGame(storage)).toBeNull();
    expect(storage.getItem('reverse-chess:saved-game:two')).toBeNull();
  });

  it('버전이 다르면 무효 처리한다', () => {
    const storage = createMemoryStorage();
    saveTwoPlayerGame(midTwoPlayerState(), storage);
    const raw = JSON.parse(storage.getItem('reverse-chess:saved-game:two')!);
    raw.version = 999;
    storage.setItem('reverse-chess:saved-game:two', JSON.stringify(raw));
    expect(loadTwoPlayerGame(storage)).toBeNull();
  });

  it('킹이 없는 포지션은 무효 처리한다', () => {
    const storage = createMemoryStorage();
    const state = midTwoPlayerState();
    state.pieces = state.pieces.filter(
      (p) => !(p.color === Color.Black && p.type === PieceType.King),
    );
    saveTwoPlayerGame(state, storage);
    expect(loadTwoPlayerGame(storage)).toBeNull();
  });

  it('이미 끝난 포지션(킹만 남음)은 무효 처리한다', () => {
    const storage = createMemoryStorage();
    const state = midTwoPlayerState();
    state.pieces = [
      { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
      { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
    ];
    state.currentPlayer = Color.White;
    saveTwoPlayerGame(state, storage);
    expect(loadTwoPlayerGame(storage)).toBeNull();
  });

  it('storage가 null이면 조용히 무시된다', () => {
    expect(() => saveTwoPlayerGame(midTwoPlayerState(), null)).not.toThrow();
    expect(loadTwoPlayerGame(null)).toBeNull();
    expect(() => clearTwoPlayerGame(null)).not.toThrow();
  });
});
