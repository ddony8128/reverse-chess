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
} from './types';
import { TranspositionTable, type TranspositionTableEntry } from './transpositionTable';

export interface AIPlayerAPI {
  getNextMove(board: Board, color: Color, warmUp: boolean): Promise<Move | undefined>;
  interrupt(): void;
}

type ScoredMove = {
  move: Move;
  score: number;
};

const TIME_LIMIT_MS_EASY = 1000;
const TIME_LIMIT_MS_HARD = 30000;
const INITIAL_DEPTH_EASY = 2;
const INITIAL_DEPTH_HARD = 2;
const CANDIDATE_COUNT_EASY = 10;
const CANDIDATE_COUNT_HARD = 20;

const MAX_DEPTH_LIMIT_EASY = 7;
const MAX_DEPTH_LIMIT_HARD = 10;
const MIN_DEPTH_LIMIT_EASY = 2;
const MIN_DEPTH_LIMIT_HARD = 2;

const MAX_DEPTH = 10;

const POSITIVE_INFINITY = Number.POSITIVE_INFINITY;
const NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY;

export class AIPlayer implements AIPlayerAPI {
  private timeLimitMs: number;
  private initialDepth: number;
  private candidateCount: number;

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
      this.candidateCount = CANDIDATE_COUNT_EASY;
    } else { // Hard
      this.timeLimitMs = TIME_LIMIT_MS_HARD;
      this.initialDepth = INITIAL_DEPTH_HARD;
      this.candidateCount = CANDIDATE_COUNT_HARD;
    }

    this.initialDepth = this.clampDepth(this.initialDepth);
  }


  interrupt(): void {
    this.interrupted = true;
  }

  private async isTimeUp(): Promise<boolean> {
    const yieldToEventLoop = () => new Promise<void>(resolve => setTimeout(resolve, 5));
    await yieldToEventLoop();
    if (this.interrupted) {
      this.interrupted = false;
      return true;
    }
    return Date.now() >= this.deadlineMs;
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
    const game = new Game(board, color);

    this.rootColor = color;
    this.deadlineMs = Date.now() + this.timeLimitMs;
    if (warmUp) {
      this.deadlineMs = Date.now() + 10000000;
    }
    this.timeExceeded = false;

    let bestMoves: Move[] = [];
    let currentDepth = this.initialDepth;
    let topMoves = await this.searchBestMoves(game, currentDepth, true, undefined);
    let delta = 0;

    delta = this.timeExceeded ? -1 : 1;

    let extraSearchSucceeded = false;

    while (delta === -1 && !extraSearchSucceeded) {
      currentDepth += delta;
      if (currentDepth === 0) {
        bestMoves = game.getLegalMoves(color);
        break;
      }

      this.timeExceeded = false;
      const deeperTopMoves = await this.searchBestMoves(
        game,
        currentDepth,
        true,
        undefined,
      );

      if (!this.timeExceeded && deeperTopMoves.length > 0) {
        topMoves = deeperTopMoves;
        extraSearchSucceeded = true;
      }
    }

    if (delta === -1 && !extraSearchSucceeded) {
      if (bestMoves.length === 0) {
        bestMoves = game.getLegalMoves(color);
      }
      if (bestMoves.length === 0) {
        throw new Error('No legal moves available for AI.');
      }
      this.initialDepth = this.clampDepth(this.initialDepth - 1);
      const randomIndex = Math.floor(Math.random() * bestMoves.length);
      return warmUp ? undefined : bestMoves[randomIndex];
    }

    while (currentDepth < MAX_DEPTH && delta === 1 && !await this.isTimeUp()) {
      this.timeExceeded = false;
      const nextDepth = currentDepth + delta;

      const deeperTopMoves = await this.searchBestMoves(
        game,
        nextDepth,
        true,
        topMoves,
      );

      if (this.timeExceeded) break;

      currentDepth = nextDepth;
      topMoves = deeperTopMoves;
      extraSearchSucceeded = true;
    }

    if (!warmUp && delta === 1 && extraSearchSucceeded) {
      this.initialDepth = this.clampDepth(this.initialDepth + 1);
    } else if (!warmUp && delta === -1 && extraSearchSucceeded) {
      this.initialDepth = this.clampDepth(this.initialDepth - 1);
    }

    const bestScore = topMoves[0].score;
    bestMoves = topMoves
      .filter((s) => s.score === bestScore)
      .map((s) => s.move);

    if (bestMoves.length === 1) {
      return warmUp ? undefined : bestMoves[0];
    }
    const randomIndex = Math.floor(Math.random() * bestMoves.length);

    return warmUp ? undefined : bestMoves[randomIndex];
  }


  private async searchBestMoves(
    game: Game,
    depth: number,
    block: boolean,
    topMoves?: ScoredMove[],
  ): Promise<ScoredMove[]> {
    const currentPlayer = game.getCurrentPlayer();

    if (block && await this.isTimeUp()) {
      this.timeExceeded = true;
      return [];
    }

    const searchTargets = topMoves?.map((s) => s.move) ?? game.getLegalMoves(currentPlayer);

    if (searchTargets.length === 0) {
      return [];
    }

    let bestScore = NEGATIVE_INFINITY;
    const scored: ScoredMove[] = [];
    for (const move of searchTargets) {
      const score = await this.miniMax(
        game,
        depth,
        NEGATIVE_INFINITY,
        POSITIVE_INFINITY,
        move,
        block,
      );
      if (block && this.timeExceeded) {
        return [];
      }
      if (score > bestScore) {
        bestScore = score;
      }
      scored.push({ move, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, this.candidateCount);
  }


private async miniMax(
  game: Game,
  depth: number,
  alpha: number,
  beta: number,
  move: Move,
  block: boolean,
): Promise<number> {
    
    const isMaximizing = game.getCurrentPlayer() === this.rootColor;
    let bestScore = isMaximizing ? NEGATIVE_INFINITY : POSITIVE_INFINITY;
    let nextDepth = depth - 1;
    game.applyMoveForSearch(move);

    if (block && await this.isTimeUp()) {
      this.timeExceeded = true;
      const evalScore = this.evaluate(game);
      game.rollbackMoveForSearch();
      return evalScore;
    }

    const entry : TranspositionTableEntry = this.getTTEntry(game);

    const { orderedMovesTop, orderedMovesBottom, hasOnlyMove, onlyMove, isEnded, winner, staticScore } = entry;

    if (depth === 0) {
        bestScore = staticScore ?? this.evaluate(game);
        game.rollbackMoveForSearch();
        return bestScore;
    }
    if (isEnded) {
        bestScore = winner === this.rootColor ? POSITIVE_INFINITY : NEGATIVE_INFINITY;
        game.rollbackMoveForSearch();
        return bestScore;
    }

    if (hasOnlyMove && onlyMove) {
        nextDepth = depth;
        bestScore = await this.miniMax(game, nextDepth, alpha, beta, onlyMove, block);
        game.rollbackMoveForSearch();
        return bestScore;
    }

    if (isMaximizing) {
        for (const nextMove of orderedMovesTop ?? []) {
            const score = await this.miniMax(game, nextDepth, alpha, beta, nextMove, block);
            if (this.timeExceeded && block) {
              game.rollbackMoveForSearch();
              return bestScore;
            }
            if (score > bestScore) bestScore = score;
            if (score > alpha) alpha = score;
            if (alpha >= beta) break;
        }
        for (const nextMove of orderedMovesBottom ?? []) {
            if (alpha >= beta) break;
            const score = await this.miniMax(game, nextDepth, alpha, beta, nextMove, block);
            if (this.timeExceeded && block) {
              game.rollbackMoveForSearch();
              return bestScore;
            }
            if (score > bestScore) bestScore = score;
            if (score > alpha) alpha = score;
            if (alpha >= beta) break;
        }
    } else {
        for (const nextMove of orderedMovesTop ?? []) {
            const score = await this.miniMax(game, nextDepth, alpha, beta, nextMove, block);
            if (this.timeExceeded && block) {
              game.rollbackMoveForSearch();
              return bestScore;
            }
            if (score < bestScore) bestScore = score;
            if (score < beta) beta = score;
            if (alpha >= beta) break;
        }
        for (const nextMove of orderedMovesBottom ?? []) {
            if (alpha >= beta) break;
            const score = await this.miniMax(game, nextDepth, alpha, beta, nextMove, block);
            if (this.timeExceeded && block) {
              game.rollbackMoveForSearch();
              return bestScore;
            }
            if (score < bestScore) bestScore = score;
            if (score < beta) beta = score;
        }
    }

    game.rollbackMoveForSearch();
    return bestScore;
  }

  private getTTEntry(game: Game): TranspositionTableEntry {
    let newEntry : TranspositionTableEntry = {}
    const currentHash = game.getBoardHash();
    const entry : TranspositionTableEntry = this.tt.getEntry(currentHash) ?? {};
    if (entry.legalMoves !== undefined &&
        entry.orderedMovesTop !== undefined &&
        entry.orderedMovesBottom !== undefined &&
        entry.hasOnlyMove !== undefined &&
        entry.isEnded !== undefined &&
        entry.staticScore !== undefined) {
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
        newEntry.staticScore = winner === this.rootColor ? POSITIVE_INFINITY : winner === null ? 0 : NEGATIVE_INFINITY;
        newEntry.legalMoves = [];
        newEntry.orderedMovesTop = [];
        newEntry.orderedMovesBottom = [];
        newEntry.hasOnlyMove = false;
        return newEntry;
    } else {
        newEntry.isEnded = false;
        newEntry.staticScore = this.evaluate(game);
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
