import { describe, it, expect } from 'vitest';
import { Board } from '@/engine/board';
import { Color, PieceType } from '@/engine/types';
import { buildBoard, loc } from '@/engine/testHelpers';
import { computeZobristHash, toggleSideToMove, updateHashForMove } from './zobristHash';

describe('computeZobristHash', () => {
  it('같은 보드는 항상 같은 해시 (결정적)', () => {
    const b1 = new Board();
    const b2 = new Board();
    expect(computeZobristHash(b1, Color.White)).toBe(computeZobristHash(b2, Color.White));
  });

  it('배치가 다르면 해시가 다르다', () => {
    const b1 = new Board();
    const b2 = new Board();
    const pawn = b2.getPieceByLocation(loc('e', 2))!;
    b2.movePiece(pawn, loc('e', 4));
    expect(computeZobristHash(b1, Color.White)).not.toBe(computeZobristHash(b2, Color.White));
  });

  it('toggleSideToMove는 두 번 적용하면 원래 값 (인볼루션)', () => {
    const hash = computeZobristHash(new Board(), Color.White);
    expect(toggleSideToMove(toggleSideToMove(hash))).toBe(hash);
    expect(toggleSideToMove(hash)).toBe(computeZobristHash(new Board(), Color.Black));
  });
});

describe('updateHashForMove (증분 갱신)', () => {
  it('조용한 수: 증분 갱신 결과가 전체 재계산과 일치한다', () => {
    const board = new Board();
    const before = computeZobristHash(board, Color.White);

    const pawn = board.getPieceByLocation(loc('e', 2))!;
    board.movePiece(pawn, loc('e', 3));
    const after = computeZobristHash(board, Color.White);

    const incremental = updateHashForMove(before, {
      from: loc('e', 2),
      to: loc('e', 3),
      pieceColor: Color.White,
      pieceTypeBefore: PieceType.Pawn,
      pieceTypeAfter: PieceType.Pawn,
    });
    expect(incremental).toBe(after);

    const undone = updateHashForMove(
      after,
      {
        from: loc('e', 2),
        to: loc('e', 3),
        pieceColor: Color.White,
        pieceTypeBefore: PieceType.Pawn,
        pieceTypeAfter: PieceType.Pawn,
      },
      true,
    );
    expect(undone).toBe(before);
  });

  it('캡처 수: 증분 갱신 결과가 전체 재계산과 일치한다', () => {
    const board = buildBoard([
      { color: Color.White, type: PieceType.Rook, file: 'a', rank: 1 },
      { color: Color.Black, type: PieceType.Pawn, file: 'a', rank: 7 },
    ]);
    const before = computeZobristHash(board, Color.White);

    const rook = board.getPieceByLocation(loc('a', 1))!;
    board.movePiece(rook, loc('a', 7));
    const after = computeZobristHash(board, Color.White);

    const incremental = updateHashForMove(before, {
      from: loc('a', 1),
      to: loc('a', 7),
      pieceColor: Color.White,
      pieceTypeBefore: PieceType.Rook,
      pieceTypeAfter: PieceType.Rook,
      capturedPieceColor: Color.Black,
      capturedPieceType: PieceType.Pawn,
    });
    expect(incremental).toBe(after);
  });

  it('프로모션 수: 타입 변화가 해시에 반영된다', () => {
    const board = buildBoard([{ color: Color.White, type: PieceType.Pawn, file: 'a', rank: 7 }]);
    const before = computeZobristHash(board, Color.White);

    const pawn = board.getPieceByLocation(loc('a', 7))!;
    board.movePiece(pawn, loc('a', 8));
    board.changePieceType(pawn, PieceType.Queen);
    const after = computeZobristHash(board, Color.White);

    const incremental = updateHashForMove(before, {
      from: loc('a', 7),
      to: loc('a', 8),
      pieceColor: Color.White,
      pieceTypeBefore: PieceType.Pawn,
      pieceTypeAfter: PieceType.Queen,
    });
    expect(incremental).toBe(after);
  });
});
