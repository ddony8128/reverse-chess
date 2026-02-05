import { Board } from './board';
import {
  Color,
  GameState,
  PieceType,
  reverseColor,
  GameError,
  locationToKey,
  GameEndReason,
  Rank,
  type LocationKey,
} from './types';
import type { Move, Piece, Location } from './types';
import { computeZobristHash, toggleSideToMove, type ZobristHash } from '@/lib/zobristHash';

export interface GameAPI {
  getBoard(): Board;
  getCurrentPlayer(): Color;
  getWinner(): Color | null;
  getBoardHash(): ZobristHash;
  getEndReason(): GameEndReason | null;

  startGame(): { success: boolean; error?: GameError };
  progressTurn(
    color: Color,
    from: Location,
    to: Location,
    promotion?: PieceType,
  ): {
    success: boolean;
    end: boolean;
    winner?: Color | null;
    error?: GameError;
    endReason?: GameEndReason;
  };

  getLegalMoves(color: Color): Move[];

  isCaptureForced(): boolean;
  checkForCheck(color: Color): { isInCheck: boolean; checkers: Piece[] };

  checkForCheckmate(color: Color): { isInCheckmate: boolean; checkers: Piece[] };
  isStalemate(color: Color): boolean;
  isLoneIsland(color: Color): boolean;
  isOnlyKingLeft(color: Color): boolean;

  applyMoveForSearch(move: Move): void;
  rollbackMoveForSearch(): void;
}

export class Game implements GameAPI {
  private board: Board;

  private currentPlayer: Color;
  private winner: Color | null;
  private turnCount: number;
  private state: GameState;
  private endReason: GameEndReason | null;

  private history: Move[];
  private cachedLegalMoves: Map<ZobristHash, Move[]>;
  private cachedCaptureForced: Map<ZobristHash, boolean>;
  private cachedCheck: Map<ZobristHash, { isInCheck: boolean; checkers: Piece[] }>;

  private boardHash: ZobristHash;

  constructor(board?: Board, currentPlayer?: Color) {
    this.board = board ?? new Board();

    this.currentPlayer = currentPlayer ?? Color.Black;
    this.winner = null;
    this.turnCount = 0;
    this.state = GameState.Initial;
    this.endReason = null;

    this.history = [];
    this.cachedLegalMoves = new Map();
    this.cachedCaptureForced = new Map();
    this.cachedCheck = new Map();

    this.boardHash = computeZobristHash(this.board, this.currentPlayer);
  }

  getBoard(): Board {
    return this.board;
  }

  getCurrentPlayer(): Color {
    return this.currentPlayer;
  }

  getWinner(): Color | null {
    return this.winner;
  }

  getBoardHash(): ZobristHash {
    return this.boardHash;
  }

  getEndReason(): GameEndReason | null {
    return this.endReason;
  }

  startGame(): { success: boolean; error?: GameError } {
    if (this.state !== GameState.Initial) {
      return { success: false, error: GameError.GameAlreadyStarted };
    }
    this.state = GameState.InPlay;
    return { success: true };
  }

  progressTurn(
    color: Color,
    from: Location,
    to: Location,
    promotion?: PieceType,
  ): {
    success: boolean;
    end: boolean;
    winner?: Color | null;
    error?: GameError;
    endReason?: GameEndReason;
  } {
    let success: boolean = false;
    let end: boolean = false;
    let winner: Color | null = null;
    let error: GameError | undefined;
    let endReason: GameEndReason | undefined;
    let realPromotion: PieceType | null = promotion ?? null;

    const opponent: Color = reverseColor(color);

    if (color !== this.currentPlayer) {
      error = GameError.NotYourTurn;
      return { success, end, winner, error, endReason };
    }

    if (this.state === GameState.Initial) {
      error = GameError.GameNotStarted;
      return { success, end, winner, error, endReason };
    }

    if (this.state === GameState.Finished) {
      error = GameError.GameFinished;
      return { success, end, winner, error, endReason };
    }

    const fromKey: LocationKey = locationToKey(from);
    const toKey: LocationKey = locationToKey(to);
    const legalMoves: Move[] = this.getLegalMoves(color);
    const move: Move | undefined = legalMoves.find(
      (m) =>
        locationToKey(m.from) === fromKey &&
        locationToKey(m.to) === toKey &&
        m.promotion === realPromotion,
    );
    if (move === undefined) {
      error = GameError.InvalidMove;
      return { success, end, winner, error, endReason };
    }

    const appliedMove = this.applyMove(move);
    if (appliedMove === null) {
      error = GameError.InvalidMove;
      return { success, end, winner, error, endReason };
    }

    success = true;
    this.history.push(appliedMove);
    this.switchPlayer();

    const isOnlyKingLeft = this.isOnlyKingLeft(opponent);
    if (isOnlyKingLeft) {
      end = true;
      winner = opponent;
      endReason = GameEndReason.OnlyKingLeft;
      this.finishGame(opponent, GameEndReason.OnlyKingLeft);
      return { success, end, winner, error, endReason };
    }

    const { isInCheckmate } = this.checkForCheckmate(opponent);
    if (isInCheckmate) {
      end = true;
      winner = opponent;
      endReason = GameEndReason.Checkmate;
      this.finishGame(opponent, GameEndReason.Checkmate);
      return { success, end, winner, error, endReason };
    }
    const isStalemate = this.isStalemate(opponent);
    if (isStalemate) {
      end = true;
      winner = null;
      endReason = GameEndReason.Stalemate;
      this.finishGame(null, GameEndReason.Stalemate);
      return { success, end, winner, error, endReason };
    }

    const isLoneIsland = this.isLoneIsland(opponent);
    if (isLoneIsland) {
      end = true;
      winner = opponent;
      endReason = GameEndReason.LoneIsland;
      this.finishGame(opponent, GameEndReason.LoneIsland);
      return { success, end, winner, error, endReason };
    }

    return { success, end, winner, error, endReason };
  }

