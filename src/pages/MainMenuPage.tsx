import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronDown, Turtle, Rabbit } from 'lucide-react';

export function MainMenuPage() {
  const navigate = useNavigate();

  const [isSingleOpen, setIsSingleOpen] = useState(false);

  const handleSingleOpen = () => {
    setIsSingleOpen(!isSingleOpen);
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center px-8 pt-36 pb-24"
      style={{ background: 'var(--gradient-dark)' }}
    >
      <div className="text-primary absolute top-15 left-15 text-6xl opacity-40">♔</div>
      <div className="text-primary absolute top-15 right-15 text-6xl opacity-40">♛</div>
      <div className="text-primary absolute bottom-15 left-15 text-6xl opacity-40">♕</div>
      <div className="text-primary absolute right-15 bottom-15 text-6xl opacity-40">♚</div>

      <div className="mb-16 flex flex-col items-center gap-4 text-center">
        <img
          src="/icon.png"
          alt="Reverse Chess Icon"
          className="h-20 w-20 rounded-full shadow-lg md:h-24 md:w-24"
        />
        <div>
          <h1 className="game-title mb-4">리버스 체스</h1>
          <p className="text-muted-foreground text-lg">져야 이기는 체스</p>
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-4">
        <Button className="btn-menu w-full" onClick={() => navigate('/tutorial')}>
          튜토리얼
        </Button>

        <Button
          className="btn-menu flex w-full items-center justify-center gap-2"
          onClick={handleSingleOpen}
        >
          혼자 하기
          <ChevronDown className="h-5 w-5" />
        </Button>
        {isSingleOpen && (
          <div className="flex flex-col items-center gap-4">
            <Button
              className="btn-menu w-3/5 items-center"
              onClick={() => navigate('/single/easy')}
            >
              쉬움
              <Turtle className="h-5 w-5" />
            </Button>
            <Button
              className="btn-menu w-3/5 items-center"
              onClick={() => navigate('/single/hard')}
            >
              어려움
              <Rabbit className="h-5 w-5" />
            </Button>
          </div>
        )}

        <Button className="btn-menu w-full" onClick={() => navigate('/two')}>
          둘이 하기
        </Button>
      </div>
    </div>
  );
}
