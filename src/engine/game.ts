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
} from './types';
import type { Move, Piece, Location } from './types';

export interface GameAPI {
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
  getBoard(): Board;
  getCurrentPlayer(): Color;
  getWinner(): Color | null;
  getEndReason(): GameEndReason | null;
  startGame(): { success: boolean; error?: GameError };
  getLegalMoves(color: Color): Move[];
  checkForCheck(color: Color): { isInCheck: boolean; checkers: Piece[] };
  checkForCheckmate(color: Color): { isInCheckmate: boolean; checkers: Piece[] };
  isStalemate(color: Color): boolean;
  isLoneIsland(color: Color): boolean;
  isOnlyKingLeft(color: Color): boolean;
}

export class Game implements GameAPI {
  private board: Board;
  private currentPlayer: Color;
  private winner: Color | null;
  private state: GameState;
  private history: Move[];
  private turnCount: number;
  private endReason: GameEndReason | null;
  private cachedLegalMoves: Partial<Record<number, Move[]>>;
  private cachedCheck: Partial<Record<number, { isInCheck: boolean; checkers: Piece[] }>>;

  constructor(board?: Board, currentPlayer?: Color) {
    this.board = board ?? new Board();
    this.currentPlayer = currentPlayer ?? Color.Black;
    this.winner = null;
    this.endReason = null;
    this.state = GameState.Initial;
    this.turnCount = 0;
    this.history = [];
    this.cachedLegalMoves = {};
    this.cachedCheck = {};
  }

  private switchPlayer(): void {
    this.currentPlayer = reverseColor(this.currentPlayer);
    this.turnCount++;
  }

  private applyPromotionToMove(move: Move): Move[] {
    const isPawn: boolean = move.piece?.type === PieceType.Pawn;
    const isPromotionRank: boolean = move.piece?.color === Color.White ? move.to.rank === Rank.Rank8 : move.to.rank === Rank.Rank1;
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

  private generateCandidateMoves(color: Color): Move[] {
    const ownPieces = this.board.getAllPieces(color);

    const captureMoves: Move[] = [];
    const quietMoves: Move[] = [];

    for (const piece of ownPieces) {
      if (!piece.location) continue;

      const destinations = this.board.getMovableLocations(piece);
      for (const to of destinations) {
        const move = this.makeMove(piece.location, to);
        if (!move) continue;
        if (move.captured) {
          captureMoves.push(move);
        } else {
          quietMoves.push(move);
        }
      }
    }

    const CandidateMoves = captureMoves.length > 0 ? captureMoves : quietMoves;

    const promotedMoves = CandidateMoves.flatMap((move) => this.applyPromotionToMove(move));

    return promotedMoves;
  }

  getBoard(): Board {
    return this.board;
  }

  getCurrentPlayer(): Color {
    return this.currentPlayer;
  }

  startGame(): { success: boolean; error?: GameError } {
    if (this.state !== GameState.Initial) {
      return { success: false, error: GameError.GameAlreadyStarted };
    }
    this.state = GameState.InPlay;
    return { success: true };
  }

  getWinner(): Color | null {
    return this.winner;
  }

  getEndReason(): GameEndReason | null {
    return this.endReason;
  }

  private finishGame(winner: Color | null, endReason: GameEndReason): void {
    this.winner = winner;
    this.endReason = endReason;
    this.state = GameState.Finished;
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

    const opponent = reverseColor(color);

    if (color !== this.currentPlayer) {
      error = GameError.NotYourTurn;
      return { success, end, winner, error, endReason };
    }

    const fromKey = locationToKey(from);
    const toKey = locationToKey(to);
    const legalMoves = this.getLegalMoves(color);
    const move = legalMoves.find(
      (m) => locationToKey(m.from) === fromKey && locationToKey(m.to) === toKey && m.promotion === realPromotion,
    );
    if (!move) {
      error = GameError.InvalidMove;
      return { success, end, winner, error, endReason };
    }

    success = true;
    this.applyMove(move);
    this.history.push(move);
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

  getLegalMoves(color: Color): Move[] {
    const turn = this.turnCount;
    const isCurrentPlayer = color === this.currentPlayer;
    const cached = this.cachedLegalMoves[turn];

    if (isCurrentPlayer && cached) return cached;

    const legalMoves = this.getLegalMovesNoCache(color);

    if (isCurrentPlayer) {
      this.cachedLegalMoves[turn] = legalMoves;
    }
    return legalMoves;
  }

  getLegalMovesNoCache(color: Color): Move[] {
    const candidateMoves = this.generateCandidateMoves(color);
    return candidateMoves.filter((move) => !this.checkForNextCheck(move, color));
  }

  checkForCheck(color: Color): { isInCheck: boolean; checkers: Piece[] } {
    const turn = this.turnCount;
    const cached = this.cachedCheck[turn];
    if (color === this.currentPlayer && cached) return cached;

    const result = this.checkForCheckByBoard(this.board, color);

    if (color === this.currentPlayer) {
      this.cachedCheck[turn] = result;
    }
    return result;
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
    };
  }

  private applyMove(move: Move): void {
    const piece = move.piece ?? this.board.getPieceByLocation(move.from);
    if (!piece) {
      return;
    }

    move.piece = piece;

    const captured = this.board.movePiece(piece, move.to);
    move.captured = captured ?? move.captured ?? null;

    if (move.promotion) {
      this.board.changePieceType(piece, move.promotion);
    }
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
    const opponent = reverseColor(color);
    const kingPieces = board.getAllPiecesByPieceKey(`${color}_${PieceType.King}`);

    const kingLocations = kingPieces
      .map((p) => p.location)
      .filter((location) => location !== undefined);
    if (kingLocations.length === 0) {
      return { isInCheck: false, checkers: [] };
    }

    const attackers = board
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
}
