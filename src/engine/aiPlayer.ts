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
  getNextMove(board: Board, color: Color): Move;
}

const TIME_LIMIT_MS_EASY = 300;
const TIME_LIMIT_MS_HARD = 500;
const INITIAL_DEPTH_EASY = 5;
const INITIAL_DEPTH_HARD = 7;
const CANDIDATE_COUNT_EASY = 10;
const CANDIDATE_COUNT_HARD = 20;

const MAX_DEPTH_LIMIT_EASY = 7;
const MAX_DEPTH_LIMIT_HARD = 10;
const MIN_DEPTH_LIMIT_EASY = 2;
const MIN_DEPTH_LIMIT_HARD = 4;

const POSITIVE_INFINITY = Number.POSITIVE_INFINITY;
const NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY;

export class AIPlayer implements AIPlayerAPI {
  private timeLimitMs: number;
  private initialDepth: number;
  private candidateCount: number;

  private readonly tt: TranspositionTable;
  private timeExceeded: boolean = false;
  private deadlineMs: number = 0;
  private rootColor: Color = Color.White;
  private readonly difficulty: DifficultyLevel;

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

    // 난이도별 baseDepth 범위 강제
    this.initialDepth = this.clampDepth(this.initialDepth);
  }

  private isTimeUp(): boolean {
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

  getNextMove(board: Board, color: Color): Move {
    const game = new Game(board, color);

    this.rootColor = color;
    this.deadlineMs = Date.now() + this.timeLimitMs;
    this.timeExceeded = false;

    let currentDepth = this.initialDepth;
    let topMoves = this.searchBestMoves(game, currentDepth, false, undefined);

    if (topMoves.length === 0) {
      throw new Error('No legal moves available for AI.');
    }

    let extraSearchSucceeded = false;

    while (!this.isTimeUp()) {
      this.timeExceeded = false;
      const nextDepth = currentDepth + 1;

      const deeperTopMoves = this.searchBestMoves(game, nextDepth, true, topMoves);

      if (this.timeExceeded) break;
      
      currentDepth = nextDepth;
      topMoves = deeperTopMoves;
      extraSearchSucceeded = true;
    }

    if (extraSearchSucceeded) {
      this.initialDepth = this.clampDepth(this.initialDepth + 1);
    } else if (this.isTimeUp()) {
      this.initialDepth = this.clampDepth(this.initialDepth - 1);
    }

    return topMoves[0];
  }


  private searchBestMoves(
    game: Game,
    depth: number,
    block: boolean,
    topMoves?: Move[],
  ): Move[] {
    const currentPlayer = game.getCurrentPlayer();

    if (block && this.isTimeUp()) {
      this.timeExceeded = true;
      return [];
    }

    const searchTargets = topMoves ?? game.getLegalMoves(currentPlayer);
    
    if (searchTargets.length === 0) {
      return [];
    }

    let bestScore = NEGATIVE_INFINITY;
    let result : Move[] = [];
    for (const move of searchTargets) {
        const score = this.miniMax(game, depth, NEGATIVE_INFINITY, POSITIVE_INFINITY, move, block);
        if (block && this.timeExceeded) {
          return [];
        }
        if (score >= bestScore) {
            bestScore = score;
            result.push(move);
        }
    }

    return result.slice(0, this.candidateCount);
}


private miniMax(
  game: Game,
  depth: number,
  alpha: number,
  beta: number,
  move: Move,
  block: boolean,
): number {
    
    const isMaximizing = game.getCurrentPlayer() === this.rootColor;
    let bestScore = isMaximizing ? NEGATIVE_INFINITY : POSITIVE_INFINITY;
    let nextDepth = depth - 1;
    game.applyMoveForSearch(move);

    if (block && this.isTimeUp()) {
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
        bestScore = this.miniMax(game, nextDepth, alpha, beta, onlyMove, block);
        game.rollbackMoveForSearch();
        return bestScore;
    }

    if (isMaximizing) {
        for (const nextMove of orderedMovesTop ?? []) {
            const score = this.miniMax(game, nextDepth, alpha, beta, nextMove, block);
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
            const score = this.miniMax(game, nextDepth, alpha, beta, nextMove, block);
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
            const score = this.miniMax(game, nextDepth, alpha, beta, nextMove, block);
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
            const score = this.miniMax(game, nextDepth, alpha, beta, nextMove, block);
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
        entry.staticScore !== undefined) return entry;


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
