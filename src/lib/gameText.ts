import { GameEndReason } from '@/engine/types';

/**
 * 종료 사유의 짧은 표시용 라벨. 두 게임 페이지의 배너(CheckIndicator)가 공유한다.
 * (GameResultModal의 풀 문장 설명과는 다른 UX 슬롯 — 짧게 유지할 것)
 */
export function endReasonShortLabel(reason: GameEndReason | null | undefined): string | null {
  switch (reason) {
    case GameEndReason.Checkmate:
      return '체크메이트';
    case GameEndReason.Stalemate:
      return '스틸메이트';
    case GameEndReason.LoneIsland:
      return '외딴 섬';
    case GameEndReason.OnlyKingLeft:
      return '왕만 남음';
    case GameEndReason.ThreefoldRepetition:
      return '3회 동형';
    case GameEndReason.FiftyMoveRule:
      return '50수 규칙';
    default:
      return null;
  }
}
