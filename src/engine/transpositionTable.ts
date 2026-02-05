import type { ZobristHash } from "@/lib/zobristHash";
import type { Color, GameEndReason, Move } from "./types";
import type { EvaluationScore } from "./types";


export type TranspositionTableEntry = {
    legalMoves? : Move[],
    orderedMovesTop? : Move[],
    orderedMovesBottom? : Move[],
    
    hasOnlyMove? : boolean,
    onlyMove? : Move,

    isEnded? : boolean,
    endReason? : GameEndReason,
    winner? : Color | null,

    depth? : number,
    bestMove? : Move,
    score?: EvaluationScore;
}

export interface TranspositionTableAPI {
    getEntry(hash: ZobristHash): TranspositionTableEntry | null;
    setEntry(hash: ZobristHash, entry: TranspositionTableEntry): void;
    updateSearchWindow(hash: ZobristHash, depth: number, score: EvaluationScore, bestMove?: Move): void;
    clear(): void;
}

export class TranspositionTable implements TranspositionTableAPI {
    private entries: Map<ZobristHash, TranspositionTableEntry>;
    private readonly maxSize: number;

    constructor(maxSize: number = 10000) {
        this.maxSize = maxSize;
        this.entries = new Map();
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

    updateSearchWindow(hash: ZobristHash, depth: number, score: EvaluationScore, bestMove?: Move): void {
        const prev = this.entries.get(hash) ?? {};
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