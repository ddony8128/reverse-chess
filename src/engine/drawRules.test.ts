import { describe, it, expect } from 'vitest';
import { Game, FIFTY_MOVE_LIMIT_PLIES } from './game';
import { Color, GameEndReason, PieceType } from './types';
import { buildBoard, buildGame, loc, type PieceSpec } from './testHelpers';

/**
 * 나이트 셔플용 포지션: 어느 시점에도 캡처 불가(강제 캡처 미발동),
 * 체크/외딴 섬도 발생하지 않아 순수 반복만 검증한다.
 */
const SHUFFLE_PIECES: PieceSpec[] = [
  { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
  { color: Color.White, type: PieceType.Knight, file: 'b', rank: 1 },
  { color: Color.Black, type: PieceType.King, file: 'a', rank: 8 },
  { color: Color.Black, type: PieceType.Knight, file: 'b', rank: 8 },
];

/** 나이트 왕복 1사이클(4플라이). 시작 포지션으로 되돌아온다. */
const SHUFFLE_CYCLE = [
  { color: Color.Black, from: loc('b', 8), to: loc('c', 6) },
  { color: Color.White, from: loc('b', 1), to: loc('c', 3) },
  { color: Color.Black, from: loc('c', 6), to: loc('b', 8) },
  { color: Color.White, from: loc('c', 3), to: loc('b', 1) },
] as const;

describe('3회 동형 반복 무승부', () => {
  it('시작 포지션이 세 번째로 나타나는 수에서 무승부로 끝난다', () => {
    const game = buildGame(SHUFFLE_PIECES, Color.Black);
    const plies = [...SHUFFLE_CYCLE, ...SHUFFLE_CYCLE];

    // 시작(1회) → 1사이클 후(2회)까지: 아직 끝나지 않는다
    for (const move of plies.slice(0, 7)) {
      const result = game.progressTurn(move.color, move.from, move.to);
      expect(result.success).toBe(true);
      expect(result.end).toBe(false);
    }

    // 8번째 플라이: 시작 포지션 3회째 등장 → 무승부
    const last = plies[7];
    const result = game.progressTurn(last.color, last.from, last.to);
    expect(result.success).toBe(true);
    expect(result.end).toBe(true);
    expect(result.winner).toBeNull();
    expect(result.endReason).toBe(GameEndReason.ThreefoldRepetition);
    expect(game.getWinner()).toBeNull();
    expect(game.getEndReason()).toBe(GameEndReason.ThreefoldRepetition);
  });

  it('무승부 이후에는 수를 둘 수 없다', () => {
    const game = buildGame(SHUFFLE_PIECES, Color.Black);
    for (const move of [...SHUFFLE_CYCLE, ...SHUFFLE_CYCLE]) {
      game.progressTurn(move.color, move.from, move.to);
    }
    const result = game.progressTurn(Color.Black, loc('b', 8), loc('c', 6));
    expect(result.success).toBe(false);
  });

  it('시작 포지션도 1회로 계산된다', () => {
    const game = buildGame(SHUFFLE_PIECES, Color.Black);
    expect(game.getRepetitionCounts()).toContainEqual([game.getBoardHash(), 1]);
  });

  it('repetitionCounts가 빈 배열이거나 현재 포지션이 누락돼도 현재 포지션은 1회로 자가 보정된다', () => {
    const emptySeeded = new Game(buildBoard(SHUFFLE_PIECES), Color.Black, undefined, {
      halfmoveClock: 0,
      repetitionCounts: [],
    });
    expect(emptySeeded.getRepetitionCounts()).toContainEqual([emptySeeded.getBoardHash(), 1]);

    const missingCurrent = new Game(buildBoard(SHUFFLE_PIECES), Color.Black, undefined, {
      halfmoveClock: 0,
      repetitionCounts: [[123456789n, 2]],
    });
    expect(missingCurrent.getRepetitionCounts()).toContainEqual([missingCurrent.getBoardHash(), 1]);
  });

  it('캡처(비가역 수)는 반복 카운트를 현재 포지션만 남기고 비운다', () => {
    const pieces: PieceSpec[] = [
      { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
      { color: Color.White, type: PieceType.Knight, file: 'c', rank: 3 },
      { color: Color.Black, type: PieceType.Pawn, file: 'd', rank: 5 },
      { color: Color.Black, type: PieceType.Rook, file: 'h', rank: 8 },
      { color: Color.Black, type: PieceType.King, file: 'a', rank: 8 },
    ];
    const game = buildGame(pieces, Color.White);
    const result = game.progressTurn(Color.White, loc('c', 3), loc('d', 5)); // 강제 캡처
    expect(result.success).toBe(true);
    expect(game.getRepetitionCounts()).toEqual([[game.getBoardHash(), 1]]);
  });
});

describe('50수 규칙 무승부', () => {
  const QUIET_PIECES: PieceSpec[] = [
    { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
    { color: Color.White, type: PieceType.Rook, file: 'h', rank: 1 },
    { color: Color.Black, type: PieceType.King, file: 'a', rank: 8 },
    { color: Color.Black, type: PieceType.Rook, file: 'g', rank: 8 },
  ];

  it('조용한 수로 100플라이에 도달하면 무승부', () => {
    const game = new Game(buildBoard(QUIET_PIECES), Color.White, undefined, {
      halfmoveClock: FIFTY_MOVE_LIMIT_PLIES - 1,
    });
    game.startGame();
    const result = game.progressTurn(Color.White, loc('h', 1), loc('h', 2));
    expect(result.end).toBe(true);
    expect(result.winner).toBeNull();
    expect(result.endReason).toBe(GameEndReason.FiftyMoveRule);
  });

  it('아직 100플라이 미만이면 끝나지 않고 클럭이 증가한다', () => {
    const game = new Game(buildBoard(QUIET_PIECES), Color.White, undefined, {
      halfmoveClock: FIFTY_MOVE_LIMIT_PLIES - 2,
    });
    game.startGame();
    const result = game.progressTurn(Color.White, loc('h', 1), loc('h', 2));
    expect(result.end).toBe(false);
    expect(game.getHalfmoveClock()).toBe(FIFTY_MOVE_LIMIT_PLIES - 1);
  });

  it('캡처는 클럭을 0으로 리셋한다', () => {
    const pieces: PieceSpec[] = [
      { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
      { color: Color.White, type: PieceType.Knight, file: 'c', rank: 3 },
      { color: Color.Black, type: PieceType.Pawn, file: 'd', rank: 5 },
      { color: Color.Black, type: PieceType.Rook, file: 'h', rank: 8 },
      { color: Color.Black, type: PieceType.King, file: 'a', rank: 8 },
    ];
    const game = new Game(buildBoard(pieces), Color.White, undefined, {
      halfmoveClock: FIFTY_MOVE_LIMIT_PLIES - 1,
    });
    game.startGame();
    // 나이트 캡처는 항상 강제 캡처
    const result = game.progressTurn(Color.White, loc('c', 3), loc('d', 5));
    expect(result.end).toBe(false);
    expect(game.getHalfmoveClock()).toBe(0);
  });

  it('폰 이동은 클럭을 0으로 리셋한다', () => {
    const pieces: PieceSpec[] = [
      { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
      { color: Color.White, type: PieceType.Pawn, file: 'e', rank: 2 },
      { color: Color.Black, type: PieceType.King, file: 'a', rank: 8 },
      { color: Color.Black, type: PieceType.Rook, file: 'h', rank: 8 },
    ];
    const game = new Game(buildBoard(pieces), Color.White, undefined, {
      halfmoveClock: FIFTY_MOVE_LIMIT_PLIES - 1,
    });
    game.startGame();
    const result = game.progressTurn(Color.White, loc('e', 2), loc('e', 3));
    expect(result.end).toBe(false);
    expect(game.getHalfmoveClock()).toBe(0);
  });

  it('같은 수로 체크메이트와 100플라이가 동시 성립하면 체크메이트가 우선한다', () => {
    // Ra1-a8: 조용한 수이면서 흑 백랭크 메이트.
    // 리버스 체스에서는 메이트당한(합법수 없는) 흑이 승자.
    const pieces: PieceSpec[] = [
      { color: Color.White, type: PieceType.King, file: 'b', rank: 1 },
      { color: Color.White, type: PieceType.Rook, file: 'a', rank: 1 },
      { color: Color.Black, type: PieceType.King, file: 'h', rank: 8 },
      { color: Color.Black, type: PieceType.Pawn, file: 'g', rank: 7 },
      { color: Color.Black, type: PieceType.Pawn, file: 'h', rank: 7 },
    ];
    const game = new Game(buildBoard(pieces), Color.White, undefined, {
      halfmoveClock: FIFTY_MOVE_LIMIT_PLIES - 1,
    });
    game.startGame();
    const result = game.progressTurn(Color.White, loc('a', 1), loc('a', 8));
    expect(result.end).toBe(true);
    expect(result.endReason).toBe(GameEndReason.Checkmate);
    expect(result.winner).toBe(Color.Black);
  });
});

describe('규칙 상태 격리 (탐색/probe가 오염시키지 않음)', () => {
  it('applyMoveForSearch/rollbackMoveForSearch는 클럭과 카운트를 건드리지 않는다', () => {
    const game = buildGame(SHUFFLE_PIECES, Color.Black);
    const counts0 = [...game.getRepetitionCounts()].sort();
    const clock0 = game.getHalfmoveClock();

    for (const move of SHUFFLE_CYCLE) {
      game.applyMoveForSearch({ from: move.from, to: move.to, promotion: null });
    }
    for (let i = 0; i < SHUFFLE_CYCLE.length; i++) game.rollbackMoveForSearch();

    expect([...game.getRepetitionCounts()].sort()).toEqual(counts0);
    expect(game.getHalfmoveClock()).toBe(clock0);
  });

  it('합법수 생성(체크 필터링 probe)도 규칙 상태를 건드리지 않는다', () => {
    const game = buildGame(SHUFFLE_PIECES, Color.Black);
    const counts0 = [...game.getRepetitionCounts()].sort();
    game.getLegalMoves(Color.Black); // 내부에서 applyMove/rollbackMove 다수 호출
    expect([...game.getRepetitionCounts()].sort()).toEqual(counts0);
    expect(game.getHalfmoveClock()).toBe(0);
  });
});
