import type { ZobristHash } from "@/lib/zobristHash";
import type { GameEndReason, Move } from "./types";
import type { EvaluationScore } from "./types";


export type TranspositionTableEntry = {
    legalMoves? : Move[],
    orderedMovesTop? : Move[],
    orderedMovesBottom? : Move[],
    hasOnlyMove? : boolean,
    onlyMove? : Move,
    isEnded? : boolean,
    endReason? : GameEndReason,
    Score?: EvaluationScore;
}

export interface TranspositionTableAPI {
    getEntry(hash: ZobristHash): TranspositionTableEntry | null;
    setEntry(hash: ZobristHash, entry: TranspositionTableEntry): void;
    clear(): void;
}

export class TranspositionTable implements TranspositionTableAPI {
    private readonly entries: Map<ZobristHash, TranspositionTableEntry> = new Map();
    private readonly maxSize: number;

    constructor(maxSize: number = 10000) {
        this.maxSize = maxSize;
    }

    getEntry(hash: ZobristHash): TranspositionTableEntry | null {
        return this.entries.get(hash) ?? null;
    }

    setEntry(hash: ZobristHash, entry: TranspositionTableEntry): void {
        if (!this.entries.has(hash) && this.entries.size >= this.maxSize) {
            const oldestKey = this.entries.keys().next().value as ZobristHash | undefined;
            if (oldestKey !== undefined) {
                this.entries.delete(oldestKey);
            }
        }
        this.entries.set(hash, entry);
    }

    clear(): void {
        this.entries.clear();
    }
}