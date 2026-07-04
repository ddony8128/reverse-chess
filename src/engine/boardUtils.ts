import { Board } from './board';
import { File, Rank, type Piece } from './types';
import type { Location } from './types';
import type { SerializablePiece } from '@/types/workerMessage';

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

/** 보드를 기물 목록으로 직렬화. 워커 전송과 localStorage 저장이 같은 포맷을 쓴다. */
export function serializeBoard(board: Board): SerializablePiece[] {
  const pieces = board.getAllPieces();
  const result: SerializablePiece[] = [];
  for (const p of pieces) {
    if (!p.location) continue;
    result.push({
      color: p.color,
      type: p.type,
      file: p.location.file,
      rank: p.location.rank,
    });
  }
  return result;
}

/** 기물 목록에서 보드를 재조립. serializeBoard의 역연산. */
export function buildBoardFromPieces(pieces: SerializablePiece[]): Board {
  const board = createEmptyBoard();
  for (const piece of pieces) {
    const location: Location = { file: piece.file, rank: piece.rank };
    board.setPiece(location, {
      color: piece.color,
      type: piece.type,
      location,
    });
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
