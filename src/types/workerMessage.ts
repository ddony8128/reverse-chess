import type { Color, DifficultyLevel, Move, Rank, PieceType, File } from '@/engine/types';

export type ComputeMoveRequest = {
  type: 'computeMove';
  difficulty: DifficultyLevel;
  color: Color;
  board: SerializablePiece[];
  warmUp: boolean;
  requestId: number;
  resetAI?: boolean;
};

export type ComputeMoveResponse = {
  type: 'move';
  requestId: number;
  move: Move;
};

export type SerializablePiece = {
  color: Color;
  type: PieceType;
  file: File;
  rank: Rank;
};
