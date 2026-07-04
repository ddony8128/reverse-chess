import {
  PieceType,
  fileToIndex,
  rankToIndex,
  indexToFile,
  indexToRank,
  type Location,
  type Move,
} from './types';

/**
 * Move의 압축 표현.
 * 객체 그래프(Move → Location/Piece 참조) 대신 16비트 정수 하나로 수를 표현한다.
 * TT와 탐색 캐시에 저장할 때 메모리를 10배 이상 줄이고,
 * piece/captured 참조로 인한 보드 객체 고정(누수)을 구조적으로 차단한다.
 *
 * 비트 배치: [14..12] promotion | [11..6] to | [5..0] from
 * promotion: 0 = 없음, 1 = Q, 2 = R, 3 = B, 4 = N
 */
export type MoveCode = number;

const PROMOTION_BY_INDEX: (PieceType | null)[] = [
  null,
  PieceType.Queen,
  PieceType.Rook,
  PieceType.Bishop,
  PieceType.Knight,
];

function promotionToIndex(promotion: PieceType | null | undefined): number {
  switch (promotion) {
    case PieceType.Queen:
      return 1;
    case PieceType.Rook:
      return 2;
    case PieceType.Bishop:
      return 3;
    case PieceType.Knight:
      return 4;
    default:
      return 0;
  }
}

/** 칸(Location) ↔ 0..63 정수 인코딩. */
export function encodeSquare(location: Location): number {
  const fileIndex = fileToIndex(location.file);
  const rankIndex = rankToIndex(location.rank);
  return rankIndex * 8 + fileIndex;
}

export function decodeSquare(index: number): Location {
  const file = indexToFile(index % 8);
  const rank = indexToRank(Math.floor(index / 8));
  return { file: file!, rank: rank! };
}

export function encodeMoveParts(
  from: Location,
  to: Location,
  promotion: PieceType | null | undefined,
): MoveCode {
  return (
    encodeSquare(from) |
    (encodeSquare(to) << 6) |
    (promotionToIndex(promotion) << 12)
  );
}

export function encodeMove(move: Move): MoveCode {
  return encodeMoveParts(move.from, move.to, move.promotion);
}

/** piece/captured 없는 순수 Move({from, to, promotion})로 복원한다. */
export function decodeMove(code: MoveCode): Move {
  return {
    from: decodeSquare(code & 0b111111),
    to: decodeSquare((code >> 6) & 0b111111),
    promotion: PROMOTION_BY_INDEX[(code >> 12) & 0b111],
  };
}

export function decodeFrom(code: MoveCode): Location {
  return decodeSquare(code & 0b111111);
}

export function decodeTo(code: MoveCode): Location {
  return decodeSquare((code >> 6) & 0b111111);
}
