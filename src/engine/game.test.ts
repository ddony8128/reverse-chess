import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { Color, GameEndReason, GameError, PieceType } from './types';
import { computeZobristHash } from '@/lib/zobristHash';
import {
  buildBoard,
  buildGame,
  boardSnapshot,
  loc,
  moveKey,
  moveKeys,
  serializePieces,
} from './testHelpers';

describe('게임 시작과 턴 진행 규칙', () => {
  it('기본 게임은 흑이 선공', () => {
    const game = new Game();
    expect(game.getCurrentPlayer()).toBe(Color.Black);
  });

  it('startGame 전에는 수를 둘 수 없다', () => {
    const game = new Game();
    const result = game.progressTurn(Color.Black, loc('b', 7), loc('b', 6));
    expect(result.success).toBe(false);
    expect(result.error).toBe(GameError.GameNotStarted);
  });

  it('차례가 아니면 NotYourTurn', () => {
    const game = new Game();
    game.startGame();
    const result = game.progressTurn(Color.White, loc('b', 2), loc('b', 3));
    expect(result.success).toBe(false);
    expect(result.error).toBe(GameError.NotYourTurn);
  });

  it('규칙에 없는 수는 InvalidMove', () => {
    const game = new Game();
    game.startGame();
    const result = game.progressTurn(Color.Black, loc('b', 7), loc('b', 4));
    expect(result.success).toBe(false);
    expect(result.error).toBe(GameError.InvalidMove);
  });

  it('정상 수는 성공하고 차례가 넘어간다', () => {
    const game = new Game();
    game.startGame();
    const result = game.progressTurn(Color.Black, loc('b', 7), loc('b', 5));
    expect(result.success).toBe(true);
    expect(result.end).toBe(false);
    expect(game.getCurrentPlayer()).toBe(Color.White);
    expect(game.getBoard().getPieceByLocation(loc('b', 5))).toMatchObject({
      color: Color.Black,
      type: PieceType.Pawn,
    });
    expect(game.getBoard().getPieceByLocation(loc('b', 7))).toBeNull();
  });
});

describe('합법수 생성: 초기 포지션', () => {
  it('흑 첫 수는 20개 (폰 16 + 나이트 4), 강제 캡처 없음', () => {
    const game = new Game();
    game.startGame();
    const moves = game.getLegalMoves(Color.Black);
    expect(moves).toHaveLength(20);
    expect(game.isCaptureForced()).toBe(false);
    const keys = moveKeys(moves);
    expect(keys).toContain('b7b5');
    expect(keys).toContain('b8c6');
    expect(keys).toContain('g8h6');
  });
});

