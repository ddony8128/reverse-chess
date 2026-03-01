import { Color } from '@/engine/types';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface TurnIndicatorProps {
  currentTurn: Color;
  isSinglePlay: boolean;
  isPlayerTurn?: boolean;
  isEnded?: boolean;
  winner?: Color | null;
  playerNames?: [string, string];
}

export function TurnIndicator({
  currentTurn,
  isSinglePlay,
  isPlayerTurn,
  isEnded,
  winner,
  playerNames,
}: TurnIndicatorProps) {
  const [aiThinking, setAiThinking] = useState(0);

  const thinkingText = [
    '컴퓨터 생각 중',
    '컴퓨터 생각 중.',
    '컴퓨터 생각 중..',
    '컴퓨터 생각 중...',
  ];

  useEffect(() => {
    if (isSinglePlay && !isPlayerTurn) {
      const timer = window.setTimeout(() => {
        if (aiThinking < 3) {
          setAiThinking(aiThinking + 1);
        } else {
          setAiThinking(0);
        }
      }, 1000);

      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [aiThinking, isSinglePlay, isPlayerTurn]);
  return (
    <div className="bg-card border-border flex items-center justify-center gap-4 rounded-lg border px-6 py-3">
      <div
        className={cn(
          'h-5 w-5 rounded-full border-2 sm:h-6 sm:w-6',
          (isEnded && winner === Color.White) || currentTurn === Color.White
            ? 'border-muted bg-[hsl(var(--chess-white-piece))]'
            : 'border-muted-foreground bg-[hsl(var(--chess-black-piece))]',
        )}
      />
      <span className="text-sm font-medium sm:text-lg">
        {!isEnded && !isSinglePlay && (currentTurn === Color.White
          ? `${playerNames?.[1] ?? '백'}의 차례`
          : `${playerNames?.[0] ?? '흑'}의 차례`)}
        {!isEnded && isSinglePlay && (
          <span className="text-muted-foreground ml-2">
            {isPlayerTurn ? '당신의 차례' : thinkingText[aiThinking]}
          </span>
        )}
        {isEnded && winner !== null && (winner === Color.White
          ? `${playerNames?.[1] ?? '백'} 승리!`
          : `${playerNames?.[0] ?? '흑'} 승리!`)}
        {isEnded && winner === null && '무승부입니다.'}
      </span>
    </div>
  );
}

export default TurnIndicator;
