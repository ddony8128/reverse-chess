import { Color, File, Rank, PieceType, indexToFile, indexToRank, fileToIndex, rankToIndex, locationToKey } from './types';
import type { LocationKey, Location, Piece, Square } from './types';

export class Board {
  private squares: Square[] = [];
  private pieceByLocation: Partial<Record<LocationKey, Piece>> = {};


  
  constructor() {
    this.initSquares();
    this.initPieces();
  }

  private initSquares() {
    this.squares = Array.from({ length: 64 }, (_, index) => {
      const fileIndex = index % 8;
      const rankIndex = Math.floor(index / 8);

      const file = indexToFile(fileIndex);
      const rank = indexToRank(rankIndex);

      const currentSquare: Square = {
        location: { file: file!, rank: rank! },
        piece: null,
        color: (fileIndex + rankIndex) % 2 === 0 ? Color.Black : Color.White,
      };

      return currentSquare;
    });
  }

  private initPieces() {
    const sideLineFigures1: PieceType[] = [
      'rook',
      'knight',
      'bishop',
      'queen',
      'king',
      'bishop',
      'knight',
      'rook',
    ];
    const sideLineFigures2: PieceType[] = [
      'rook',
      'knight',
      'bishop',
      'king',
      'queen',
      'bishop',
      'knight',
      'rook',
    ];

    for (let i = 0; i < 8; i++) {
      const currentFile: File = indexToFile(i)!;

      const newWhitePiece: Piece = {
        color: Color.White,
        type: sideLineFigures1[i],
        location: { file: currentFile, rank: Rank.Rank1 },
      };
      const newBlackPiece: Piece = {
        color: Color.Black,
        type: sideLineFigures2[i],
        location: { file: currentFile, rank: Rank.Rank8 },
      };
      const newWhitePawnPiece: Piece = {
        color: Color.White,
        type: PieceType.Pawn,
        location: { file: currentFile, rank: Rank.Rank2 },
      };
      const newBlackPawnPiece: Piece = {
        color: Color.Black,
        type: PieceType.Pawn,
        location: { file: currentFile, rank: Rank.Rank7 },
      };

      this.squares[i].piece = newWhitePiece;
      this.squares[i + 8].piece = newWhitePawnPiece;
      this.squares[i + 48].piece = newBlackPawnPiece;
      this.squares[i + 56].piece = newBlackPiece;

      this.pieceByLocation[`${currentFile}${Rank.Rank1}`] = newWhitePiece;
      this.pieceByLocation[`${currentFile}${Rank.Rank8}`] = newBlackPiece;
      this.pieceByLocation[`${currentFile}${Rank.Rank2}`] = newWhitePawnPiece;
      this.pieceByLocation[`${currentFile}${Rank.Rank7}`] = newBlackPawnPiece;
    }
  }


  private getIndices(location: Location): { fileIndex: number; rankIndex: number } | null {

    const fileIndex : number = fileToIndex(location.file);
    const rankIndex : number = rankToIndex(location.rank);


    if (fileIndex === -1 || rankIndex === -1) {
      return null;
    }
    return { fileIndex, rankIndex };
  }

  private createLocation(fileIndex: number, rankIndex: number): Location | null {
    const file = indexToFile(fileIndex);
    const rank = indexToRank(rankIndex);
    if (file === null || rank === null) {
      return null;
    }
    return { file, rank };
  }

  private getSquareIndex(location: Location): number | null {
    const indices = this.getIndices(location);
    if (!indices) {
      return null;
    }
    return indices.rankIndex * 8 + indices.fileIndex;
  }

  getPieceByLocation(location: Location): Piece | null {
    const key = locationToKey(location);
    const piece = this.pieceByLocation[key];
    return piece ?? null;
  }

  private isOccupied(location: Location): boolean {
    return this.getPieceByLocation(location) !== null;
  }

  private isOccupiedByOwn(location: Location, color: Color): boolean {
    const piece = this.getPieceByLocation(location);
    return !!piece && piece.color === color;
  }

  private isOccupiedByOpponent(location: Location, color: Color): boolean {
    const piece = this.getPieceByLocation(location);
    return !!piece && piece.color !== color;
  }

