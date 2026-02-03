import { Board } from './board';
import { File, Rank, type Piece } from './types';
import type { Location } from './types';

export function createEmptyBoard(): Board {
  const board = new Board();

  const files = Object.values(File) as File[];
  const ranks = Object.values(Rank) as Rank[];

  for (const file of files) {
    for (const rank of ranks) {
      const location: Location = { file, rank };
      board.setPiece(location, null);
    }
  }

  return board;
}

export function cloneBoard(source: Board): Board {
  const cloned = createEmptyBoard();
  const pieces = source.getAllPieces();

  for (const piece of pieces) {
    if (!piece.location) continue;

    const { color, type, location } = piece;
    const newLocation: Location = { ...location };
    const newPiece: Piece = {
      color,
      type,
      location: newLocation,
    };

    cloned.setPiece(newLocation, newPiece);
  }

  return cloned;
}

export function rotateBoard180(source: Board): Board {
  const rotated = createEmptyBoard();
  const pieces = source.getAllPieces();
  const files = Object.values(File) as File[];
  const ranks = Object.values(Rank) as Rank[];

  for (const piece of pieces) {
    if (!piece.location) continue;

    const { color, type, location } = piece;
    const fileIndex = files.indexOf(location.file);
    const rankIndex = ranks.indexOf(location.rank);
    if (fileIndex === -1 || rankIndex === -1) continue;

    const newLocation: Location = {
      file: files[files.length - 1 - fileIndex],
      rank: ranks[ranks.length - 1 - rankIndex],
    };

    const newPiece: Piece = {
      color,
      type,
      location: newLocation,
    };

    rotated.setPiece(newLocation, newPiece);
  }

  return rotated;
}