  private switchPlayer(): void {
    this.currentPlayer = reverseColor(this.currentPlayer);
    this.turnCount++;
    this.boardHash = computeZobristHash(this.board, this.currentPlayer);
  }

  private finishGame(winner: Color | null, endReason: GameEndReason): void {
    this.winner = winner;
    this.endReason = endReason;
    this.state = GameState.Finished;
  }

  getLegalMoves(color: Color): Move[] {
    const isCurrentPlayer = color === this.currentPlayer;
    const key = isCurrentPlayer ? this.boardHash : toggleSideToMove(this.boardHash);
    const cached = this.cachedLegalMoves.get(key);

    if (cached !== undefined) return cached;

    const { captureMoves, quietMoves } = this.generateCandidateMoves(color);

    if (captureMoves.length > 0) {
      this.cachedLegalMoves.set(key, captureMoves);
      this.cachedCaptureForced.set(key, true);
      return captureMoves;
    }
    this.cachedLegalMoves.set(key, quietMoves);
    this.cachedCaptureForced.set(key, false);
    return quietMoves;
  }

  isCaptureForced(): boolean {
    const key = this.boardHash;
    const cached = this.cachedCaptureForced.get(key);
    if (cached !== undefined) return cached;

    const { captureMoves, quietMoves } = this.generateCandidateMoves(this.currentPlayer);
    if (captureMoves.length > 0) {
      this.cachedLegalMoves.set(key, captureMoves);
      this.cachedCaptureForced.set(key, true);
      return true;
    }
    this.cachedLegalMoves.set(key, quietMoves);
    this.cachedCaptureForced.set(key, false);
    return false;
  }

  checkForCheck(color: Color): { isInCheck: boolean; checkers: Piece[] } {
    const isCurrentPlayer: boolean = color === this.currentPlayer;
    const key: ZobristHash = isCurrentPlayer ? this.boardHash : toggleSideToMove(this.boardHash);

    const cached: { isInCheck: boolean; checkers: Piece[] } | undefined = this.cachedCheck.get(key);
    if (cached !== undefined) return cached;

    const result = this.checkForCheckByBoard(this.board, color);

    this.cachedCheck.set(key, result);

    return result;
  }

  private applyPromotionToMove(move: Move): Move[] {
    const isPawn: boolean = move.piece?.type === PieceType.Pawn;
    const isPromotionRank: boolean =
      move.piece?.color === Color.White ? move.to.rank === Rank.Rank8 : move.to.rank === Rank.Rank1;
    if (isPawn && isPromotionRank) {
      return [
        { ...move, promotion: PieceType.Queen },
        { ...move, promotion: PieceType.Rook },
        { ...move, promotion: PieceType.Bishop },
        { ...move, promotion: PieceType.Knight },
      ];
    }
    return [move];
  }

  private generateCandidateMoves(color: Color): { captureMoves: Move[]; quietMoves: Move[] } {
    const ownPieces: Piece[] = this.board.getAllPieces(color);
    const captureMoves: Move[] = [];
    const quietMoves: Move[] = [];

    for (const piece of ownPieces) {
      if (!piece.location) continue;

      const destinations: Location[] = this.board.getMovableLocations(piece);
      for (const to of destinations) {
        const move: Move | null = this.makeMove(piece.location, to);
        if (move === null) continue;
        if (move.captured) {
          captureMoves.push(move);
        } else {
          quietMoves.push(move);
        }
      }
    }

    const promotedCaptureMoves: Move[] = captureMoves.flatMap((move) =>
      this.applyPromotionToMove(move),
    );
    const promotedQuietMoves: Move[] = quietMoves.flatMap((move) =>
      this.applyPromotionToMove(move),
    );

    const filteredCaptureMoves: Move[] = promotedCaptureMoves.filter(
      (move) => !this.checkForNextCheck(move, color),
    );
    const filteredQuietMoves: Move[] = promotedQuietMoves.filter(
      (move) => !this.checkForNextCheck(move, color),
    );

    return { captureMoves: filteredCaptureMoves, quietMoves: filteredQuietMoves };
  }

