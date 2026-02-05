import { Board } from './board';
import { Game } from './game';
import {
    Color,
    PieceType,
    reverseColor,
    difficultyLevel,
    type DifficultyLevel,
    type Move,
    GameEndReason,
    type EvaluationScore,
} from './types';
import { TranspositionTable, type TranspositionTableEntry } from './transpositionTable';

export interface AIPlayerAPI {
  getNextMove(board: Board, color: Color, warmUp: boolean): Promise<Move | undefined>;
  interrupt(): void;
}

type ScoredMove = {
  move: Move | undefined;
  score: number;
  minDepth: number;
};

const TIME_LIMIT_MS_EASY = 5000;
const TIME_LIMIT_MS_HARD = 30000;
const INITIAL_DEPTH_EASY = 2;
const INITIAL_DEPTH_HARD = 2;

const MAX_DEPTH_LIMIT_EASY = 7;
const MAX_DEPTH_LIMIT_HARD = 10;
const MIN_DEPTH_LIMIT_EASY = 2;
const MIN_DEPTH_LIMIT_HARD = 2;

const MAX_DEPTH = 10;

const POSITIVE_INFINITY = Number.POSITIVE_INFINITY;
const NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY;

const BATCH_SIZE = 20;

export class AIPlayer implements AIPlayerAPI {
  private timeLimitMs: number;
  private initialDepth: number;

  private ttHitCount: number = 0;

  private readonly tt: TranspositionTable;
  private timeExceeded: boolean = false;
  private deadlineMs: number = 0;
  private rootColor: Color = Color.White;
  private readonly difficulty: DifficultyLevel;

  private interrupted: boolean = false;

  constructor(level: DifficultyLevel) {
    this.tt = new TranspositionTable();
    this.difficulty = level;

    if (level === difficultyLevel.Easy) {
      this.timeLimitMs = TIME_LIMIT_MS_EASY;
      this.initialDepth = INITIAL_DEPTH_EASY;
    } else { // Hard
      this.timeLimitMs = TIME_LIMIT_MS_HARD;
      this.initialDepth = INITIAL_DEPTH_HARD;
    }

    this.initialDepth = this.clampDepth(this.initialDepth);
  }


  interrupt(): void {
    this.interrupted = true;
  }


  private yieldToEventLoop = () => new Promise<void>(resolve => setTimeout(resolve, 1));

  private countIsTimeUp(): () => Promise<boolean> {
    let count = 0;
    
    const innerIsTimeUp = async () => {
        count++;
        if (count >= BATCH_SIZE) {
            await this.yieldToEventLoop();
            if (this.interrupted) {
                this.interrupted = false;
                return true;
            }
            return Date.now() >= this.deadlineMs;
        }
        return false;
    }
    return innerIsTimeUp as () => Promise<boolean>;
  }

  private async isTimeUp(): Promise<boolean> {
    const innerIsTimeUp = this.countIsTimeUp();
    return await innerIsTimeUp();
  }

  private clampDepth(depth: number): number {
    if (this.difficulty === difficultyLevel.Easy) {
      const min = MIN_DEPTH_LIMIT_EASY;
      const max = MAX_DEPTH_LIMIT_EASY;
      return Math.min(max, Math.max(min, depth));
    }
    const min = MIN_DEPTH_LIMIT_HARD;
    const max = MAX_DEPTH_LIMIT_HARD;
    return Math.min(max, Math.max(min, depth));
  }