  private generateSlidingMoves(
    piece: Piece,
    from: Location,
    directions: Array<{ df: number; dr: number }>,
  ): Location[] {
    const moves: Location[] = [];
    const indices = this.getIndices(from);
    if (!indices) {
      return moves;
    }

    for (const { df, dr } of directions) {
      let fileIndex = indices.fileIndex + df;
      let rankIndex = indices.rankIndex + dr;

      while (true) {
        const nextLocation = this.createLocation(fileIndex, rankIndex);
        if (!nextLocation) {
          break;
        }

        if (this.isOccupiedByOwn(nextLocation, piece.color)) {
          break;
        }

        moves.push(nextLocation);

        if (this.isOccupiedByOpponent(nextLocation, piece.color)) {
          break;
        }

        fileIndex += df;
        rankIndex += dr;
      }
    }

    return moves;
  }

  getMovableLocations(piece: Piece): Location[] {
    if (!piece.location) {
      return [];
    }

    const from = piece.location;
    const indices = this.getIndices(from);
    const moves: Location[] = [];
    if (!indices) {
      return moves;
    }


    
    switch (piece.type) {
      case PieceType.Pawn: {

        const direction = piece.color === Color.White ? 1 : -1;
        const startRank = piece.color === Color.White ? Rank.Rank2 : Rank.Rank7;

        const oneStep = this.createLocation(indices.fileIndex, indices.rankIndex + direction);
        if (oneStep && !this.isOccupied(oneStep)) {
          moves.push(oneStep);

          if (from.rank === startRank) {
            const twoStep = this.createLocation(
              indices.fileIndex,
              indices.rankIndex + 2 * direction,
            );
            if (twoStep && !this.isOccupied(twoStep)) {
              moves.push(twoStep);
            }
          }
        }

        const captureOffsets = [-1, 1];
        for (const df of captureOffsets) {
          const target = this.createLocation(indices.fileIndex + df, indices.rankIndex + direction);
          if (target && this.isOccupiedByOpponent(target, piece.color)) {
            moves.push(target);
          }
        }

        break;
      }
      case PieceType.Knight: {

        const knightOffsets = [
          { df: 1, dr: 2 },
          { df: 2, dr: 1 },
          { df: 2, dr: -1 },
          { df: 1, dr: -2 },
          { df: -1, dr: -2 },
          { df: -2, dr: -1 },
          { df: -2, dr: 1 },
          { df: -1, dr: 2 },
        ];

        for (const { df, dr } of knightOffsets) {
          const target = this.createLocation(indices.fileIndex + df, indices.rankIndex + dr);
          if (!target || this.isOccupiedByOwn(target, piece.color)) {
            continue;
          }
          moves.push(target);
        }
        break;
      }
      case PieceType.Bishop: {
        const directions = [
          { df: 1, dr: 1 },
          { df: 1, dr: -1 },
          { df: -1, dr: 1 },
          { df: -1, dr: -1 },
        ];
        return this.generateSlidingMoves(piece, from, directions);
      }
      case PieceType.Rook: {
        const directions = [
          { df: 1, dr: 0 },
          { df: -1, dr: 0 },
          { df: 0, dr: 1 },
          { df: 0, dr: -1 },
        ];
        return this.generateSlidingMoves(piece, from, directions);
      }
      case PieceType.Queen: {
        const directions = [
          { df: 1, dr: 0 },
          { df: -1, dr: 0 },
          { df: 0, dr: 1 },
          { df: 0, dr: -1 },
          { df: 1, dr: 1 },
          { df: 1, dr: -1 },
          { df: -1, dr: 1 },
          { df: -1, dr: -1 },
        ];
        return this.generateSlidingMoves(piece, from, directions);
      }
      case PieceType.King: {

        const kingOffsets = [
          { df: 1, dr: 0 },
          { df: 1, dr: 1 },
          { df: 0, dr: 1 },
          { df: -1, dr: 1 },
          { df: -1, dr: 0 },
          { df: -1, dr: -1 },
          { df: 0, dr: -1 },
          { df: 1, dr: -1 },
        ];

        for (const { df, dr } of kingOffsets) {
          const target = this.createLocation(indices.fileIndex + df, indices.rankIndex + dr);
          if (!target || this.isOccupiedByOwn(target, piece.color)) {
            continue;
          }
          moves.push(target);
        }
        break;
      }
      default:
        break;
    }

    return moves;
  }