  private checkForNextCheck(move: Move, color: Color): boolean {
    this.applyMove(move);
    const { isInCheck } = this.checkForCheckByBoard(this.board, color);
    this.rollbackMove(move);
    return isInCheck;
  }

  private checkForCheckByBoard(
    board: Board,
    color: Color,
  ): { isInCheck: boolean; checkers: Piece[] } {
    const opponent: Color = reverseColor(color);
    const kingPieces: Piece[] = board.getAllPiecesByPieceKey(`${color}_${PieceType.King}`);

    const kingLocations: (Location | undefined)[] = kingPieces
      .map((p) => p.location)
      .filter((location) => location !== undefined);
    if (kingLocations.length === 0) {
      return { isInCheck: false, checkers: [] };
    }

    const attackers: Piece[] = board
      .getAllPieces(opponent)
      .filter(
        (p) =>
          p.location &&
          kingLocations.some((location) => board.canPieceAttackLocation(p, location!)),
      );

    return {
      isInCheck: attackers.length > 0,
      checkers: attackers,
    };
  }

  checkForCheckmate(color: Color): {
    isInCheckmate: boolean;
    checkers: Piece[];
  } {
    const { isInCheck, checkers } = this.checkForCheck(color);
    const legalMoves = this.getLegalMoves(color);
    return {
      isInCheckmate: isInCheck && legalMoves.length === 0,
      checkers,
    };
  }

  isStalemate(color: Color): boolean {
    const { isInCheck } = this.checkForCheck(color);
    const legalMoves = this.getLegalMoves(color);
    return !isInCheck && legalMoves.length === 0;
  }

  isLoneIsland(color: Color): boolean {
    const { isInCheck } = this.checkForCheck(color);
    if (isInCheck) {
      return false;
    }
    const legalMoves = this.getLegalMoves(color);
    if (legalMoves.length === 0) {
      return false;
    }

    const kingMovesWithoutCapture = legalMoves
      .filter((move) => move.piece?.type === PieceType.King)
      .filter((move) => move.captured === undefined || move.captured === null);

    return kingMovesWithoutCapture.length === legalMoves.length;
  }

  isOnlyKingLeft(color: Color): boolean {
    const pieces = this.board.getAllPieces(color);
    const nonKing = pieces.filter((p) => p.type !== PieceType.King);
    return nonKing.length === 0;
  }

  private makeMove(from: Location, to: Location, promotion?: PieceType): Move | null {
    const piece = this.board.getPieceByLocation(from);
    if (!piece) {
      return null;
    }

    const captured = this.board.getPieceByLocation(to);

    if (promotion && promotion === PieceType.King) {
      return null;
    }

    return {
      from,
      to,
      piece,
      captured,
      promotion: promotion ?? null,
    } as Move;
  }

  private applyMove(move: Move): Move | null {
    const piece = move.piece ?? this.board.getPieceByLocation(move.from);
    if (!piece) {
      return null;
    }

    move.piece = piece;

    const captured = this.board.movePiece(piece, move.to);
    move.captured = captured ?? move.captured ?? null;

    if (move.promotion) {
      this.board.changePieceType(piece, move.promotion);
    }

    this.boardHash = computeZobristHash(this.board, this.currentPlayer);
    return move;
  }

  private rollbackMove(move: Move): void {
    const piece = move.piece;
    if (!piece) {
      return;
    }

    if (move.promotion) {
      this.board.changePieceType(piece, PieceType.Pawn);
    }

    this.board.movePiece(piece, move.from);

    if (move.captured) {
      this.board.setPiece(move.to, move.captured);
    }

    this.boardHash = computeZobristHash(this.board, this.currentPlayer);
  }

  applyMoveForSearch(move: Move): void {
    const appliedMove = this.applyMove(move);
    if (!appliedMove) {
      return;
    }
    this.history.push(appliedMove);
    this.switchPlayer();
  }

  rollbackMoveForSearch(): void {
    const move = this.history.pop();
    if (!move) {
      return;
    }
    this.switchPlayer();
    this.rollbackMove(move);
  }
}