describe('강제 캡처 규칙', () => {
  it('퀸이 아닌 기물의 캡처는 항상 강제 (나이트)', () => {
    const game = buildGame(
      [
        { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Knight, file: 'c', rank: 3 },
        { color: Color.Black, type: PieceType.Pawn, file: 'd', rank: 5 },
        { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
      ],
      Color.White,
    );
    expect(game.isCaptureForced()).toBe(true);
    expect(moveKeys(game.getLegalMoves(Color.White))).toEqual(['c3d5']);
  });

  it('퀸 캡처는 거리 2 이내면 강제', () => {
    const game = buildGame(
      [
        { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Queen, file: 'd', rank: 1 },
        { color: Color.Black, type: PieceType.Pawn, file: 'd', rank: 3 },
        { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
      ],
      Color.White,
    );
    expect(game.isCaptureForced()).toBe(true);
    expect(moveKeys(game.getLegalMoves(Color.White))).toEqual(['d1d3']);
  });

  it('퀸 캡처가 거리 3 이상이면 강제가 아니고, 조용한 수와 함께 선택 가능', () => {
    const game = buildGame(
      [
        { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Queen, file: 'd', rank: 1 },
        { color: Color.Black, type: PieceType.Pawn, file: 'd', rank: 5 },
        { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
      ],
      Color.White,
    );
    expect(game.isCaptureForced()).toBe(false);
    const keys = moveKeys(game.getLegalMoves(Color.White));
    expect(keys).toContain('d1d5'); // 원거리 퀸 캡처 (선택)
    expect(keys).toContain('a1b2'); // 조용한 킹 수
    expect(keys).toContain('d1d2'); // 조용한 퀸 수
  });

  it('강제 캡처가 자기 킹을 체크에 노출하면 제외되고, 남은 강제 캡처만 합법수가 된다', () => {
    // Ra3xh3은 a파일을 열어 Qa5의 체크에 노출 → 제외. Ra3xa5만 남음.
    const game = buildGame(
      [
        { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Rook, file: 'a', rank: 3 },
        { color: Color.Black, type: PieceType.Queen, file: 'a', rank: 5 },
        { color: Color.Black, type: PieceType.Pawn, file: 'h', rank: 3 },
        { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
      ],
      Color.White,
    );
    expect(game.isCaptureForced()).toBe(true);
    expect(moveKeys(game.getLegalMoves(Color.White))).toEqual(['a3a5']);
  });
});

describe('프로모션', () => {
  it('조용한 프로모션: 4가지 기물 선택지가 각각의 수로 생성된다', () => {
    const game = buildGame(
      [
        { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Pawn, file: 'a', rank: 7 },
        { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
        { color: Color.Black, type: PieceType.Pawn, file: 'h', rank: 5 },
      ],
      Color.White,
    );
    const keys = moveKeys(game.getLegalMoves(Color.White));
    expect(keys).toEqual(
      ['a7a8queen', 'a7a8rook', 'a7a8bishop', 'a7a8knight', 'a1a2', 'a1b1', 'a1b2'].sort(),
    );

    const result = game.progressTurn(Color.White, loc('a', 7), loc('a', 8), PieceType.Queen);
    expect(result.success).toBe(true);
    expect(result.end).toBe(false);
    expect(game.getBoard().getPieceByLocation(loc('a', 8))).toMatchObject({
      color: Color.White,
      type: PieceType.Queen,
    });
  });

  it('프로모션 지정 없이 프로모션 칸으로 두면 InvalidMove', () => {
    const game = buildGame(
      [
        { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Pawn, file: 'a', rank: 7 },
        { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
        { color: Color.Black, type: PieceType.Pawn, file: 'h', rank: 5 },
      ],
      Color.White,
    );
    const result = game.progressTurn(Color.White, loc('a', 7), loc('a', 8));
    expect(result.success).toBe(false);
    expect(result.error).toBe(GameError.InvalidMove);
  });

  it('캡처 프로모션은 강제 캡처라서 조용한 프로모션을 배제한다', () => {
    const game = buildGame(
      [
        { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Pawn, file: 'a', rank: 7 },
        { color: Color.Black, type: PieceType.Rook, file: 'b', rank: 8 },
        { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
        { color: Color.Black, type: PieceType.Pawn, file: 'h', rank: 5 },
      ],
      Color.White,
    );
    expect(game.isCaptureForced()).toBe(true);
    expect(moveKeys(game.getLegalMoves(Color.White))).toEqual(
      ['a7b8queen', 'a7b8rook', 'a7b8bishop', 'a7b8knight'].sort(),
    );

    const result = game.progressTurn(Color.White, loc('a', 7), loc('b', 8), PieceType.Knight);
    expect(result.success).toBe(true);
    expect(game.getBoard().getPieceByLocation(loc('b', 8))).toMatchObject({
      color: Color.White,
      type: PieceType.Knight,
    });
  });
});

describe('종료 조건 (리버스 룰: 당하는 쪽이 이긴다)', () => {
  it('체크메이트를 당한 쪽이 승리한다', () => {
    // 흑 Re2-e1# → 백 킹 a1 체크메이트 → 백 승리
    const game = buildGame(
      [
        { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Pawn, file: 'h', rank: 4 },
        { color: Color.Black, type: PieceType.King, file: 'b', rank: 3 },
        { color: Color.Black, type: PieceType.Rook, file: 'e', rank: 2 },
        { color: Color.Black, type: PieceType.Pawn, file: 'h', rank: 5 },
      ],
      Color.Black,
    );
    const result = game.progressTurn(Color.Black, loc('e', 2), loc('e', 1));
    expect(result.success).toBe(true);
    expect(result.end).toBe(true);
    expect(result.endReason).toBe(GameEndReason.Checkmate);
    expect(result.winner).toBe(Color.White);
    expect(game.getWinner()).toBe(Color.White);
  });

  it('스테일메이트는 무승부', () => {
    // 흑 Qc4-c2 → 백은 체크가 아니지만 둘 수 있는 수가 없음
    const game = buildGame(
      [
        { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Pawn, file: 'h', rank: 4 },
        { color: Color.Black, type: PieceType.Queen, file: 'c', rank: 4 },
        { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
        { color: Color.Black, type: PieceType.Pawn, file: 'h', rank: 5 },
      ],
      Color.Black,
    );
    const result = game.progressTurn(Color.Black, loc('c', 4), loc('c', 2));
    expect(result.success).toBe(true);
    expect(result.end).toBe(true);
    expect(result.endReason).toBe(GameEndReason.Stalemate);
    expect(result.winner).toBeNull();
  });

  it('LoneIsland: 캡처 없는 킹 수만 남은 쪽이 승리', () => {
    const game = buildGame(
      [
        { color: Color.White, type: PieceType.King, file: 'e', rank: 4 },
        { color: Color.White, type: PieceType.Pawn, file: 'h', rank: 4 },
        { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
        { color: Color.Black, type: PieceType.Pawn, file: 'h', rank: 5 },
      ],
      Color.Black,
    );
    const result = game.progressTurn(Color.Black, loc('h', 8), loc('g', 8));
    expect(result.success).toBe(true);
    expect(result.end).toBe(true);
    expect(result.endReason).toBe(GameEndReason.LoneIsland);
    expect(result.winner).toBe(Color.White);
  });

  it('OnlyKingLeft: 킹만 남은 쪽이 승리', () => {
    const game = buildGame(
      [
        { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Knight, file: 'b', rank: 3 },
        { color: Color.Black, type: PieceType.Rook, file: 'b', rank: 8 },
        { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
      ],
      Color.Black,
    );
    // 룩의 나이트 캡처는 강제
    expect(moveKeys(game.getLegalMoves(Color.Black))).toEqual(['b8b3']);
    const result = game.progressTurn(Color.Black, loc('b', 8), loc('b', 3));
    expect(result.success).toBe(true);
    expect(result.end).toBe(true);
    expect(result.endReason).toBe(GameEndReason.OnlyKingLeft);
    expect(result.winner).toBe(Color.White);
  });

  it('게임 종료 후의 수는 GameFinished', () => {
    const game = buildGame(
      [
        { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Knight, file: 'b', rank: 3 },
        { color: Color.Black, type: PieceType.Rook, file: 'b', rank: 8 },
        { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
      ],
      Color.Black,
    );
    game.progressTurn(Color.Black, loc('b', 8), loc('b', 3));
    const result = game.progressTurn(Color.White, loc('a', 1), loc('a', 2));
    expect(result.success).toBe(false);
    expect(result.error).toBe(GameError.GameFinished);
  });
});

describe('탐색용 apply/rollback 불변식', () => {
  it('여러 수를 적용 후 롤백하면 보드/해시/차례가 완전히 복원된다', () => {
    const game = new Game();
    const snapshotBefore = boardSnapshot(game.getBoard());
    const hashBefore = game.getBoardHash();
    const playerBefore = game.getCurrentPlayer();

    game.applyMoveForSearch({ from: loc('b', 7), to: loc('b', 6), promotion: null });
    game.applyMoveForSearch({ from: loc('a', 2), to: loc('a', 3), promotion: null });
    game.applyMoveForSearch({ from: loc('b', 8), to: loc('c', 6), promotion: null });

    expect(boardSnapshot(game.getBoard())).not.toBe(snapshotBefore);

    game.rollbackMoveForSearch();
    game.rollbackMoveForSearch();
    game.rollbackMoveForSearch();

    expect(boardSnapshot(game.getBoard())).toBe(snapshotBefore);
    expect(game.getBoardHash()).toBe(hashBefore);
    expect(game.getCurrentPlayer()).toBe(playerBefore);
  });

  it('캡처 수의 롤백은 캡처된 기물을 복원한다', () => {
    const game = buildGame(
      [
        { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Knight, file: 'c', rank: 3 },
        { color: Color.Black, type: PieceType.Pawn, file: 'd', rank: 5 },
        { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
      ],
      Color.White,
    );
    const snapshotBefore = boardSnapshot(game.getBoard());
    const hashBefore = game.getBoardHash();

    game.applyMoveForSearch({ from: loc('c', 3), to: loc('d', 5), promotion: null });
    expect(game.getBoard().getAllPieces()).toHaveLength(3);

    game.rollbackMoveForSearch();
    expect(boardSnapshot(game.getBoard())).toBe(snapshotBefore);
    expect(game.getBoardHash()).toBe(hashBefore);
  });

  it('프로모션 수의 롤백은 폰으로 복원한다', () => {
    const game = buildGame(
      [
        { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Pawn, file: 'a', rank: 7 },
        { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
        { color: Color.Black, type: PieceType.Pawn, file: 'h', rank: 5 },
      ],
      Color.White,
    );
    const snapshotBefore = boardSnapshot(game.getBoard());
    const hashBefore = game.getBoardHash();

    game.applyMoveForSearch({ from: loc('a', 7), to: loc('a', 8), promotion: PieceType.Queen });
    expect(game.getBoard().getPieceByLocation(loc('a', 8))!.type).toBe(PieceType.Queen);

    game.rollbackMoveForSearch();
    expect(boardSnapshot(game.getBoard())).toBe(snapshotBefore);
    expect(game.getBoardHash()).toBe(hashBefore);
    expect(game.getBoard().getPieceByLocation(loc('a', 7))!.type).toBe(PieceType.Pawn);
  });
});

describe('Zobrist 해시 일관성', () => {
  it('getBoardHash는 항상 전체 재계산 값과 일치한다', () => {
    const game = new Game();
    game.startGame();
    expect(game.getBoardHash()).toBe(computeZobristHash(game.getBoard(), game.getCurrentPlayer()));

    game.progressTurn(Color.Black, loc('b', 7), loc('b', 5));
    expect(game.getBoardHash()).toBe(computeZobristHash(game.getBoard(), game.getCurrentPlayer()));
  });

  it('다른 수순으로 같은 포지션에 도달하면 해시가 같다 (트랜스포지션)', () => {
    const g1 = new Game();
    g1.applyMoveForSearch({ from: loc('b', 7), to: loc('b', 6), promotion: null });
    g1.applyMoveForSearch({ from: loc('a', 2), to: loc('a', 3), promotion: null });
    g1.applyMoveForSearch({ from: loc('g', 7), to: loc('g', 6), promotion: null });

    const g2 = new Game();
    g2.applyMoveForSearch({ from: loc('g', 7), to: loc('g', 6), promotion: null });
    g2.applyMoveForSearch({ from: loc('a', 2), to: loc('a', 3), promotion: null });
    g2.applyMoveForSearch({ from: loc('b', 7), to: loc('b', 6), promotion: null });

    expect(g1.getBoardHash()).toBe(g2.getBoardHash());
    expect(boardSnapshot(g1.getBoard())).toBe(boardSnapshot(g2.getBoard()));
  });

  it('같은 배치라도 차례가 다르면 해시가 다르다', () => {
    const board1 = new Game().getBoard();
    expect(computeZobristHash(board1, Color.White)).not.toBe(
      computeZobristHash(board1, Color.Black),
    );
  });
});

describe('직렬화 왕복 (저장/복원 및 워커 전송 경로)', () => {
  it('기물 목록 → 보드 재조립 후 배치/해시/합법수가 동일하다', () => {
    const original = new Game();
    original.startGame();
    original.progressTurn(Color.Black, loc('b', 7), loc('b', 5));
    original.progressTurn(Color.White, loc('e', 2), loc('e', 4));

    const rebuiltBoard = buildBoard(serializePieces(original.getBoard()));
    const rebuilt = new Game(rebuiltBoard, original.getCurrentPlayer());
    rebuilt.startGame();

    expect(boardSnapshot(rebuilt.getBoard())).toBe(boardSnapshot(original.getBoard()));
    expect(rebuilt.getBoardHash()).toBe(original.getBoardHash());
    expect(moveKeys(rebuilt.getLegalMoves(rebuilt.getCurrentPlayer()))).toEqual(
      moveKeys(original.getLegalMoves(original.getCurrentPlayer())),
    );
  });

  it('중반 포지션에서 재개된 게임도 정상 진행된다', () => {
    const game = buildGame(
      [
        { color: Color.White, type: PieceType.King, file: 'e', rank: 1 },
        { color: Color.White, type: PieceType.Rook, file: 'a', rank: 1 },
        { color: Color.White, type: PieceType.Pawn, file: 'e', rank: 4 },
        { color: Color.Black, type: PieceType.King, file: 'e', rank: 8 },
        { color: Color.Black, type: PieceType.Knight, file: 'c', rank: 6 },
        { color: Color.Black, type: PieceType.Pawn, file: 'd', rank: 6 },
      ],
      Color.Black,
    );
    const moves = game.getLegalMoves(Color.Black);
    expect(moves.length).toBeGreaterThan(0);
    const first = moves[0];
    const result = game.progressTurn(
      Color.Black,
      first.from,
      first.to,
      first.promotion ?? undefined,
    );
    expect(result.success).toBe(true);
    expect(game.getCurrentPlayer()).toBe(Color.White);
  });
});

describe('탐색 캐시 상한', () => {
  it('캐시 크기가 상한을 넘지 않고, 비워져도 합법수 결과는 동일하다', () => {
    const limit = 5;
    const game = new Game(undefined, undefined, limit);

    // 여러 포지션을 방문하며 캐시를 상한 이상으로 채운다
    const visited: string[] = [];
    for (let ply = 0; ply < 12; ply++) {
      const color = game.getCurrentPlayer();
      const moves = game.getLegalMoves(color);
      expect(game.getSearchCacheSize()).toBeLessThanOrEqual(limit);
      visited.push(moveKeys(moves).join(','));
      game.applyMoveForSearch({ from: moves[0].from, to: moves[0].to, promotion: null });
    }

    // 롤백하며 같은 포지션을 다시 질의 → 캐시가 비워졌더라도 같은 결과
    for (let ply = 11; ply >= 0; ply--) {
      game.rollbackMoveForSearch();
      const color = game.getCurrentPlayer();
      expect(moveKeys(game.getLegalMoves(color)).join(',')).toBe(visited[ply]);
      expect(game.getSearchCacheSize()).toBeLessThanOrEqual(limit);
    }
  });

  it('기본 상한은 MAX_CACHED_POSITIONS', () => {
    expect(Game.MAX_CACHED_POSITIONS).toBeGreaterThan(0);
    const game = new Game();
    game.startGame();
    game.getLegalMoves(game.getCurrentPlayer());
    expect(game.getSearchCacheSize()).toBeGreaterThan(0);
  });
});

describe('moveKey 헬퍼 자체 검증', () => {
  it('프로모션 유무를 구분한다', () => {
    expect(moveKey({ from: loc('a', 7), to: loc('a', 8), promotion: PieceType.Queen })).toBe(
      'a7a8queen',
    );
    expect(moveKey({ from: loc('a', 7), to: loc('a', 8), promotion: null })).toBe('a7a8');
  });
});
