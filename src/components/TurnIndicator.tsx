import { Color } from '@/engine/types';
import { cn } from '@/lib/utils';

interface TurnIndicatorProps {
  currentTurn: Color;
  isSinglePlay : boolean;
  isPlayerTurn?: boolean;
}

export function TurnIndicator ({
  currentTurn,
  isSinglePlay,
  isPlayerTurn,
}: TurnIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-4 py-3 px-6 bg-card rounded-lg border border-border">
      <div 
        className={cn(
          'w-6 h-6 rounded-full border-2',
          currentTurn === Color.White 
            ? 'bg-[hsl(var(--chess-white-piece))] border-muted' 
            : 'bg-[hsl(var(--chess-black-piece))] border-muted-foreground'
        )}
      />
      <span className="text-lg font-medium">
        {!isSinglePlay && (currentTurn === Color.White ? '백의 차례' : '흑의 차례') }
        {isSinglePlay && (
          <span className="text-muted-foreground ml-2">
            {isPlayerTurn ? '당신의 차례' : '컴퓨터 차례'}
          </span>
        )}
      </span>
    </div>
  );
};

export default TurnIndicator;