  async getNextMove(board: Board, color: Color, warmUp: boolean): Promise<Move | undefined> {
    
    this.ttHitCount = 0;
    let finalDepth = 0;
    const game = new Game(board, color);

    this.rootColor = color;
    if (warmUp) {
      this.deadlineMs = Date.now() + 10000000;
    } else {
        this.deadlineMs = Date.now() + this.timeLimitMs;
    }
    this.timeExceeded = false;

    let currentDepth = this.initialDepth;
    
    let baseSearchSucceeded = false;
    let extraSearchSucceeded = false;
    
    let bestMove : ScoredMove = await this.searchBestMove(game, currentDepth, NEGATIVE_INFINITY, POSITIVE_INFINITY);
    
    if (!this.timeExceeded) baseSearchSucceeded = true;

    while (currentDepth < MAX_DEPTH && !this.timeExceeded) {
      const nextDepth = currentDepth + 1;

      const deeperBestMove = await this.searchBestMove(
        game,
        nextDepth,
        NEGATIVE_INFINITY,
        POSITIVE_INFINITY,
      );

      if (!this.timeExceeded) extraSearchSucceeded = true;

      currentDepth = nextDepth;
      bestMove = deeperBestMove;
    }


    if (!warmUp && extraSearchSucceeded) {
      this.initialDepth = this.clampDepth(this.initialDepth + 1);
    } else if (!warmUp && !baseSearchSucceeded) {
      this.initialDepth = this.clampDepth(this.initialDepth - 1);
    }

    finalDepth = currentDepth;
    console.log(`final depth: ${finalDepth}`);
    return warmUp ? undefined : bestMove.move;
  }


  private async searchBestMove(
    game: Game,
    depth: number,
    alpha: number,
    beta: number,
  ): Promise<ScoredMove> {

    if (await this.isTimeUp()) this.timeExceeded = true;

    const currentEntry : TranspositionTableEntry = this.getTTEntry(game);
    const currentEntryTrust = currentEntry.depth ?? 0;
    if (currentEntryTrust >= depth &&
        currentEntry.bestMove !== undefined &&
        currentEntry.score !== undefined) {
      return { move: currentEntry.bestMove, score: currentEntry.score, minDepth: currentEntryTrust } as ScoredMove;
    }
   
    if (currentEntry.isEnded) {
        let endedScoredMove : ScoredMove = { move: undefined, score: 0, minDepth: depth };
        if (currentEntry.winner === this.rootColor) {
            endedScoredMove.score = POSITIVE_INFINITY;
        } else if (currentEntry.winner === reverseColor(this.rootColor)) {
            endedScoredMove.score = NEGATIVE_INFINITY;
        } else {
            endedScoredMove.score = 0;
        }
        this.setTTDepthInfo(game, depth, endedScoredMove.score);
        return endedScoredMove;
    }

    if (depth <= 0 || this.timeExceeded) {
        if (currentEntryTrust > 0) {
            return { move: currentEntry.bestMove, score: currentEntry.score ?? 0, minDepth: currentEntryTrust } as ScoredMove;
        }
        const leafScoredMove : ScoredMove = { move: undefined, score: this.evaluate(game), minDepth: 0 };
        this.setTTDepthInfo(game, 0, leafScoredMove.score);
        return leafScoredMove;
    }

    const isMaximizing = game.getCurrentPlayer() === this.rootColor;
    let nextTopMoves : Move[] = [];
    let trustDepth = depth;
    let bestScore : EvaluationScore = isMaximizing ? NEGATIVE_INFINITY : POSITIVE_INFINITY;

    let onlyTarget : Move[] = []
    if (currentEntry.hasOnlyMove && currentEntry.onlyMove) {
      onlyTarget = [currentEntry.onlyMove];
    }
    const primarySearchTargets : Move[] = currentEntry.orderedMovesTop ?? currentEntry.legalMoves ?? [];
    const secondarySearchTargets : Move[] = currentEntry.orderedMovesBottom ?? [];

    for (const move of onlyTarget) {
      const nextDepth = depth;
      game.applyMoveForSearch(move);
      const {move: nextMove, score, minDepth} = await this.searchBestMove(
        game,
        nextDepth,
        alpha,
        beta,
      );
      game.rollbackMoveForSearch();
      bestScore = score;
      trustDepth = minDepth;
      if (nextMove) nextTopMoves.push(nextMove);
    }

    for (const move of primarySearchTargets) {
      if (alpha >= beta) break;
      const nextDepth = depth - 1;
      game.applyMoveForSearch(move);
      const { score, minDepth } = await this.searchBestMove(
        game,
        nextDepth,
        alpha,
        beta,
      );
      game.rollbackMoveForSearch();
      if (trustDepth > minDepth + 1) trustDepth = Math.floor(minDepth + 1);
      if (isMaximizing) {
        if (score > bestScore) {
          bestScore = score;
          nextTopMoves = [move];
          alpha = score;
        } else if (score === bestScore) {
            nextTopMoves.push(move);
        }
      } else {
        if (score < bestScore) {
          bestScore = score;
          nextTopMoves = [move];
          beta = score;
        } else if (score === bestScore) {
            nextTopMoves.push(move);
        }
      }
    }

    for (const move of secondarySearchTargets) {
      if (alpha >= beta) break;
      const nextDepth = depth - 2;
      game.applyMoveForSearch(move);
      const { score, minDepth } = await this.searchBestMove(
        game,
        nextDepth,
        alpha,
        beta,
      );
      game.rollbackMoveForSearch();
      if (trustDepth > minDepth + 2) trustDepth = Math.floor(minDepth + 2);
      if (isMaximizing) {
        if (score > bestScore) {
          bestScore = score;
          nextTopMoves = [move];
          alpha = score;
        } else if (score === bestScore) {
            nextTopMoves.push(move);
        }
      } else {
        if (score < bestScore) {
          bestScore = score;
          nextTopMoves = [move];
          beta = score;
        } else if (score === bestScore) {
            nextTopMoves.push(move);
        }
      }
    }

    if (this.timeExceeded) {
        trustDepth += 0.5;
        if (currentEntryTrust >= trustDepth) {
            trustDepth = currentEntryTrust - 0.1;
            bestScore = currentEntry.score ?? 0;
            nextTopMoves = currentEntry.bestMove ? [currentEntry.bestMove] : [];
        } else {
            trustDepth -= 0.1
        }
    }
    let bestMove : Move | undefined;

    if (nextTopMoves.length === 0) {
        bestMove = undefined;
    } else if (nextTopMoves.length === 1) {
        bestMove = nextTopMoves[0];
    } else {
        bestMove = nextTopMoves[Math.floor(Math.random() * nextTopMoves.length)];
    }

    this.setTTDepthInfo(game,
        alpha>=beta ? 0.5 : trustDepth,
        bestScore,
        bestMove);

    return { move: bestMove, score: bestScore, minDepth: trustDepth } as ScoredMove;
  }

