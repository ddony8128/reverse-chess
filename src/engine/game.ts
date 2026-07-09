import { Board } from './board';
import {
  Color,
  GameState,
  PieceType,
  reverseColor,
  GameError,
  GameEndReason,
  Rank,
  fileToIndex,
  rankToIndex,
} from './types';
import type { Move, Piece, Location } from './types';
import { computeZobristHash, toggleSideToMove, type ZobristHash } from '@/lib/zobristHash';

/**
 * 50수 규칙: 캡처·폰 이동 없이 이 플라이 수(양측 합산)에 도달하면 무승부.
 * 표준 체스의 "50수"는 양측 각 50수이므로 100플라이.
 */
export const FIFTY_MOVE_LIMIT_PLIES = 100;

/**
 * 저장/복원용 규칙 상태. 현재 포지션(배치+차례)은 보드에서 파생되므로 제외한다.
 * repetitionCounts는 현재 포지션을 포함한 (포지션 해시 → 등장 횟수) 목록.
 */
export type RuleState = {
  halfmoveClock: number;
  repetitionCounts?: ReadonlyArray<readonly [ZobristHash, number]>;
};
import {
  encodeMove,
  encodeMoveParts,
  encodeSquare,
  decodeMove,
  decodeSquare,
  type MoveCode,
} from './moveCode';

export interface GameAPI {
  getBoard(): Board;
  getCurrentPlayer(): Color;
  getWinner(): Color | null;
  getBoardHash(): ZobristHash;
  getEndReason(): GameEndReason | null;
  getHalfmoveClock(): number;
  getRepetitionCounts(): ReadonlyArray<readonly [ZobristHash, number]>;
  isThreefoldRepetition(): boolean;
  isFiftyMoveDraw(): boolean;

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
  getLegalMoveCodes(color: Color): MoveCode[];

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
  static readonly MAX_CACHED_POSITIONS = 30000;

  private readonly searchCacheLimit: number;
  private board: Board;

  private currentPlayer: Color;
  private winner: Color | null;
  private turnCount: number;
  private state: GameState;
  private endReason: GameEndReason | null;

  private history: Move[];
  // 탐색 캐시는 객체 그래프(Move/Piece 참조)가 아닌 압축 정수만 담는다.
  // 참조가 없으므로 지나간 탐색의 보드 객체를 붙잡아 두지 않는다.
  private cachedLegalMoveCodes: Map<ZobristHash, MoveCode[]>;
  private cachedCaptureForced: Map<ZobristHash, boolean>;
  private cachedCheck: Map<ZobristHash, { isInCheck: boolean; checkerSquares: number[] }>;

  private boardHash: ZobristHash;

  // 무승부 규칙 상태. 탐색 캐시(cachedLegalMoveCodes 등)와 달리 지우면 오답이 되는
  // 게임 규칙 상태이므로 OOM 가드(prepareSearchCacheSlot)의 대상이 아니며,
  // 실게임 플라이 수만큼만 자라므로 상한도 두지 않는다.
  // progressTurn 경로에서만 갱신한다 — 탐색(applyMoveForSearch)과
  // 합법수 probe(applyMove)는 규칙 상태를 건드리지 않는다.
  private halfmoveClock: number;
  private positionCounts: Map<ZobristHash, number>;

