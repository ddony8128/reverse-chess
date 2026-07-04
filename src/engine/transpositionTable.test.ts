import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TranspositionTable } from './transpositionTable';

// 구현 상수와 동기화: transpositionTable.ts의 EVICT_COUNT
const EVICT_COUNT = 10000;

describe('TranspositionTable 기본 동작', () => {
  it('set/get 왕복, 미스는 null', () => {
    const tt = new TranspositionTable();
    expect(tt.getEntry(1n)).toBeNull();

    tt.setEntry(1n, { depth: 3, score: 42 });
    expect(tt.getEntry(1n)).toMatchObject({ depth: 3, score: 42 });
  });

  it('같은 해시에 다시 쓰면 덮어쓴다 (사이즈 불변)', () => {
    const tt = new TranspositionTable(5);
    tt.setEntry(1n, { depth: 1 });
    tt.setEntry(1n, { depth: 2 });
    expect(tt.getEntry(1n)).toMatchObject({ depth: 2 });
  });

  it('clear는 모든 엔트리를 지운다', () => {
    const tt = new TranspositionTable();
    tt.setEntry(1n, { depth: 1 });
    tt.setEntry(2n, { depth: 2 });
    tt.clear();
    expect(tt.getEntry(1n)).toBeNull();
    expect(tt.getEntry(2n)).toBeNull();
  });

  it('updateSearchWindow는 기존 엔트리를 보존하며 depth/score/bestMove를 갱신한다', () => {
    const tt = new TranspositionTable();
    tt.setEntry(1n, { isEnded: false, hasOnlyMove: false });
    tt.updateSearchWindow(1n, 5, 100);
    expect(tt.getEntry(1n)).toMatchObject({
      isEnded: false,
      hasOnlyMove: false,
      depth: 5,
      score: 100,
    });
  });
});

describe('TranspositionTable LRU 축출', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('maxSize가 EVICT_COUNT 이하면 가득 찼을 때 전부 축출된다 (현재 동작 특성화)', () => {
    const tt = new TranspositionTable(5);
    for (let i = 0; i < 5; i++) {
      tt.setEntry(BigInt(i), { depth: i });
      vi.advanceTimersByTime(1);
    }
    // 6번째 삽입 → 기존 5개 전부 축출 후 삽입
    tt.setEntry(100n, { depth: 100 });
    for (let i = 0; i < 5; i++) {
      expect(tt.getEntry(BigInt(i))).toBeNull();
    }
    expect(tt.getEntry(100n)).toMatchObject({ depth: 100 });
  });

  it('가득 차면 lastAccess가 오래된 것부터 EVICT_COUNT개 축출되고, 최근 접근 항목은 살아남는다', () => {
    const size = EVICT_COUNT + 1;
    const tt = new TranspositionTable(size);
    for (let i = 0; i < size; i++) {
      tt.setEntry(BigInt(i), { depth: i });
      vi.advanceTimersByTime(1);
    }
    // 0번을 다시 읽어 lastAccess 갱신 → 가장 최근 접근이 됨
    expect(tt.getEntry(0n)).not.toBeNull();
    vi.advanceTimersByTime(1);

    // 오버플로우 삽입 → 오래된 EVICT_COUNT개 축출
    tt.setEntry(999999n, { depth: -1 });

    // 축출 대상은 lastAccess 오름차순 앞 10000개 = 1..10000번.
    // 0번은 접근 갱신 덕분에 유일하게 살아남는다.
    expect(tt.getEntry(0n)).not.toBeNull(); // 최근 접근 → 생존
    expect(tt.getEntry(999999n)).not.toBeNull(); // 새 엔트리 → 생존
    expect(tt.getEntry(1n)).toBeNull(); // 오래된 것 → 축출
    expect(tt.getEntry(BigInt(EVICT_COUNT))).toBeNull(); // 마지막 삽입분도 0번보다 오래됨 → 축출
  });
});
