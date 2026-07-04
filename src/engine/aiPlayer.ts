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
import { decodeMove, type MoveCode } from './moveCode';

export interface AIPlayerAPI {
  getNextMove(board: Board, color: Color, warmUp: boolean): Promise<Move | undefined>;
  interrupt(): void;
  clearTranspositionTable(): void;
}

// 탐색 내부에서는 무브를 압축 정수(MoveCode)로만 다룬다.
// 보드에 적용할 때만 decodeMove로 순수 Move({from,to,promotion})를 만들어 쓴다.
type ScoredMove = {
  move: MoveCode | undefined;
  score: number;
  minDepth: number;
};

const TIME_LIMIT_MS_EASY = 1000;
const TIME_LIMIT_MS_HARD = 10000;
const INITIAL_DEPTH_EASY = 2;
const INITIAL_DEPTH_HARD = 3;

const MAX_DEPTH_LIMIT_EASY = 6;
const MAX_DEPTH_LIMIT_HARD = 9;
const MIN_DEPTH_LIMIT_EASY = 2;
const MIN_DEPTH_LIMIT_HARD = 3;

const POSITIVE_INFINITY = Number.POSITIVE_INFINITY;
const NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY;

const BATCH_SIZE = 50;

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
    } else {
      // Hard
      this.timeLimitMs = TIME_LIMIT_MS_HARD;
      this.initialDepth = INITIAL_DEPTH_HARD;
    }

    this.initialDepth = this.clampDepth(this.initialDepth);
    this.initTimeChecker();
  }

  interrupt(): void {
    this.interrupted = true;
  }

  clearTranspositionTable(): void {
    this.tt.clear();
  }

  private yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 1));

  private innerIsTimeUp?: () => Promise<boolean>;

  private initTimeChecker() {
    let count = 0;
    this.innerIsTimeUp = async () => {
      count++;
      if (count >= BATCH_SIZE) {
        count = 0;
        await this.yieldToEventLoop();
        if (this.interrupted) {
          this.interrupted = false;
          return true;
        }
      }
      // 마감 확인은 매 호출 수행한다 (Date.now()는 저렴).
      // 배치 경계에서만 확인하면 노드 비용이 큰 기기(모바일)에서
      // 마감을 수 초씩 넘겨 턴이 설정 시간보다 훨씬 길어진다.
      return Date.now() >= this.deadlineMs;
    };
  }

  private async isTimeUp(): Promise<boolean> {
    if (!this.innerIsTimeUp) return false;
    return await this.innerIsTimeUp();
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
    if (warmUp) {
      this.deadlineMs = Date.now() + 10000000;
    } else {
      this.deadlineMs = Date.now() + this.timeLimitMs;
    }
    this.timeExceeded = false;

    let currentDepth = this.initialDepth;

    let baseSearchSucceeded = false;
    let extraSearchSucceeded = false;

    let bestMove: ScoredMove = await this.searchBestMove(
      game,
      currentDepth,
      NEGATIVE_INFINITY,
      POSITIVE_INFINITY,
    );

    if (!this.timeExceeded) baseSearchSucceeded = true;

    const maxDepth =
      this.difficulty === difficultyLevel.Easy ? MAX_DEPTH_LIMIT_EASY : MAX_DEPTH_LIMIT_HARD;
    while (currentDepth < maxDepth && !this.timeExceeded) {
      const nextDepth = currentDepth + 1;

      const deeperBestMove = await this.searchBestMove(
        game,
        nextDepth,
        NEGATIVE_INFINITY,
        POSITIVE_INFINITY,
      );

      if (!this.timeExceeded) extraSearchSucceeded = true;

      currentDepth = nextDepth;
      // 마감으로 중단된 깊은 탐색이 수를 못 정했다면 얕은 탐색의 결과를 유지한다
      if (deeperBestMove.move !== undefined) bestMove = deeperBestMove;
    }

    if (!warmUp && extraSearchSucceeded) {
      this.initialDepth = this.clampDepth(this.initialDepth + 1);
    } else if (!warmUp && !baseSearchSucceeded) {
      this.initialDepth = this.clampDepth(this.initialDepth - 1);
    }

    if (warmUp) return undefined;
    if (bestMove.move !== undefined) return decodeMove(bestMove.move);

    // 마감 직후 중단 등으로 수를 정하지 못한 경우의 방어 폴백.
    // 종료된 포지션은 기존대로 undefined를 반환한다.
    const isEndedPosition =
      game.isOnlyKingLeft(color) ||
      game.checkForCheckmate(color).isInCheckmate ||
      game.isStalemate(color) ||
      game.isLoneIsland(color);
    if (isEndedPosition) return undefined;
    const legalCodes = game.getLegalMoveCodes(color);
    if (legalCodes.length === 0) return undefined;
    return decodeMove(legalCodes[Math.floor(Math.random() * legalCodes.length)]);
  }

  private async searchBestMove(
    game: Game,
    depth: number,
    alpha: number,
    beta: number,
  ): Promise<ScoredMove> {
    if (await this.isTimeUp()) this.timeExceeded = true;

    // 마감이 지났으면 자식 확장(getTTEntry의 이동 생성/정렬)을 생략하고 즉시 되돌아간다.
    // 이 확장이 노드당 가장 비싼 작업이라, 생략하지 않으면 되감기만으로 수 초를 더 쓴다.
    if (this.timeExceeded) {
      const existing = this.tt.getEntry(game.getBoardHash());
      const existingTrust = existing?.depth ?? 0;
      if (existing && existingTrust > 0 && existing.score !== undefined) {
        return { move: existing.bestMove, score: existing.score, minDepth: existingTrust };
      }
      return { move: undefined, score: this.evaluate(game), minDepth: 0 };
    }

    const currentEntry: TranspositionTableEntry = this.getTTEntry(game);
    const currentEntryTrust = currentEntry.depth ?? 0;
    if (
      currentEntryTrust >= depth &&
      currentEntry.bestMove !== undefined &&
      currentEntry.score !== undefined
    ) {
      return {
        move: currentEntry.bestMove,
        score: currentEntry.score,
        minDepth: currentEntryTrust,
      } as ScoredMove;
    }

    if (currentEntry.isEnded) {
      let endedScoredMove: ScoredMove = { move: undefined, score: 0, minDepth: depth };
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

    if (
      (currentEntry.hasOnlyMove === undefined || currentEntry.hasOnlyMove === false) &&
      (depth <= 0 || this.timeExceeded)
    ) {
      if (currentEntryTrust > 0) {
        return {
          move: currentEntry.bestMove,
          score: currentEntry.score ?? 0,
          minDepth: currentEntryTrust,
        } as ScoredMove;
      }
      const leafScoredMove: ScoredMove = {
        move: undefined,
        score: this.evaluate(game),
        minDepth: 0,
      };
      this.setTTDepthInfo(game, 0, leafScoredMove.score);
      return leafScoredMove;
    }

    const isMaximizing = game.getCurrentPlayer() === this.rootColor;
    let nextTopMoves: MoveCode[] = [];
    let trustDepth = depth;
    let bestScore: EvaluationScore = isMaximizing ? NEGATIVE_INFINITY : POSITIVE_INFINITY;

    let onlyTarget: MoveCode[] = [];
    if (currentEntry.hasOnlyMove && currentEntry.onlyMove !== undefined) {
      onlyTarget = [currentEntry.onlyMove];
    }
    const primarySearchTargets: MoveCode[] =
      currentEntry.orderedMovesTop ?? currentEntry.legalMoves ?? [];
    const secondarySearchTargets: MoveCode[] = currentEntry.orderedMovesBottom ?? [];

    for (const moveCode of onlyTarget) {
      const nextDepth = depth;
      game.applyMoveForSearch(decodeMove(moveCode));
      const { score, minDepth } = await this.searchBestMove(game, nextDepth, alpha, beta);
      game.rollbackMoveForSearch();
      bestScore = score;
      trustDepth = minDepth;
      nextTopMoves.push(moveCode);
    }

    for (const moveCode of primarySearchTargets) {
      if (alpha >= beta) break;
      if (this.timeExceeded) break;
      const nextDepth = depth - 1;
      game.applyMoveForSearch(decodeMove(moveCode));
      const { score, minDepth } = await this.searchBestMove(game, nextDepth, alpha, beta);
      game.rollbackMoveForSearch();
      if (trustDepth > minDepth + 1) trustDepth = Math.floor(minDepth + 1);
      if (isMaximizing) {
        if (score > bestScore) {
          bestScore = score;
          nextTopMoves = [moveCode];
          alpha = score;
        } else if (score === bestScore) {
          nextTopMoves.push(moveCode);
        }
      } else {
        if (score < bestScore) {
          bestScore = score;
          nextTopMoves = [moveCode];
          beta = score;
        } else if (score === bestScore) {
          nextTopMoves.push(moveCode);
        }
      }
    }

    for (const moveCode of secondarySearchTargets) {
      if (alpha >= beta) break;
      if (this.timeExceeded) break;
      const nextDepth = depth - 2;
      game.applyMoveForSearch(decodeMove(moveCode));
      const { score, minDepth } = await this.searchBestMove(game, nextDepth, alpha, beta);
      game.rollbackMoveForSearch();
      if (trustDepth > minDepth + 2) trustDepth = Math.floor(minDepth + 2);
      if (isMaximizing) {
        if (score > bestScore) {
          bestScore = score;
          nextTopMoves = [moveCode];
          alpha = score;
        } else if (score === bestScore) {
          nextTopMoves.push(moveCode);
        }
      } else {
        if (score < bestScore) {
          bestScore = score;
          nextTopMoves = [moveCode];
          beta = score;
        } else if (score === bestScore) {
          nextTopMoves.push(moveCode);
        }
      }
    }

    if (this.timeExceeded) {
      trustDepth += 0.5;
      if (currentEntryTrust > trustDepth) {
        trustDepth = currentEntryTrust;
        bestScore = currentEntry.score ?? 0;
        nextTopMoves = currentEntry.bestMove !== undefined ? [currentEntry.bestMove] : [];
      }
    }
    let bestMove: MoveCode | undefined;

    if (nextTopMoves.length === 0) {
      bestMove = undefined;
    } else if (nextTopMoves.length === 1) {
      bestMove = nextTopMoves[0];
    } else {
      bestMove = nextTopMoves[Math.floor(Math.random() * nextTopMoves.length)];
    }

    this.setTTDepthInfo(game, alpha >= beta ? 0.5 : trustDepth, bestScore, bestMove);

    return { move: bestMove, score: bestScore, minDepth: trustDepth } as ScoredMove;
  }

  private getTTEntry(game: Game): TranspositionTableEntry {
    let newEntry: TranspositionTableEntry = {};
    const currentHash = game.getBoardHash();
    const entry: TranspositionTableEntry = this.tt.getEntry(currentHash) ?? {};
    if (
      entry.legalMoves !== undefined &&
      entry.orderedMovesTop !== undefined &&
      entry.orderedMovesBottom !== undefined &&
      entry.hasOnlyMove !== undefined &&
      entry.isEnded !== undefined
    ) {
      this.ttHitCount++;
      return entry;
    }

    const currentPlayer = game.getCurrentPlayer();
    const isInCheckmate = game.checkForCheckmate(currentPlayer).isInCheckmate;
    const isStalemate = game.isStalemate(currentPlayer);
    const isLoneIsland = game.isLoneIsland(currentPlayer);
    const isOnlyKingLeft = game.isOnlyKingLeft(currentPlayer);
    const isEnded = isInCheckmate || isStalemate || isLoneIsland || isOnlyKingLeft;
    const endReason = isInCheckmate
      ? GameEndReason.Checkmate
      : isStalemate
        ? GameEndReason.Stalemate
        : isLoneIsland
          ? GameEndReason.LoneIsland
          : isOnlyKingLeft
            ? GameEndReason.OnlyKingLeft
            : undefined;
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

    // MoveCode 배열은 불변으로만 취급하므로 복사 없이 공유해도 안전하다
    newEntry.legalMoves = entry.legalMoves ?? game.getLegalMoveCodes(game.getCurrentPlayer());
    if (newEntry.legalMoves.length === 1) {
      newEntry.hasOnlyMove = true;
      newEntry.onlyMove = newEntry.legalMoves[0];
      newEntry.orderedMovesTop = [];
      newEntry.orderedMovesBottom = [];
    } else {
      newEntry.hasOnlyMove = false;
    }

    const newOrderedMovesTop: MoveCode[] = [];
    const countRecord: Record<number, MoveCode[]> = {};
    const newOrderedMovesBottom: MoveCode[] = [];

    for (const moveCode of newEntry.legalMoves) {
      game.applyMoveForSearch(decodeMove(moveCode));
      const nextHash = game.getBoardHash();
      const nextEntry: TranspositionTableEntry = this.tt.getEntry(nextHash) ?? {};
      let nextLegalMoves: MoveCode[] = [];
      if (nextEntry.legalMoves) {
        nextLegalMoves = nextEntry.legalMoves;
      } else {
        nextLegalMoves = game.getLegalMoveCodes(game.getCurrentPlayer());
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
        countRecord[count].push(moveCode);
      } else {
        newOrderedMovesBottom.push(moveCode);
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

  private setTTDepthInfo(
    game: Game,
    depth: number,
    score: EvaluationScore,
    bestMove?: MoveCode,
  ): void {
    const currentHash = game.getBoardHash();
    const entry: TranspositionTableEntry = this.tt.getEntry(currentHash) ?? {};
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
