import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { Board } from './board';
import { Color, File, Rank, PieceType, type Location, type Piece, GameEndReason } from './types';

const ALL_FILES = Object.values(File) as File[];
const ALL_RANKS = Object.values(Rank) as Rank[];

function loc(file: File, rank: Rank): Location {
  return { file, rank };
}

function emptyBoard(): Board {
  const board = new Board();

  for (const file of ALL_FILES) {
    for (const rank of ALL_RANKS) {
      board.setPiece(loc(file, rank), null);
    }
  }

  return board;
}

function setupGame(
  pieces: Array<{ color: Color; type: PieceType; file: File; rank: Rank }>,
  currentPlayer: Color,
) {
  const board = emptyBoard();

  for (const { color, type, file, rank } of pieces) {
    const location = loc(file, rank);
    const piece: Piece = { color, type, location };
    board.setPiece(location, piece);
  }

  const game = new Game(board);
  (game as any).currentPlayer = currentPlayer;

  return { game, board };
}

describe('Game basic', () => {
  it('startGame sets state to InPlay', () => {
    const board = new Board();
    const game = new Game(board);

    const result = game.startGame();

    expect(result.success).toBe(true);
  });
});

describe('Game end conditions', () => {
  it('ends with Checkmate (reverse-chess: checkmated side wins)', () => {
    const { game } = setupGame(
      [
        { color: Color.Black, type: PieceType.Rook, file: File.A, rank: Rank.Rank1 },
        { color: Color.Black, type: PieceType.Rook, file: File.G, rank: Rank.Rank8 },
        { color: Color.Black, type: PieceType.King, file: File.C, rank: Rank.Rank6 },
        { color: Color.White, type: PieceType.Knight, file: File.G, rank: Rank.Rank1 },
        { color: Color.White, type: PieceType.Knight, file: File.H, rank: Rank.Rank2 },
        { color: Color.White, type: PieceType.King, file: File.H, rank: Rank.Rank1 },
      ],
      Color.Black,
    );

    const from = loc(File.A, Rank.Rank1);
    const to = loc(File.G, Rank.Rank1);

    const result = game.progressTurn(Color.Black, from, to);

    expect(result.success).toBe(true);
    expect(result.end).toBe(true);
    expect(result.winner).toBe(Color.White);
    expect(result.endReason).toBe(GameEndReason.Checkmate);
  });

  it('ends with Stalemate (draw, winner = null)', () => {
    const { game } = setupGame(
      [
        { color: Color.Black, type: PieceType.Pawn, file: File.B, rank: Rank.Rank7 },
        { color: Color.Black, type: PieceType.Rook, file: File.A, rank: Rank.Rank2 },
        { color: Color.Black, type: PieceType.Rook, file: File.G, rank: Rank.Rank8 },
        { color: Color.Black, type: PieceType.King, file: File.D, rank: Rank.Rank6 },
        { color: Color.White, type: PieceType.Pawn, file: File.B, rank: Rank.Rank5 },
        { color: Color.White, type: PieceType.King, file: File.H, rank: Rank.Rank1 },
      ],
      Color.Black,
    );

    const from = loc(File.B, Rank.Rank7);
    const to = loc(File.B, Rank.Rank6);

    const result = game.progressTurn(Color.Black, from, to);

    expect(result.success).toBe(true);
    expect(result.end).toBe(true);
    expect(result.winner).toBeNull();
    expect(result.endReason).toBe(GameEndReason.Stalemate);
  });

  it('ends with LoneIsland when opponent only has non-capturing king moves', () => {
    const { game } = setupGame(
      [
        { color: Color.Black, type: PieceType.Pawn, file: File.C, rank: Rank.Rank5 },
        { color: Color.Black, type: PieceType.King, file: File.C, rank: Rank.Rank6 },
        { color: Color.White, type: PieceType.Pawn, file: File.C, rank: Rank.Rank3 },
        { color: Color.White, type: PieceType.King, file: File.C, rank: Rank.Rank2 },
      ],
      Color.Black,
    );

    const from = loc(File.C, Rank.Rank5);
    const to = loc(File.C, Rank.Rank4);

    const result = game.progressTurn(Color.Black, from, to);

    expect(result.success).toBe(true);
    expect(result.end).toBe(true);
    expect(result.winner).toBe(Color.White);
    expect(result.endReason).toBe(GameEndReason.LoneIsland);
  });

  it('ends with OnlyKingLeft when opponent has only king left', () => {
    const { game } = setupGame(
      [
        { color: Color.Black, type: PieceType.Pawn, file: File.C, rank: Rank.Rank5 },
        { color: Color.Black, type: PieceType.King, file: File.C, rank: Rank.Rank6 },
        { color: Color.White, type: PieceType.Pawn, file: File.D, rank: Rank.Rank4 },
        { color: Color.White, type: PieceType.King, file: File.C, rank: Rank.Rank2 },
      ],
      Color.Black,
    );

    const from = loc(File.C, Rank.Rank5);
    const to = loc(File.D, Rank.Rank4);

    const result = game.progressTurn(Color.Black, from, to);

    expect(result.success).toBe(true);
    expect(result.end).toBe(true);
    expect(result.winner).toBe(Color.White);
    expect(result.endReason).toBe(GameEndReason.OnlyKingLeft);
  });
});