  constructor(
    board?: Board,
    currentPlayer?: Color,
    searchCacheLimit?: number,
    ruleState?: RuleState,
  ) {
    this.searchCacheLimit = searchCacheLimit ?? Game.MAX_CACHED_POSITIONS;
    this.board = board ?? new Board();

    this.currentPlayer = currentPlayer ?? Color.Black;
    this.winner = null;
    this.turnCount = 0;
    this.state = GameState.Initial;
    this.endReason = null;

    this.history = [];
    this.cachedLegalMoveCodes = new Map();
    this.cachedCaptureForced = new Map();
    this.cachedCheck = new Map();

    this.boardHash = computeZobristHash(this.board, this.currentPlayer);

    this.halfmoveClock = ruleState?.halfmoveClock ?? 0;
    this.positionCounts = new Map(ruleState?.repetitionCounts ?? []);
    // 불변식: 현재 포지션은 항상 1회 이상으로 계산돼 있어야 한다 (FIDE: 시작 포지션도 1회).
    // 복원 데이터가 빈 배열이거나 현재 포지션을 누락해도 여기서 자가 보정된다.
    if ((this.positionCounts.get(this.boardHash) ?? 0) === 0) {
      this.bumpPositionCount(this.boardHash);
    }
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

  getHalfmoveClock(): number {
    return this.halfmoveClock;
  }

  /** 저장/복원용 (포지션 해시 → 등장 횟수) 목록. 현재 포지션 포함. */
  getRepetitionCounts(): ReadonlyArray<readonly [ZobristHash, number]> {
    return [...this.positionCounts.entries()];
  }

  /** 현재 포지션(배치+차례)이 통산 3회 이상 등장했는가. */
  isThreefoldRepetition(): boolean {
    return (this.positionCounts.get(this.boardHash) ?? 0) >= 3;
  }

  isFiftyMoveDraw(): boolean {
    return this.halfmoveClock >= FIFTY_MOVE_LIMIT_PLIES;
  }

  private bumpPositionCount(hash: ZobristHash): void {
    this.positionCounts.set(hash, (this.positionCounts.get(hash) ?? 0) + 1);
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
    const realPromotion: PieceType | null = promotion ?? null;

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

    const wantedCode = encodeMoveParts(from, to, realPromotion);
    const legalCodes = this.getLegalMoveCodes(color);
    if (!legalCodes.includes(wantedCode)) {
      error = GameError.InvalidMove;
      return { success, end, winner, error, endReason };
    }
    const move: Move | null = this.makeMove(from, to, realPromotion ?? undefined);
    if (move === null) {
      error = GameError.InvalidMove;
      return { success, end, winner, error, endReason };
    }

    // 폰 이동 여부는 apply 전에 읽는다 — 승격되면 changePieceType이 타입을 바꾼다
    const wasPawnMove = move.piece?.type === PieceType.Pawn;

    const appliedMove = this.applyMove(move);
    if (appliedMove === null) {
      error = GameError.InvalidMove;
      return { success, end, winner, error, endReason };
    }

    success = true;
    this.history.push(appliedMove);
    this.switchPlayer();

    // 50수 클럭: 캡처·폰 이동이면 리셋, 아니면 증가.
    // 반복 카운트: switchPlayer 후의 해시가 방금 도달한 국면(배치+차례)이다.
    if (appliedMove.captured || wasPawnMove) {
      this.halfmoveClock = 0;
      // 비가역 수(잡힌 말은 부활하지 않고 폰은 후진하지 못함) 이전의 포지션은
      // 다시 나올 수 없으므로 카운트를 비워도 판정이 동일하다.
      // progressTurn에는 롤백이 없어 안전하며, 맵과 저장 페이로드가
      // 클럭 상한(FIFTY_MOVE_LIMIT_PLIES + 1) 이내로 제한된다.
      this.positionCounts.clear();
    } else {
      this.halfmoveClock++;
    }
    this.bumpPositionCount(this.boardHash);

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

    if (this.isThreefoldRepetition()) {
      end = true;
      winner = null;
      endReason = GameEndReason.ThreefoldRepetition;
      this.finishGame(null, GameEndReason.ThreefoldRepetition);
      return { success, end, winner, error, endReason };
    }

    if (this.isFiftyMoveDraw()) {
      end = true;
      winner = null;
      endReason = GameEndReason.FiftyMoveRule;
      this.finishGame(null, GameEndReason.FiftyMoveRule);
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

  getLegalMoveCodes(color: Color): MoveCode[] {
    const isCurrentPlayer = color === this.currentPlayer;
    const key = isCurrentPlayer ? this.boardHash : toggleSideToMove(this.boardHash);
    const cached = this.cachedLegalMoveCodes.get(key);

    if (cached !== undefined) return cached;

    const { forcedCaptureMoves, optionalCaptureMoves, quietMoves } =
      this.generateCandidateMoves(color);

    if (forcedCaptureMoves.length > 0) {
      const codes = forcedCaptureMoves.map(encodeMove);
      this.setLegalMoveCache(key, codes, true);
      return codes;
    }
    const codes = [...optionalCaptureMoves, ...quietMoves].map(encodeMove);
    this.setLegalMoveCache(key, codes, false);
    return codes;
  }

  getLegalMoves(color: Color): Move[] {
    return this.getLegalMoveCodes(color).map((code) => this.decodeToRichMove(code));
  }

  /** 압축 코드를 UI/외부용 Move로 복원. piece/captured는 현재 보드에서 되찾는다. */
  private decodeToRichMove(code: MoveCode): Move {
    const move = decodeMove(code);
    move.piece = this.board.getPieceByLocation(move.from) ?? undefined;
    move.captured = this.board.getPieceByLocation(move.to);
    return move;
  }

  private setLegalMoveCache(key: ZobristHash, codes: MoveCode[], captureForced: boolean): void {
    this.prepareSearchCacheSlot();
    this.cachedLegalMoveCodes.set(key, codes);
    this.cachedCaptureForced.set(key, captureForced);
  }

  /**
   * 탐색 캐시 상한. 캐시는 성능 최적화일 뿐이므로 가득 차면 전부 비워도 결과는 동일하다.
   * 하드 모드 장시간 탐색에서 캐시가 무한히 자라 모바일 OOM을 일으키는 것을 막는다.
   */
  private prepareSearchCacheSlot(): void {
    if (this.cachedLegalMoveCodes.size < this.searchCacheLimit) return;
    this.cachedLegalMoveCodes.clear();
    this.cachedCaptureForced.clear();
    this.cachedCheck.clear();
  }

  /** 탐색 캐시에 담긴 포지션 수 (진단/테스트용). */
  getSearchCacheSize(): number {
    return this.cachedLegalMoveCodes.size;
  }

  isCaptureForced(): boolean {
    const key = this.boardHash;
    const cached = this.cachedCaptureForced.get(key);
    if (cached !== undefined) return cached;

    this.getLegalMoveCodes(this.currentPlayer);
    return this.cachedCaptureForced.get(key) ?? false;
  }

  checkForCheck(color: Color): { isInCheck: boolean; checkers: Piece[] } {
    const isCurrentPlayer: boolean = color === this.currentPlayer;
    const key: ZobristHash = isCurrentPlayer ? this.boardHash : toggleSideToMove(this.boardHash);

    const cached = this.cachedCheck.get(key);
    if (cached !== undefined) {
      return {
        isInCheck: cached.isInCheck,
        checkers: cached.checkerSquares
          .map((square) => this.board.getPieceByLocation(decodeSquare(square)))
          .filter((piece): piece is Piece => piece !== null),
      };
    }

    const result = this.checkForCheckByBoard(this.board, color);

    // 캐시에는 기물 참조 대신 칸 번호만 저장한다
    this.prepareSearchCacheSlot();
    this.cachedCheck.set(key, {
      isInCheck: result.isInCheck,
      checkerSquares: result.checkers
        .filter((piece) => piece.location !== undefined)
        .map((piece) => encodeSquare(piece.location!)),
    });

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

  private getMoveDistance(from: Location, to: Location): number | null {
    const fromF = fileToIndex(from.file);
    const fromR = rankToIndex(from.rank);
    const toF = fileToIndex(to.file);
    const toR = rankToIndex(to.rank);
    if (fromF < 0 || fromR < 0 || toF < 0 || toR < 0) return null;
    return Math.max(Math.abs(toF - fromF), Math.abs(toR - fromR));
  }

  private isForcedCaptureMove(move: Move): boolean {
    if (!move.captured) return false;
    const pieceType = move.piece?.type;
    if (pieceType !== PieceType.Queen) return true;

    const distance = this.getMoveDistance(move.from, move.to);
    if (distance === null) return false;
    return distance <= 2;
  }

  private generateCandidateMoves(color: Color): {
    forcedCaptureMoves: Move[];
    optionalCaptureMoves: Move[];
    quietMoves: Move[];
  } {
    const ownPieces: Piece[] = this.board.getAllPieces(color);
    const forcedCaptureMoves: Move[] = [];
    const optionalCaptureMoves: Move[] = [];
    const quietMoves: Move[] = [];

    for (const piece of ownPieces) {
      if (!piece.location) continue;

      const destinations: Location[] = this.board.getMovableLocations(piece);
      for (const to of destinations) {
        const move: Move | null = this.makeMove(piece.location, to);
        if (move === null) continue;
        if (!move.captured) {
          quietMoves.push(move);
          continue;
        }

        if (this.isForcedCaptureMove(move)) {
          forcedCaptureMoves.push(move);
        } else {
          optionalCaptureMoves.push(move);
        }
      }
    }

    const promotedForcedCaptureMoves: Move[] = forcedCaptureMoves.flatMap((move) =>
      this.applyPromotionToMove(move),
    );
    const promotedOptionalCaptureMoves: Move[] = optionalCaptureMoves.flatMap((move) =>
      this.applyPromotionToMove(move),
    );
    const promotedQuietMoves: Move[] = quietMoves.flatMap((move) =>
      this.applyPromotionToMove(move),
    );

    const filteredForcedCaptureMoves: Move[] = promotedForcedCaptureMoves.filter(
      (move) => !this.checkForNextCheck(move, color),
    );
    const filteredOptionalCaptureMoves: Move[] = promotedOptionalCaptureMoves.filter(
      (move) => !this.checkForNextCheck(move, color),
    );
    const filteredQuietMoves: Move[] = promotedQuietMoves.filter(
      (move) => !this.checkForNextCheck(move, color),
    );

    return {
      forcedCaptureMoves: filteredForcedCaptureMoves,
      optionalCaptureMoves: filteredOptionalCaptureMoves,
      quietMoves: filteredQuietMoves,
    };
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
    const legalMoveCount = this.getLegalMoveCodes(color).length;
    return {
      isInCheckmate: isInCheck && legalMoveCount === 0,
      checkers,
    };
  }

  isStalemate(color: Color): boolean {
    const { isInCheck } = this.checkForCheck(color);
    const legalMoveCount = this.getLegalMoveCodes(color).length;
    return !isInCheck && legalMoveCount === 0;
  }

  isLoneIsland(color: Color): boolean {
    const { isInCheck } = this.checkForCheck(color);
    if (isInCheck) {
      return false;
    }
    const legalCodes = this.getLegalMoveCodes(color);
    if (legalCodes.length === 0) {
      return false;
    }

    return legalCodes.every((code) => {
      const move = decodeMove(code);
      const piece = this.board.getPieceByLocation(move.from);
      const captured = this.board.getPieceByLocation(move.to);
      return piece?.type === PieceType.King && captured === null;
    });
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
