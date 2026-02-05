import type { Board } from '@/engine/board';
import { Color, type Move, type DifficultyLevel, type SerializablePiece, type ComputeMoveRequest, type ComputeMoveResponse } from '@/engine/types';

export class AIWorkerClient {
  private worker: Worker;
  private nextRequestId = 0;

  constructor() {
    this.worker = new Worker(
      new URL('./aiWorker.ts', import.meta.url),
      { type: 'module' },
    );
  }

  private serializeBoard(board: Board): SerializablePiece[] {
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

  async getNextMove(board: Board, color: Color, difficulty: DifficultyLevel, warmUp: boolean): Promise<Move> {
    const pieces = this.serializeBoard(board);

    const requestId = this.nextRequestId++;

    const payload: ComputeMoveRequest = {
      type: 'computeMove',
      difficulty,
      color,
      board: pieces,
      warmUp,
      requestId,
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