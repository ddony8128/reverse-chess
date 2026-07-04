import { describe, it, expect } from 'vitest';
import { Board } from './board';
import { Game } from './game';
import { createAIPlayer } from './aiPlayer';
import { Color, PieceType, difficultyLevel } from './types';
import { buildBoard, boardSnapshot, moveKey, moveKeys, serializePieces } from './testHelpers';

// AI 탐색은 실제 시간 제한(easy 1초)을 사용하므로 테스트 타임아웃을 넉넉히 잡는다.
const AI_TIMEOUT = 30000;

describe('AIPlayer (easy)', () => {
  it(
    '초기 포지션: 흑의 합법수 중 하나를 반환하고, 탐색 후 보드가 원상복구된다',
    async () => {
      const game = new Game();
      game.startGame();
      const board = game.getBoard();
      const snapshotBefore = boardSnapshot(board);

      const ai = createAIPlayer(difficultyLevel.Easy);
      const move = await ai.getNextMove(board, Color.Black, false);

      expect(move).toBeDefined();
      expect(moveKeys(game.getLegalMoves(Color.Black))).toContain(moveKey(move!));
      expect(boardSnapshot(board)).toBe(snapshotBefore);
    },
    AI_TIMEOUT,
  );

  it(
    '강제 캡처 단일 수 포지션: 그 수를 반환한다',
    async () => {
      const board = buildBoard([
        { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Queen, file: 'd', rank: 1 },
        { color: Color.Black, type: PieceType.Pawn, file: 'd', rank: 3 },
        { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
      ]);
      const ai = createAIPlayer(difficultyLevel.Easy);
      const move = await ai.getNextMove(board, Color.White, false);

      expect(move).toBeDefined();
      expect(moveKey(move!)).toBe('d1d3');
    },
    AI_TIMEOUT,
  );

  it(
    '이미 종료된 포지션(외톨이 킹)에서는 undefined를 반환한다',
    async () => {
      const board = buildBoard([
        { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
        { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
      ]);
      const ai = createAIPlayer(difficultyLevel.Easy);
      const move = await ai.getNextMove(board, Color.White, false);
      expect(move).toBeUndefined();
    },
    AI_TIMEOUT,
  );

  it(
    '직렬화 왕복으로 재조립한 중반 포지션에서도 합법수를 반환한다 (복원 게임 시나리오)',
    async () => {
      const original = buildBoard([
        { color: Color.White, type: PieceType.King, file: 'e', rank: 1 },
        { color: Color.White, type: PieceType.Rook, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Bishop, file: 'c', rank: 4 },
        { color: Color.White, type: PieceType.Pawn, file: 'e', rank: 4 },
        { color: Color.White, type: PieceType.Pawn, file: 'g', rank: 2 },
        { color: Color.Black, type: PieceType.King, file: 'e', rank: 8 },
        { color: Color.Black, type: PieceType.Knight, file: 'c', rank: 6 },
        { color: Color.Black, type: PieceType.Rook, file: 'h', rank: 8 },
        { color: Color.Black, type: PieceType.Pawn, file: 'd', rank: 6 },
        { color: Color.Black, type: PieceType.Pawn, file: 'f', rank: 7 },
      ]);
      // 저장 → 복원 경로와 동일하게 기물 목록으로 재조립
      const rebuilt = buildBoard(serializePieces(original));
      const refGame = new Game(rebuilt, Color.Black);
      refGame.startGame();
      const legalKeys = moveKeys(refGame.getLegalMoves(Color.Black));

      const ai = createAIPlayer(difficultyLevel.Easy);
      const move = await ai.getNextMove(rebuilt, Color.Black, false);

      expect(move).toBeDefined();
      expect(legalKeys).toContain(moveKey(move!));
    },
    AI_TIMEOUT,
  );

  it(
    'warmUp 호출은 undefined를 반환한다',
    async () => {
      const board = buildBoard([
        { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Queen, file: 'd', rank: 1 },
        { color: Color.Black, type: PieceType.Pawn, file: 'd', rank: 3 },
        { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
      ]);
      const ai = createAIPlayer(difficultyLevel.Easy);
      const move = await ai.getNextMove(board, Color.White, true);
      expect(move).toBeUndefined();
    },
    AI_TIMEOUT,
  );

  it(
    'easy: 턴이 시간 예산(1초)을 크게 넘기지 않는다',
    async () => {
      const ai = createAIPlayer(difficultyLevel.Easy);
      const start = Date.now();
      const move = await ai.getNextMove(new Board(), Color.Black, false);
      const elapsed = Date.now() - start;

      expect(move).toBeDefined();
      // 예산 1초 + 마감 후 되감기/오버헤드 여유. 마감 초과 회귀를 잡기 위한 상한.
      expect(elapsed).toBeLessThan(4000);
    },
    AI_TIMEOUT,
  );

  it(
    'hard: 턴이 시간 예산(10초)을 크게 넘기지 않는다',
    async () => {
      const ai = createAIPlayer(difficultyLevel.Hard);
      const start = Date.now();
      const move = await ai.getNextMove(new Board(), Color.Black, false);
      const elapsed = Date.now() - start;

      expect(move).toBeDefined();
      expect(elapsed).toBeLessThan(13000);
    },
    AI_TIMEOUT,
  );

  it(
    '탐색 후 TT에는 객체 참조 없이 압축 정수만 저장된다',
    async () => {
      const board = buildBoard([
        { color: Color.White, type: PieceType.King, file: 'e', rank: 1 },
        { color: Color.White, type: PieceType.Rook, file: 'a', rank: 1 },
        { color: Color.Black, type: PieceType.King, file: 'e', rank: 8 },
        { color: Color.Black, type: PieceType.Pawn, file: 'd', rank: 6 },
        { color: Color.Black, type: PieceType.Pawn, file: 'f', rank: 7 },
      ]);
      const ai = createAIPlayer(difficultyLevel.Easy);
      await ai.getNextMove(board, Color.White, false);

      // 내부 TT 구조를 들여다봐서 무브가 전부 number인지 확인 (piece 참조 누수 방지 회귀 테스트)
      const tt = (
        ai as unknown as {
          tt: { entries: Map<bigint, { entry: Record<string, unknown> }> };
        }
      ).tt;
      expect(tt.entries.size).toBeGreaterThan(0);

      for (const { entry } of tt.entries.values()) {
        for (const field of ['legalMoves', 'orderedMovesTop', 'orderedMovesBottom'] as const) {
          const value = entry[field];
          if (value === undefined) continue;
          for (const code of value as unknown[]) {
            expect(typeof code).toBe('number');
          }
        }
        for (const field of ['onlyMove', 'bestMove'] as const) {
          const value = entry[field];
          if (value !== undefined) expect(typeof value).toBe('number');
        }
      }
    },
    AI_TIMEOUT,
  );

  it(
    'AI가 두는 수는 몇 수를 이어가도 매번 progressTurn을 통과한다 (AI vs AI 4수)',
    async () => {
      const game = new Game();
      game.startGame();
      const ai = createAIPlayer(difficultyLevel.Easy);

      for (let ply = 0; ply < 4; ply++) {
        const color = game.getCurrentPlayer();
        const move = await ai.getNextMove(game.getBoard(), color, false);
        expect(move).toBeDefined();

        const result = game.progressTurn(color, move!.from, move!.to, move!.promotion ?? undefined);
        expect(result.success).toBe(true);
        if (result.end) break;
      }
    },
    60000,
  );
});
