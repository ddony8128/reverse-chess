import { GameEndReason } from '@/engine/types';

export const EventName = {
  GameStart: 'game_start',
  GameEnd: 'game_end',
  RematchClick: 'rematch_click',

  TutorialStart: 'tutorial_start',
  TutorialStepView: 'tutorial_step_view',
  TutorialComplete: 'tutorial_complete',

  PageDwell: 'page_dwell',

  Error: 'error',
} as const;
export type EventName = (typeof EventName)[keyof typeof EventName];

export type EventParams = {
  mode?: 'two' | 'single';
  color_human?: 'white' | 'black';
  difficulty?: 'easy' | 'hard';
  session_id?: string;
  prev_game_id?: string;
  game_id?: string;
  winner?: 'white' | 'black' | 'draw';
  end_reason?:
    | 'checkmate'
    | 'stalemate'
    | 'lone_island'
    | 'only_king_left'
    | 'threefold_repetition'
    | 'fifty_move_rule'
    | 'abort';
  duration_ms?: number;

  step_name?: string;

  page_path?: string;
  dwell_ms?: number;

  error_message?: string;
};

/** GameEndReason을 애널리틱스 end_reason 파라미터로 변환. 두 게임 페이지가 공유한다. */
export function endReasonToAnalyticsParam(
  reason: GameEndReason | null | undefined,
): EventParams['end_reason'] {
  switch (reason) {
    case GameEndReason.Checkmate:
      return 'checkmate';
    case GameEndReason.Stalemate:
      return 'stalemate';
    case GameEndReason.LoneIsland:
      return 'lone_island';
    case GameEndReason.OnlyKingLeft:
      return 'only_king_left';
    case GameEndReason.ThreefoldRepetition:
      return 'threefold_repetition';
    case GameEndReason.FiftyMoveRule:
      return 'fifty_move_rule';
    default:
      return undefined;
  }
}
