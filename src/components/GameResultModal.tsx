import { Color } from '@/engine/types';
import { Button } from '@/components/ui/button';

interface GameResultModalProps {
  winner: Color | 'draw' | null;
  singlePlayerColor?: Color;
  isTwoPlayer?: boolean;
  onConfirm: () => void;
}

export function GameResultModal ({
  winner,
  singlePlayerColor,
  isTwoPlayer = false,
  onConfirm,
}: GameResultModalProps) {

  const getResultText = () => {
    if (winner === 'draw') {
      return '무승부!';
    }
    
    if (isTwoPlayer) {
      return winner === 'white' ? '백 승리!' : '흑 승리!';
    }
    
    if (winner === singlePlayerColor) {
      return '승리!';
    } else {
      return '패배...';
    }
  };
  
  const getSubText = () => {
    if (winner === 'draw') {
      return '비겼습니다';
    }
    
    if (isTwoPlayer) {
      return `좋은 경기였습니다.`;
    }
    
    if (winner === singlePlayerColor) {
      return '축하합니다! 훌륭한 게임이었습니다.';
    } else {
      return '다음에는 더 잘할 수 있을 거예요!';
    }
  };
  
  const isVictory = isTwoPlayer || winner === singlePlayerColor;
  
  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-md px-20">
        <div className={`text-6xl mb-4 ${isVictory ? 'animate-float' : ''}`}>
          {winner === 'draw' ? '🤝' : isVictory ? '🏆' : '😢'}
        </div>
        <h2 className={`text-4xl font-bold mb-2 ${isVictory ? 'text-primary animate-glow' : 'text-foreground'}`}>
          {getResultText()}
        </h2>
        <p className="text-muted-foreground text-lg mb-6">
          {getSubText()}
        </p>
        <Button 
          onClick={onConfirm}
          className="btn-menu"
        >
          확인
        </Button>
      </div>
    </div>
  );
};

export default GameResultModal;