  movePiece(piece: Piece, destination: Location): Piece | null {
    if (piece.location) {
        const from = piece.location;
        const fromIndex = this.getSquareIndex(from);
        if (fromIndex !== null) {
            this.squares[fromIndex].piece = null;
            const fromKey = locationToKey(from);
            delete this.pieceByLocation[fromKey];
        }
    }

    const toIndex = this.getSquareIndex(destination);
    if (toIndex === null) {
      return null;
    }

    const captured = this.squares[toIndex].piece ?? null;

    this.squares[toIndex].piece = piece;
    
    const toKey = locationToKey(destination);
    this.pieceByLocation[toKey] = piece;

    piece.location = destination;
    if (captured) {
      captured.location = undefined;
    }

    return captured;
  }

  changePieceType(piece: Piece, newType: PieceType): void {
    piece.type = newType;
  }

  getCapturablePieces(piece: Piece): Piece[] {
    const result: Piece[] = [];
    const moves = this.getMovableLocations(piece);

    for (const location of moves) {
      const target = this.getPieceByLocation(location);
      if (target && target.color !== piece.color) {
        result.push(target);
      }
    }

    return result;
  }

  private canPieceAttackLocation(attacker: Piece, target: Location): boolean {
    if (!attacker.location) {
      return false;
    }

    const from = attacker.location;
    const fromIndices = this.getIndices(from);
    const targetIndices = this.getIndices(target);
    if (!fromIndices || !targetIndices) {
      return false;
    }

    const df = targetIndices.fileIndex - fromIndices.fileIndex;
    const dr = targetIndices.rankIndex - fromIndices.rankIndex;

    switch (attacker.type) {
      case PieceType.Pawn: {
        const direction = attacker.color === Color.White ? 1 : -1;
        return dr === direction && Math.abs(df) === 1;
      }
      case PieceType.Knight: {
        const absDf = Math.abs(df);
        const absDr = Math.abs(dr);
        return (absDf === 1 && absDr === 2) || (absDf === 2 && absDr === 1);
      }
      case PieceType.Bishop: {
        if (Math.abs(df) !== Math.abs(dr)) {
          return false;
        }
        const stepF = df > 0 ? 1 : -1;
        const stepR = dr > 0 ? 1 : -1;
        let f = fromIndices.fileIndex + stepF;
        let r = fromIndices.rankIndex + stepR;
        while (f !== targetIndices.fileIndex || r !== targetIndices.rankIndex) {
          const between = this.createLocation(f, r);
          if (!between || this.isOccupied(between)) {
            return false;
          }
          f += stepF;
          r += stepR;
        }
        return true;
      }
      case PieceType.Rook: {
        if (df !== 0 && dr !== 0) {
          return false;
        }
        const stepF = df === 0 ? 0 : df > 0 ? 1 : -1;
        const stepR = dr === 0 ? 0 : dr > 0 ? 1 : -1;
        let f = fromIndices.fileIndex + stepF;
        let r = fromIndices.rankIndex + stepR;
        while (f !== targetIndices.fileIndex || r !== targetIndices.rankIndex) {
          const between = this.createLocation(f, r);
          if (!between || this.isOccupied(between)) {
            return false;
          }
          f += stepF;
          r += stepR;
        }
        return true;
      }
      case PieceType.Queen: {
        const bishopLike =
          Math.abs(df) === Math.abs(dr) &&
          this.canPieceAttackLocation(
            { ...attacker, type: PieceType.Bishop },
            target,
          );
        const rookLike =
          (df === 0 || dr === 0) &&
          this.canPieceAttackLocation(
            { ...attacker, type: PieceType.Rook },
            target,
          );
        return bishopLike || rookLike;
      }
      case PieceType.King: {
        return Math.max(Math.abs(df), Math.abs(dr)) === 1;
      }
      default:
        return false;
    }
  }

  isLocationAttacked(target: Location, byColor: Color): boolean {
    const pieces = Object.values(this.pieceByLocation);
    for (const piece of pieces) {
      if (!piece || piece.color !== byColor) {
        continue;
      }
      if (this.canPieceAttackLocation(piece, target)) {
        return true;
      }
    }
    return false;
  }
}