    private getTTEntry(game: Game): TranspositionTableEntry {
    let newEntry : TranspositionTableEntry = {}
    const currentHash = game.getBoardHash();
    const entry : TranspositionTableEntry = this.tt.getEntry(currentHash) ?? {};
    if (entry.legalMoves !== undefined &&
        entry.orderedMovesTop !== undefined &&
        entry.orderedMovesBottom !== undefined &&
        entry.hasOnlyMove !== undefined &&
        entry.isEnded !== undefined) {
            this.ttHitCount++;
            return entry;
        }


    const currentPlayer = game.getCurrentPlayer();
    const isInCheckmate = game.checkForCheckmate(currentPlayer).isInCheckmate;
    const isStalemate = game.isStalemate(currentPlayer);
    const isLoneIsland = game.isLoneIsland(currentPlayer);
    const isOnlyKingLeft = game.isOnlyKingLeft(currentPlayer);
    const isEnded = isInCheckmate || isStalemate || isLoneIsland || isOnlyKingLeft;
    const endReason = isInCheckmate ? GameEndReason.Checkmate : isStalemate ? GameEndReason.Stalemate : isLoneIsland ? GameEndReason.LoneIsland : isOnlyKingLeft ? GameEndReason.OnlyKingLeft : undefined;
    if (isEnded) {
        newEntry.isEnded = true;
        newEntry.endReason = endReason;
        const winner = isStalemate ? null : currentPlayer;
        newEntry.winner = winner;
        newEntry.legalMoves = [];
        newEntry.orderedMovesTop = [];
        newEntry.orderedMovesBottom = [];
        newEntry.hasOnlyMove = false;
        return newEntry;
    } else {
        newEntry.isEnded = false;
    }

    if (entry.legalMoves) {
        this.ttHitCount++;
    }
    newEntry.legalMoves = entry.legalMoves ?? game.getLegalMoves(game.getCurrentPlayer());
    if (newEntry.legalMoves.length === 1) {
        newEntry.hasOnlyMove = true;
        newEntry.onlyMove = newEntry.legalMoves[0];
        newEntry.orderedMovesTop = [newEntry.onlyMove];
        newEntry.orderedMovesBottom = [];
    } else {
        newEntry.hasOnlyMove = false;
    }

    const newOrderedMovesTop: Move[] = [];
    const countRecord: Record<number, Move[]> = {};
    const newOrderedMovesBottom: Move[] = [];

    for (const move of newEntry.legalMoves) {
      game.applyMoveForSearch(move);
      const nextHash = game.getBoardHash();
      const nextEntry : TranspositionTableEntry = this.tt.getEntry(nextHash) ?? {};
      let nextLegalMoves : Move[] = [];
      if (nextEntry.legalMoves) {
        nextLegalMoves = nextEntry.legalMoves;
      } else {
        nextLegalMoves = game.getLegalMoves(game.getCurrentPlayer());
        nextEntry.legalMoves = nextLegalMoves;
        this.tt.setEntry(nextHash, nextEntry);
      }
      const isInCheck = game.checkForCheck(game.getCurrentPlayer()).isInCheck;
      const isInCaptureForced = game.isCaptureForced();
      if (isInCheck || isInCaptureForced) {
        const count = nextLegalMoves.length;
        if (!countRecord[count]) {
          countRecord[count] = [];
        }
        countRecord[count].push(move);
      } else {
        newOrderedMovesBottom.push(move);
      }
      game.rollbackMoveForSearch();
    }

    const sortedCounts = Object.keys(countRecord)
      .map((k) => Number(k))
      .sort((a, b) => a - b);

    for (const cnt of sortedCounts) {
      const moves = countRecord[cnt];
      if (!moves) continue;
      newOrderedMovesTop.push(...moves);
    }

    newEntry.orderedMovesTop = newOrderedMovesTop;
    newEntry.orderedMovesBottom = newOrderedMovesBottom;
    this.tt.setEntry(currentHash, newEntry);
    return newEntry;
  }

