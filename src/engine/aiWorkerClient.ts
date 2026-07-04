import type { Board } from '@/engine/board';
import { type Color, type Move, type DifficultyLevel } from '@/engine/types';
import { serializeBoard } from '@/engine/boardUtils';
import type { ComputeMoveRequest, ComputeMoveResponse } from '@/types/workerMessage';

export class AIWorkerClient {
  private worker: Worker;
  private nextRequestId = 0;

  constructor() {
    this.worker = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' });
  }

  async getNextMove(
    board: Board,
    color: Color,
    difficulty: DifficultyLevel,
    warmUp: boolean,
    resetAI: boolean = false,
  ): Promise<Move> {
    const pieces = serializeBoard(board);

    const requestId = this.nextRequestId++;

    const payload: ComputeMoveRequest = {
      type: 'computeMove',
      difficulty,
      color,
      board: pieces,
      warmUp,
      requestId,
      resetAI,
    };

    return new Promise<Move>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<ComputeMoveResponse>) => {
        const data = event.data;
        if (data.type !== 'move') return;
        if (data.requestId !== requestId) return;
        this.worker.removeEventListener('message', handleMessage);
        this.worker.removeEventListener('error', handleError);
        resolve(data.move);
      };

      const handleError = (err: ErrorEvent) => {
        this.worker.removeEventListener('error', handleError);
        reject(err);
      };

      this.worker.addEventListener('message', handleMessage);
      this.worker.addEventListener('error', handleError);
      this.worker.postMessage(payload);
    });
  }

  dispose() {
    this.worker.terminate();
  }
}
