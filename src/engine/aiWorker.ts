/// <reference lib="webworker" />

import {
    type DifficultyLevel,
    type Location,
    type Piece,
    type SerializablePiece,
    type ComputeMoveRequest,
    type ComputeMoveResponse,
    type Move,
} from './types';
import { createAIPlayer, type AIPlayerAPI } from './aiPlayer';
import { createEmptyBoard } from './boardUtils';
import { Board } from './board';

const ctx: DedicatedWorkerGlobalScope = self as any;
let LOCK = false;

const aiInstances: Partial<Record<DifficultyLevel, AIPlayerAPI>> = {};

function getAI(level: DifficultyLevel): AIPlayerAPI {
    if (!aiInstances[level]) {
        aiInstances[level] = createAIPlayer(level);
    }
    return aiInstances[level]!;
}

function buildBoard(pieces: SerializablePiece[]): Board {
  const board = createEmptyBoard();

  for (const piece of pieces) {
    const location: Location = { file: piece.file, rank: piece.rank };
    const newPiece: Piece = {
      color: piece.color,
      type: piece.type,
      location,
    };
    board.setPiece(location, newPiece);
  }

  return board;
}

ctx.onmessage = async (event: MessageEvent<ComputeMoveRequest>) => {
  const data = event.data;
  if (data.type !== 'computeMove') return;


  let interrupted = false;
  while (LOCK) {
    const ai = getAI(data.difficulty);
    if (!interrupted) {
        ai.interrupt();
        interrupted = true;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  LOCK = true;

  const board = buildBoard(data.board);

  const ai = getAI(data.difficulty);
  const move : Move | undefined = await ai.getNextMove(board, data.color, data.warmUp);
  LOCK = false;
  console.log('try to send move', move);
  if (move !== undefined) {
    const response: ComputeMoveResponse = { type: 'move', move: move };
    ctx.postMessage(response);
  }
};