import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronDown, Turtle, Rabbit } from 'lucide-react';

export function MainMenuPage() {
  const navigate = useNavigate()

  const [isSingleOpen, setIsSingleOpen] = useState(false);

  const handleSingleOpen = () => {
    setIsSingleOpen(!isSingleOpen);
  }

  return (
    <div className="min-h-screen flex flex-col items-center pt-60 pb-24 px-8"
    style={{ background: 'var(--gradient-dark)' }}>
      <div className="absolute top-15 left-15 text-6xl opacity-40 text-primary">♔</div>
      <div className="absolute top-15 right-15 text-6xl opacity-40 text-primary">♛</div>
      <div className="absolute bottom-15 left-15 text-6xl opacity-40 text-primary">♕</div>
      <div className="absolute bottom-15 right-15 text-6xl opacity-40 text-primary">♚</div>
      

      <div className="text-center mb-16">
        <h1 className="game-title mb-4">리버스 체스</h1>
        <p className="text-muted-foreground text-lg">져야 이기는 체스</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Button
          className="btn-menu w-full"
          onClick={() => navigate('/tutorial')}
        >
          튜토리얼
        </Button>

         <Button
          className="btn-menu w-full flex items-center justify-center gap-2"
          onClick={handleSingleOpen}
        >
          혼자 하기
          <ChevronDown className="w-5 h-5" />
          
        </Button>
          {isSingleOpen && (
            <div className="flex flex-col items-center gap-4">
              <Button
               className="btn-menu w-3/5 items-center"
               onClick={() => navigate('/single/easy')}>
                쉬움  
                <Turtle className="w-5 h-5" />
                </Button>
                <Button
                 className="btn-menu w-3/5 items-center"
                 onClick={() => navigate('/single/hard')}>
                  어려움  
                  <Rabbit className="w-5 h-5" />
                </Button>
                </div>
          )}

        
        <Button
          className="btn-menu w-full"
          onClick={() => navigate('/two')}
        >
          둘이 하기
        </Button>
      </div>
    </div>
  )
}

