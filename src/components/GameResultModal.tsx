import { Color, GameEndReason } from '@/engine/types';
import { Button } from '@/components/ui/button';

interface GameResultModalProps {
  winner: Color | 'draw' | null;
  singlePlayerColor?: Color;
  isTwoPlayer?: boolean;
  endReason: GameEndReason | null;
  difficulty?: 'easy' | 'hard';
  onConfirm: () => void;
}

export function GameResultModal({
  winner,
  singlePlayerColor,
  isTwoPlayer = false,
  endReason,
  difficulty,
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
      return difficulty === 'easy' ? '승리! (쉬움)' : '승리! (어려움)';
    } else {
      return '패배...';
    }
  };

  const getEndReasonText = () => {
    if (endReason === GameEndReason.Checkmate) {
      return '체크메이트! ';
    }
    if (endReason === GameEndReason.Stalemate) {
      return '스틸메이트! ';
    }
    if (endReason === GameEndReason.LoneIsland) {
      return '외딴 섬! ';
    }
    if (endReason === GameEndReason.OnlyKingLeft) {
      return '왕만 남음! ';
    }
    if (endReason === GameEndReason.ThreefoldRepetition) {
      return '같은 모양의 판이 세 번 반복되었습니다. ';
    }
    if (endReason === GameEndReason.FiftyMoveRule) {
      return '50수 동안 잡힌 말이 없고 폰도 움직이지 않았습니다. ';
    }
    return '';
  };

  const getSubText = () => {
    // 무승부는 제목("무승부!")과 사유 설명 문장으로 충분하므로 별도 격려문을 붙이지 않는다
    if (winner === 'draw') {
      return '';
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

  const isDraw = winner === 'draw';
  // 무승부는 승리 연출(금색 글로우)을 쓰지 않는다. 악수 이모지의 부드러운 부유만 공유한다.
  const isVictory = !isDraw && (isTwoPlayer || winner === singlePlayerColor);

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-md px-20">
        <div className={`mb-4 text-6xl ${isVictory || isDraw ? 'animate-float' : ''}`}>
          {isDraw ? '🤝' : isVictory ? '🏆' : '😢'}
        </div>
        <h2
          className={`mb-2 text-4xl font-bold ${isVictory ? 'text-primary animate-glow' : 'text-foreground'}`}
        >
          {getResultText()}
        </h2>
        <p className="text-muted-foreground mb-6 text-lg">
          {getEndReasonText()} {getSubText()}
        </p>
        <Button onClick={onConfirm} className="btn-menu">
          확인
        </Button>
      </div>
    </div>
  );
}

export default GameResultModal;
