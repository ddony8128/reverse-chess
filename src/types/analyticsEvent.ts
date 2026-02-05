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
  end_reason?: 'checkmate' | 'stalemate' | 'lone_island' | 'only_king_left' | 'abort';
  duration_ms?: number;

  step_name?: string;

  page_path?: string;
  dwell_ms?: number;
};
