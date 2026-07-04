import type { ZobristHash } from '@/lib/zobristHash';
import type { Color, GameEndReason } from './types';
import type { EvaluationScore } from './types';
import type { MoveCode } from './moveCode';

// 무브는 압축 정수(MoveCode)로만 저장한다.
// 게임 전체 동안 유지되는 테이블이므로 Piece/Location 참조를 담으면
// 지나간 탐색의 보드 객체 그래프가 GC되지 못한다.
export type TranspositionTableEntry = {
  legalMoves?: MoveCode[];
  orderedMovesTop?: MoveCode[];
  orderedMovesBottom?: MoveCode[];

  hasOnlyMove?: boolean;
  onlyMove?: MoveCode;

  isEnded?: boolean;
  endReason?: GameEndReason;
  winner?: Color | null;

  depth?: number;
  bestMove?: MoveCode;
  score?: EvaluationScore;
};

export interface TranspositionTableAPI {
  getEntry(hash: ZobristHash): TranspositionTableEntry | null;
  setEntry(hash: ZobristHash, entry: TranspositionTableEntry): void;
  updateSearchWindow(
    hash: ZobristHash,
    depth: number,
    score: EvaluationScore,
    bestMove?: MoveCode,
  ): void;
  clear(): void;
}

const EVICT_COUNT = 10000;

type TTWrapper = {
  entry: TranspositionTableEntry;
  lastAccess: number;
};

export class TranspositionTable implements TranspositionTableAPI {
  private entries: Map<ZobristHash, TTWrapper>;
  private readonly maxSize: number;

  constructor(maxSize: number = 50000) {
    this.maxSize = maxSize;
    this.entries = new Map();
  }

  getEntry(hash: ZobristHash): TranspositionTableEntry | null {
    const wrapper = this.entries.get(hash);
    if (!wrapper) return null;
    wrapper.lastAccess = Date.now();
    return wrapper.entry;
  }

  setEntry(hash: ZobristHash, entry: TranspositionTableEntry): void {
    const now = Date.now();
    if (this.entries.has(hash)) {
      this.entries.set(hash, { entry, lastAccess: now });
      return;
    }
    if (this.entries.size >= this.maxSize) {
      const byAge = Array.from(this.entries.entries())
        .map(([key, w]) => [key, w.lastAccess] as const)
        .sort((a, b) => a[1] - b[1]);
      const toDelete = Math.min(EVICT_COUNT, byAge.length);
      for (let i = 0; i < toDelete; i++) {
        this.entries.delete(byAge[i]![0]);
      }
    }
    this.entries.set(hash, { entry, lastAccess: now });
  }

  updateSearchWindow(
    hash: ZobristHash,
    depth: number,
    score: EvaluationScore,
    bestMove?: MoveCode,
  ): void {
    const prev = this.entries.get(hash)?.entry ?? {};
    this.setEntry(hash, {
      ...prev,
      depth,
      score,
      bestMove,
    });
  }

  clear(): void {
    this.entries.clear();
  }
}
