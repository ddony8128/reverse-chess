export const Color = {
  White: 'white',
  Black: 'black',
} as const;

export type Color = (typeof Color)[keyof typeof Color];

export function reverseColor(color: Color): Color {
  return color === Color.White ? Color.Black : Color.White;
}

export const PieceType = {
  Pawn: 'pawn',
  Knight: 'knight',
  Bishop: 'bishop',
  Rook: 'rook',
  Queen: 'queen',
  King: 'king',
} as const;
export type PieceType = (typeof PieceType)[keyof typeof PieceType];

export const File = {
  A: 'a',
  B: 'b',
  C: 'c',
  D: 'd',
  E: 'e',
  F: 'f',
  G: 'g',
  H: 'h',
} as const;
export type File = (typeof File)[keyof typeof File];

export const Rank = {
  Rank1: 1,
  Rank2: 2,
  Rank3: 3,
  Rank4: 4,
  Rank5: 5,
  Rank6: 6,
  Rank7: 7,
  Rank8: 8,
} as const;
export type Rank = (typeof Rank)[keyof typeof Rank];

const FILES_IN_ORDER = Object.values(File) as File[];
const RANKS_IN_ORDER = Object.values(Rank) as Rank[];

export function fileToIndex(file: File): number {
  return FILES_IN_ORDER.indexOf(file) ?? -1;
}

export function indexToFile(index: number): File | null {
  if (index < 0 || index >= FILES_IN_ORDER.length) {
    return null;
  }
  return FILES_IN_ORDER[index];
}

export function rankToIndex(rank: Rank): number {
  return RANKS_IN_ORDER.indexOf(rank) ?? -1;
}

export function indexToRank(index: number): Rank | null {
  if (index < 0 || index >= RANKS_IN_ORDER.length) {
    return null;
  }
  return RANKS_IN_ORDER[index];
}

export type Location = {
  file: File;
  rank: Rank;
};

export type LocationKey = `${File}${Rank}`;

export function locationToKey(location: Location): LocationKey {
  return `${location.file}${location.rank}` as LocationKey;
}

export type Square = {
  location: Location;
  piece: Piece | null;
  color?: Color;
};

export type Piece = {
  color: Color;
  type: PieceType;
  location?: Location;
};

export type PieceKey = `${Color}_${PieceType}`;

export function pieceToKey(piece: Piece): PieceKey {
  return `${piece.color}_${piece.type}` as PieceKey;
}

export const GameState = {
  Initial: 'initial',
  InPlay: 'inPlay',
  Finished: 'finished',
} as const;

export type GameState = (typeof GameState)[keyof typeof GameState];

export type Move = {
  from: Location;
  to: Location;
  piece?: Piece;
  captured?: Piece | null;
  promotion?: PieceType | null;
};

export const GameError = {
  NotYourTurn: 'Not your turn',
  GameAlreadyStarted: 'Game already started',
  GameNotStarted: 'Game not started',
  GameFinished: 'Game finished',
  InvalidMove: 'Invalid move',
} as const;

export type GameError = (typeof GameError)[keyof typeof GameError];

export const GameEndReason = {
  Checkmate: 'Checkmate',
  Stalemate: 'Stalemate',
  LoneIsland: 'Lone island',
  OnlyKingLeft: 'Only king left',
} as const;

export type GameEndReason = (typeof GameEndReason)[keyof typeof GameEndReason];

export const difficultyLevel = {
  Easy: 'Easy',
  Hard: 'Hard',
} as const;

export type DifficultyLevel = (typeof difficultyLevel)[keyof typeof difficultyLevel];

export type EvaluationScore = number;


export type SerializablePiece = {
  color: Color;
  type: PieceType;
  file: File;
  rank: Rank;
};

export type ComputeMoveRequest = {
    type: 'computeMove';
    difficulty: DifficultyLevel;
    color: Color;
    board: SerializablePiece[];
    warmUp: boolean;
    requestId: number;
    resetAI?: boolean;
}

export type ComputeMoveResponse = {
  type: 'move';
  requestId: number;
  move: Move;
};