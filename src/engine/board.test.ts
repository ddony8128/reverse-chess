import { describe, it, expect } from 'vitest';
import { Board } from './board';
import { Color, PieceType, Rank } from './types';
import { buildBoard, loc } from './testHelpers';
import type { Location } from './types';

function locationKeys(locations: Location[]): string[] {
  return locations.map((l) => `${l.file}${l.rank}`).sort();
}

describe('Board 초기 배치', () => {
  it('32개 기물, 색상별 16개', () => {
    const board = new Board();
    expect(board.getAllPieces()).toHaveLength(32);
    expect(board.getAllPieces(Color.White)).toHaveLength(16);
    expect(board.getAllPieces(Color.Black)).toHaveLength(16);
  });

  it('주요 기물 위치: 백 K/Q는 e1/d1, 흑 K/Q는 d8/e8 (미러 배치)', () => {
    const board = new Board();
    expect(board.getPieceByLocation(loc('a', 1))).toMatchObject({
      color: Color.White,
      type: PieceType.Rook,
    });
    expect(board.getPieceByLocation(loc('d', 1))).toMatchObject({
      color: Color.White,
      type: PieceType.Queen,
    });
    expect(board.getPieceByLocation(loc('e', 1))).toMatchObject({
      color: Color.White,
      type: PieceType.King,
    });
    expect(board.getPieceByLocation(loc('d', 8))).toMatchObject({
      color: Color.Black,
      type: PieceType.King,
    });
    expect(board.getPieceByLocation(loc('e', 8))).toMatchObject({
      color: Color.Black,
      type: PieceType.Queen,
    });
    expect(board.getPieceByLocation(loc('c', 2))).toMatchObject({
      color: Color.White,
      type: PieceType.Pawn,
    });
    expect(board.getPieceByLocation(loc('f', 7))).toMatchObject({
      color: Color.Black,
      type: PieceType.Pawn,
    });
    expect(board.getPieceByLocation(loc('e', 4))).toBeNull();
  });

  it('킹 버킷 조회가 동작한다', () => {
    const board = new Board();
    const whiteKings = board.getAllPiecesByPieceKey(`${Color.White}_${PieceType.King}`);
    expect(whiteKings).toHaveLength(1);
    expect(whiteKings[0].location).toEqual(loc('e', 1));
  });
});

describe('폰 이동 생성', () => {
  it('시작 랭크의 백 폰: 1칸 + 2칸', () => {
    const board = new Board();
    const pawn = board.getPieceByLocation(loc('e', 2))!;
    expect(locationKeys(board.getMovableLocations(pawn))).toEqual(['e3', 'e4']);
  });

  it('시작 랭크의 흑 폰: 아래로 1칸 + 2칸', () => {
    const board = new Board();
    const pawn = board.getPieceByLocation(loc('d', 7))!;
    expect(locationKeys(board.getMovableLocations(pawn))).toEqual(['d5', 'd6']);
  });

  it('시작 랭크가 아니면 1칸만 (hasMoved 플래그 없이 랭크로만 판정)', () => {
    const board = buildBoard([{ color: Color.White, type: PieceType.Pawn, file: 'e', rank: 3 }]);
    const pawn = board.getPieceByLocation(loc('e', 3))!;
    expect(locationKeys(board.getMovableLocations(pawn))).toEqual(['e4']);
  });

  it('앞이 막히면 전진 불가 (2칸도 함께 막힘)', () => {
    const board = buildBoard([
      { color: Color.White, type: PieceType.Pawn, file: 'e', rank: 2 },
      { color: Color.Black, type: PieceType.Pawn, file: 'e', rank: 3 },
    ]);
    const pawn = board.getPieceByLocation(loc('e', 2))!;
    expect(locationKeys(board.getMovableLocations(pawn))).toEqual([]);
  });

  it('2칸째만 막히면 1칸만 가능', () => {
    const board = buildBoard([
      { color: Color.White, type: PieceType.Pawn, file: 'e', rank: 2 },
      { color: Color.Black, type: PieceType.Rook, file: 'e', rank: 4 },
    ]);
    const pawn = board.getPieceByLocation(loc('e', 2))!;
    expect(locationKeys(board.getMovableLocations(pawn))).toEqual(['e3']);
  });

  it('대각선 캡처 (전진 방향으로만)', () => {
    const board = buildBoard([
      { color: Color.White, type: PieceType.Pawn, file: 'e', rank: 4 },
      { color: Color.Black, type: PieceType.Pawn, file: 'd', rank: 5 },
      { color: Color.Black, type: PieceType.Pawn, file: 'f', rank: 5 },
      { color: Color.Black, type: PieceType.Pawn, file: 'e', rank: 5 },
    ]);
    const pawn = board.getPieceByLocation(loc('e', 4))!;
    // 전진(e5)은 막혔고 d5/f5 캡처만
    expect(locationKeys(board.getMovableLocations(pawn))).toEqual(['d5', 'f5']);
  });

  it('아군 기물은 캡처 불가', () => {
    const board = buildBoard([
      { color: Color.White, type: PieceType.Pawn, file: 'e', rank: 4 },
      { color: Color.White, type: PieceType.Pawn, file: 'd', rank: 5 },
    ]);
    const pawn = board.getPieceByLocation(loc('e', 4))!;
    expect(locationKeys(board.getMovableLocations(pawn))).toEqual(['e5']);
  });
});

