import { Color } from '@/engine/types';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface TurnIndicatorProps {
  currentTurn: Color;
  isSinglePlay: boolean;
  isPlayerTurn?: boolean;
  isEnded?: boolean;
  winner?: Color | null;
}

export function TurnIndicator({
  currentTurn,
  isSinglePlay,
  isPlayerTurn,
  isEnded,
  winner,
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
  const isDraw = isEnded && winner === null;

  return (
    <div className="bg-card border-border flex items-center justify-center gap-4 rounded-lg border px-6 py-3">
      <div
        className={cn(
          'h-5 w-5 rounded-full border-2 sm:h-6 sm:w-6',
          isDraw
            ? 'border-muted'
            : (isEnded && winner === Color.White) || currentTurn === Color.White
              ? 'border-muted bg-[hsl(var(--chess-white-piece))]'
              : 'border-muted-foreground bg-[hsl(var(--chess-black-piece))]',
        )}
        style={
          // 무승부: 어느 쪽 색도 아니므로 반반으로 나눈 중립 점을 표시한다
          isDraw
            ? {
                background:
                  'linear-gradient(90deg, hsl(var(--chess-white-piece)) 50%, hsl(var(--chess-black-piece)) 50%)',
              }
            : undefined
        }
      />
      <span className="text-sm font-medium sm:text-lg">
        {!isEnded && !isSinglePlay && (currentTurn === Color.White ? '백의 차례' : '흑의 차례')}
        {!isEnded && isSinglePlay && (
          <span className="text-muted-foreground ml-2">
            {isPlayerTurn ? '당신의 차례' : thinkingText[aiThinking]}
          </span>
        )}
        {isEnded &&
          winner !== null &&
          (winner === Color.White ? '백이 승리했습니다.' : '흑이 승리했습니다.')}
        {isEnded && winner === null && '무승부입니다.'}
      </span>
    </div>
  );
}

export default TurnIndicator;