  private setTTDepthInfo(game: Game, depth: number, score: EvaluationScore, bestMove?: Move): void {
    const currentHash = game.getBoardHash();
    const entry : TranspositionTableEntry = this.tt.getEntry(currentHash) ?? {};
    if (entry.depth && entry.depth >= depth) return;
    entry.depth = depth;
    entry.score = score;
    entry.bestMove = bestMove;
    this.tt.updateSearchWindow(currentHash, depth, score, bestMove);
}

  private evaluate(game: Game): number {
    const board = game.getBoard();

    const material = (color: Color): number => {
      const pieces = board.getAllPieces(color);
      let score = 0;

      for (const piece of pieces) {
        switch (piece.type) {
          case PieceType.Pawn:
            score += 1;
            break;
          case PieceType.Knight:
            score += 3;
            break;
          case PieceType.Bishop:
            score += 5;
            break;
          case PieceType.Rook:
            score += 7;
            break;
          case PieceType.Queen:
            score += 9;
            break;
          case PieceType.King:
          default:
            break;
        }
      }

      return score;
    };

    const myMaterial = material(this.rootColor);
    const oppMaterial = material(reverseColor(this.rootColor));

    return oppMaterial - myMaterial;
  }
}

export function createAIPlayer(level: DifficultyLevel): AIPlayer {
  return new AIPlayer(level);
}
