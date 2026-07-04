import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { computeZobristHash } from '@/lib/zobristHash';
import { createSeededRandom } from './testHelpers';

const MAX_PLIES = 150;
const SEEDS = [7, 42, 20260704];

/**
 * 랜덤 자가대국 스모크 테스트.
 * 매 수마다 (1) 합법수 존재, (2) progressTurn 성공, (3) 해시 == 전체 재계산 불변식을 확인한다.
 * 내부 표현 리팩터링 시 광범위한 회귀를 잡아내는 안전망.
 */
describe('랜덤 자가대국 (시드 고정)', () => {
  it.each(SEEDS)('시드 %i: 150수 이내 무결성 유지', (seed) => {
    const random = createSeededRandom(seed);
    const game = new Game();
    game.startGame();

    for (let ply = 0; ply < MAX_PLIES; ply++) {
      const color = game.getCurrentPlayer();
      const moves = game.getLegalMoves(color);

      // 진행 중인 게임에서 합법수가 없는 상태는 존재할 수 없다
      // (체크메이트/스테일메이트는 직전 progressTurn에서 end로 보고됐어야 함)
      expect(moves.length).toBeGreaterThan(0);

      const move = moves[Math.floor(random() * moves.length)];
      const result = game.progressTurn(color, move.from, move.to, move.promotion ?? undefined);
      expect(result.success).toBe(true);

      // 해시 불변식
      expect(game.getBoardHash()).toBe(
        computeZobristHash(game.getBoard(), game.getCurrentPlayer()),
      );

      if (result.end) {
        expect(result.endReason).toBeDefined();
        expect(game.getEndReason()).toBe(result.endReason);
        return;
      }
    }
    // 150수 안에 안 끝나도 실패는 아님 (반복수 무승부 규칙 없음)
  });
});
