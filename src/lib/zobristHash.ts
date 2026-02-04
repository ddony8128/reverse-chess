import { Board } from '@/engine/board';
import {
  Color,
  PieceType,
  type Location,
  fileToIndex,
  rankToIndex,
} from '@/engine/types';

const BOARD_SIZE = 64;
const NUM_PIECE_KINDS = 12;
const SEED_VALUE = 0x12345678;

export type ZobristHash = number;

type PieceKindIndex = number;

function createSeededRandom32(seed: number) {
  let state = seed >>> 0;
  return function random32() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

const seededRandom32 = createSeededRandom32(SEED_VALUE);

function random32(): number {
  return seededRandom32();
}

const ZOBRIST_PIECES: number[][] = createPieceTable();
const ZOBRIST_SIDE_TO_MOVE: ZobristHash = random32();

function createPieceTable(): number[][] {
  const table: number[][] = [];
  for (let i = 0; i < NUM_PIECE_KINDS; i++) {
    const row: number[] = [];
    for (let j = 0; j < BOARD_SIZE; j++) {
      row.push(random32());
    }
    table.push(row);
  }
  return table;
}

function getPieceKindIndex(color: Color, type: PieceType): PieceKindIndex {
  let colorIndex = color === Color.White ? 0 : 1;
  let typeIndex: number;
  switch (type) {
    case PieceType.Pawn:
      typeIndex = 0;
      break;
    case PieceType.Knight:
      typeIndex = 1;
      break;
    case PieceType.Bishop:
      typeIndex = 2;
      break;
    case PieceType.Rook:
      typeIndex = 3;
      break;
    case PieceType.Queen:
      typeIndex = 4;
      break;
    case PieceType.King:
      typeIndex = 5;
      break;
    default:
      typeIndex = 0;
  }
  return colorIndex * 6 + typeIndex;
}

function getSquareIndex(location: Location): number | null {
  const fileIndex = fileToIndex(location.file);
  const rankIndex = rankToIndex(location.rank);
  if (fileIndex === -1 || rankIndex === -1) {
    return null;
  }
  return rankIndex * 8 + fileIndex;
}

export function computeZobristHash(board: Board, currentPlayer: Color): ZobristHash {
  let hash: ZobristHash = 0;

  const pieces = board.getAllPieces();
  for (const piece of pieces) {
    if (!piece.location) continue;
    const squareIndex = getSquareIndex(piece.location);
    if (squareIndex === null) continue;

    const kindIndex = getPieceKindIndex(piece.color, piece.type);
    hash ^= ZOBRIST_PIECES[kindIndex][squareIndex];
  }

  if (currentPlayer === Color.Black) {
    hash ^= ZOBRIST_SIDE_TO_MOVE;
  }

  return hash;
}

export type ZobristMoveInfo = {
  from: Location;
  to: Location;
  pieceColor: Color;
  pieceTypeBefore: PieceType;
  pieceTypeAfter: PieceType;
  capturedPieceColor?: Color | null;
  capturedPieceType?: PieceType | null;
};

export function updateHashForMove(
  hash: ZobristHash,
  info: ZobristMoveInfo,
  undo: boolean = false,
): ZobristHash {
  const fromIndex = getSquareIndex(info.from);
  const toIndex = getSquareIndex(info.to);
  if (fromIndex === null || toIndex === null) {
    return hash;
  }

  const moverBeforeIndex = getPieceKindIndex(info.pieceColor, info.pieceTypeBefore);
  const moverAfterIndex = getPieceKindIndex(info.pieceColor, info.pieceTypeAfter);

  if (!undo) {
    hash ^= ZOBRIST_PIECES[moverBeforeIndex][fromIndex];

    if (info.capturedPieceColor && info.capturedPieceType) {
      const capturedIndex = getPieceKindIndex(info.capturedPieceColor, info.capturedPieceType);
      hash ^= ZOBRIST_PIECES[capturedIndex][toIndex];
    }

    hash ^= ZOBRIST_PIECES[moverAfterIndex][toIndex];
  } else {
    hash ^= ZOBRIST_PIECES[moverAfterIndex][toIndex];

    if (info.capturedPieceColor && info.capturedPieceType) {
      const capturedIndex = getPieceKindIndex(info.capturedPieceColor, info.capturedPieceType);
      hash ^= ZOBRIST_PIECES[capturedIndex][toIndex];
    }

    hash ^= ZOBRIST_PIECES[moverBeforeIndex][fromIndex];
  }

  return hash;
}

export function toggleSideToMove(hash: ZobristHash): ZobristHash {
  return hash ^ ZOBRIST_SIDE_TO_MOVE;
}