describe('나이트/슬라이딩/킹 이동 생성', () => {
  it('초기 나이트 b1: a3, c3', () => {
    const board = new Board();
    const knight = board.getPieceByLocation(loc('b', 1))!;
    expect(locationKeys(board.getMovableLocations(knight))).toEqual(['a3', 'c3']);
  });

  it('룩: 아군 앞에서 멈추고, 적군 칸은 포함 후 멈춤', () => {
    const board = buildBoard([
      { color: Color.White, type: PieceType.Rook, file: 'd', rank: 4 },
      { color: Color.White, type: PieceType.Pawn, file: 'd', rank: 6 },
      { color: Color.Black, type: PieceType.Pawn, file: 'f', rank: 4 },
    ]);
    const rook = board.getPieceByLocation(loc('d', 4))!;
    expect(locationKeys(board.getMovableLocations(rook))).toEqual(
      ['d5', 'd3', 'd2', 'd1', 'c4', 'b4', 'a4', 'e4', 'f4'].sort(),
    );
  });

  it('초기 비숍 c1: 폰에 막혀 이동 불가', () => {
    const board = new Board();
    const bishop = board.getPieceByLocation(loc('c', 1))!;
    expect(board.getMovableLocations(bishop)).toHaveLength(0);
  });

  it('빈 보드 중앙 퀸 d4: 27칸', () => {
    const board = buildBoard([{ color: Color.White, type: PieceType.Queen, file: 'd', rank: 4 }]);
    const queen = board.getPieceByLocation(loc('d', 4))!;
    expect(board.getMovableLocations(queen)).toHaveLength(27);
  });

  it('킹: 중앙 8칸, 코너 3칸', () => {
    const center = buildBoard([{ color: Color.White, type: PieceType.King, file: 'e', rank: 4 }]);
    expect(center.getMovableLocations(center.getPieceByLocation(loc('e', 4))!)).toHaveLength(8);

    const corner = buildBoard([{ color: Color.White, type: PieceType.King, file: 'a', rank: 1 }]);
    expect(
      locationKeys(corner.getMovableLocations(corner.getPieceByLocation(loc('a', 1))!)),
    ).toEqual(['a2', 'b1', 'b2']);
  });
});

describe('movePiece / setPiece / changePieceType', () => {
  it('movePiece는 캡처된 기물을 반환하고 보드를 갱신한다', () => {
    const board = buildBoard([
      { color: Color.White, type: PieceType.Rook, file: 'a', rank: 1 },
      { color: Color.Black, type: PieceType.Pawn, file: 'a', rank: 7 },
    ]);
    const rook = board.getPieceByLocation(loc('a', 1))!;
    const captured = board.movePiece(rook, loc('a', 7));

    expect(captured).toMatchObject({ color: Color.Black, type: PieceType.Pawn });
    expect(captured!.location).toBeUndefined();
    expect(board.getPieceByLocation(loc('a', 1))).toBeNull();
    expect(board.getPieceByLocation(loc('a', 7))).toBe(rook);
    expect(board.getAllPieces()).toHaveLength(1);
  });

  it('빈 칸으로 이동하면 null 반환', () => {
    const board = buildBoard([{ color: Color.White, type: PieceType.Rook, file: 'a', rank: 1 }]);
    const rook = board.getPieceByLocation(loc('a', 1))!;
    expect(board.movePiece(rook, loc('a', 5))).toBeNull();
  });

  it('changePieceType은 타입을 바꾼다 (프로모션)', () => {
    const board = buildBoard([{ color: Color.White, type: PieceType.Pawn, file: 'a', rank: 8 }]);
    const pawn = board.getPieceByLocation(loc('a', 8))!;
    board.changePieceType(pawn, PieceType.Queen);
    expect(board.getPieceByLocation(loc('a', 8))!.type).toBe(PieceType.Queen);
  });
});

describe('canPieceAttackLocation / isLocationAttacked', () => {
  it('폰은 대각선만 공격 (전진 칸은 공격 아님, 빈 칸도 공격 대상)', () => {
    const board = buildBoard([{ color: Color.White, type: PieceType.Pawn, file: 'e', rank: 4 }]);
    const pawn = board.getPieceByLocation(loc('e', 4))!;
    expect(board.canPieceAttackLocation(pawn, loc('d', 5))).toBe(true);
    expect(board.canPieceAttackLocation(pawn, loc('f', 5))).toBe(true);
    expect(board.canPieceAttackLocation(pawn, loc('e', 5))).toBe(false);
    expect(board.canPieceAttackLocation(pawn, loc('d', 3))).toBe(false);
  });

  it('슬라이딩 기물의 공격은 중간 기물에 막힌다', () => {
    const board = buildBoard([
      { color: Color.White, type: PieceType.Rook, file: 'a', rank: 1 },
      { color: Color.White, type: PieceType.Pawn, file: 'a', rank: 3 },
    ]);
    const rook = board.getPieceByLocation(loc('a', 1))!;
    expect(board.canPieceAttackLocation(rook, loc('a', 2))).toBe(true);
    expect(board.canPieceAttackLocation(rook, loc('a', 3))).toBe(true);
    expect(board.canPieceAttackLocation(rook, loc('a', 4))).toBe(false);
  });

  it('isLocationAttacked: 색상별 공격 판정', () => {
    const board = buildBoard([
      { color: Color.Black, type: PieceType.Queen, file: 'c', rank: 2 },
      { color: Color.White, type: PieceType.King, file: 'a', rank: 1 },
    ]);
    expect(board.isLocationAttacked(loc('b', 1), Color.Black)).toBe(true);
    expect(board.isLocationAttacked(loc('a', 2), Color.Black)).toBe(true);
    expect(board.isLocationAttacked(loc('a', 1), Color.Black)).toBe(false);
    expect(board.isLocationAttacked(loc('b', 1), Color.White)).toBe(true);
  });
});

describe('Rank enum 정합성', () => {
  it('Rank 값은 숫자 리터럴', () => {
    expect(Rank.Rank1).toBe(1);
    expect(Rank.Rank8).toBe(8);
  });
});
