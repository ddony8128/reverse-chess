import { useNavigate } from 'react-router-dom'

export function MainMenuPage() {
  const navigate = useNavigate()

  return (
    <div className="w-full max-w-md space-y-8 text-center">
      <p className="text-muted-foreground">
        리버스 규칙으로 즐기는 체스 게임입니다. 모드를 선택해주세요.
      </p>

      <div className="space-y-4">
        <button
          className="w-full px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
          onClick={() => navigate('/tutorial')}
        >
          튜토리얼
        </button>
        <button
          className="w-full px-4 py-3 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition"
          onClick={() => navigate('/single')}
        >
          혼자 하기
        </button>
        <button
          className="w-full px-4 py-3 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition"
          onClick={() => navigate('/two')}
        >
          둘이 하기
        </button>
        <button
          className="w-full px-4 py-3 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition"
          onClick={() => navigate('/test')}
        >
          테스트
        </button>
      </div>
    </div>
  )
}

