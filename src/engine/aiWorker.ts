/// <reference lib="webworker" />

import { type DifficultyLevel, type Move } from './types';
import { createAIPlayer, type AIPlayerAPI } from './aiPlayer';
import { buildBoardFromPieces } from './boardUtils';
import type { ComputeMoveRequest, ComputeMoveResponse } from '@/types/workerMessage';

const ctx: DedicatedWorkerGlobalScope = self as any;
let LOCK = false;

const aiInstances: Partial<Record<DifficultyLevel, AIPlayerAPI>> = {};

function getOrCreateAI(level: DifficultyLevel): AIPlayerAPI {
  if (!aiInstances[level]) {
    aiInstances[level] = createAIPlayer(level);
  }
  return aiInstances[level]!;
}

ctx.onmessage = async (event: MessageEvent<ComputeMoveRequest>) => {
  const data = event.data;
  if (data.type !== 'computeMove') return;

  let interrupted = false;
  while (LOCK) {
    const ai = getOrCreateAI(data.difficulty);
    if (!interrupted) {
      ai.interrupt();
      interrupted = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  LOCK = true;

  const board = buildBoardFromPieces(data.board);

  const ai = getOrCreateAI(data.difficulty);
  if (data.resetAI === true) {
    ai.clearTranspositionTable();
  }
  const move: Move | undefined = await ai.getNextMove(board, data.color, data.warmUp);
  if (move !== undefined) {
    const response: ComputeMoveResponse = { type: 'move', move: move, requestId: data.requestId };
    ctx.postMessage(response);
  }
  LOCK = false;
};
