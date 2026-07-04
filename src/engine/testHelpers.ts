import { Board } from './board';
import { createEmptyBoard } from './boardUtils';
import { Game } from './game';
import { Color, PieceType, type File, type Rank, type Location, type Move } from './types';

export type PieceSpec = {
  color: Color;
  type: PieceType;
  file: File;
  rank: Rank;
};

export function buildBoard(pieces: PieceSpec[]): Board {
  const board = createEmptyBoard();
  for (const spec of pieces) {
    const location: Location = { file: spec.file, rank: spec.rank };
    board.setPiece(location, { color: spec.color, type: spec.type, location });
  }
  return board;
}

export function buildGame(pieces: PieceSpec[], toMove: Color): Game {
  const game = new Game(buildBoard(pieces), toMove);
  game.startGame();
  return game;
}

export function loc(file: File, rank: Rank): Location {
  return { file, rank };
}

/** "b7b5" / "a7a8queen" 형태의 정규화 키. 무브 집합 비교에 사용. */
export function moveKey(m: Move): string {
  return `${m.from.file}${m.from.rank}${m.to.file}${m.to.rank}${m.promotion ?? ''}`;
}

export function moveKeys(moves: Move[]): string[] {
  return moves.map(moveKey).sort();
}

/** 보드 전체 기물 배치의 정규화 스냅샷. 탐색 롤백 불변식 검증에 사용. */
export function boardSnapshot(board: Board): string {
  return board
    .getAllPieces()
    .filter((p) => p.location !== undefined)
    .map((p) => `${p.color}:${p.type}:${p.location!.file}${p.location!.rank}`)
    .sort()
    .join('|');
}

/** 워커/저장소가 쓰는 것과 동일한 (기물 목록 → 보드) 왕복 직렬화. */
export function serializePieces(board: Board): PieceSpec[] {
  return board
    .getAllPieces()
    .filter((p) => p.location !== undefined)
    .map((p) => ({
      color: p.color,
      type: p.type,
      file: p.location!.file,
      rank: p.location!.rank,
    }));
}

/** 시드 고정 의사난수 (LCG). 랜덤 자가대국 재현성 확보용. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
