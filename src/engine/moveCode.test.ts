import { describe, it, expect } from 'vitest';
import { encodeMove, encodeMoveParts, decodeMove, decodeFrom, decodeTo } from './moveCode';
import { PieceType, File, Rank, type Location, type Move } from './types';
import { moveKey } from './testHelpers';

const ALL_FILES = Object.values(File) as File[];
const ALL_RANKS = Object.values(Rank) as Rank[];
const ALL_PROMOTIONS = [null, PieceType.Queen, PieceType.Rook, PieceType.Bishop, PieceType.Knight];

describe('moveCode 인코딩/디코딩', () => {
  it('모든 칸 × 모든 프로모션 왕복이 무손실이다 (64×64×5)', () => {
    for (const fromFile of ALL_FILES) {
      for (const fromRank of ALL_RANKS) {
        for (const toFile of ALL_FILES) {
          for (const toRank of ALL_RANKS) {
            for (const promotion of ALL_PROMOTIONS) {
              const from: Location = { file: fromFile, rank: fromRank };
              const to: Location = { file: toFile, rank: toRank };
              const code = encodeMoveParts(from, to, promotion);
              const decoded = decodeMove(code);
              if (
                decoded.from.file !== fromFile ||
                decoded.from.rank !== fromRank ||
                decoded.to.file !== toFile ||
                decoded.to.rank !== toRank ||
                (decoded.promotion ?? null) !== promotion
              ) {
                // 실패 지점을 알 수 있게 명시적으로 비교
                expect(moveKey(decoded)).toBe(
                  moveKey({ from, to, promotion: promotion ?? null }),
                );
              }
            }
          }
        }
      }
    }
  });

  it('코드는 16비트 미만의 음이 아닌 정수', () => {
    const code = encodeMoveParts(
      { file: 'h', rank: 8 },
      { file: 'h', rank: 8 },
      PieceType.Knight,
    );
    expect(code).toBeLessThan(1 << 15);
    expect(code).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(code)).toBe(true);
  });

  it('서로 다른 수는 서로 다른 코드 (전수 유일성)', () => {
    const seen = new Set<number>();
    let count = 0;
    for (const fromFile of ALL_FILES) {
      for (const fromRank of ALL_RANKS) {
        for (const toFile of ALL_FILES) {
          for (const toRank of ALL_RANKS) {
            for (const promotion of ALL_PROMOTIONS) {
              seen.add(
                encodeMoveParts(
                  { file: fromFile, rank: fromRank },
                  { file: toFile, rank: toRank },
                  promotion,
                ),
              );
              count++;
            }
          }
        }
      }
    }
    expect(seen.size).toBe(count);
  });

  it('encodeMove는 piece/captured가 있어도 from/to/promotion만 반영한다', () => {
    const move: Move = {
      from: { file: 'e', rank: 2 },
      to: { file: 'e', rank: 4 },
      piece: { color: 'white', type: PieceType.Pawn },
      captured: null,
      promotion: null,
    };
    expect(encodeMove(move)).toBe(encodeMoveParts(move.from, move.to, null));
  });

  it('decodeMove 결과에는 piece/captured 참조가 없다', () => {
    const code = encodeMoveParts({ file: 'a', rank: 7 }, { file: 'b', rank: 8 }, PieceType.Queen);
    const decoded = decodeMove(code);
    expect(decoded.piece).toBeUndefined();
    expect(decoded.captured).toBeUndefined();
    expect(decoded.promotion).toBe(PieceType.Queen);
  });

  it('decodeFrom/decodeTo는 decodeMove와 일치한다', () => {
    const code = encodeMoveParts({ file: 'c', rank: 3 }, { file: 'd', rank: 5 }, null);
    expect(decodeFrom(code)).toEqual({ file: 'c', rank: 3 });
    expect(decodeTo(code)).toEqual({ file: 'd', rank: 5 });
  });

  it('undefined 프로모션은 null과 동일하게 인코딩된다', () => {
    const from: Location = { file: 'e', rank: 2 };
    const to: Location = { file: 'e', rank: 3 };
    expect(encodeMoveParts(from, to, undefined)).toBe(encodeMoveParts(from, to, null));
  });
});
