import { useNavigate } from 'react-router-dom'

export function TutorialPage() {
  const navigate = useNavigate()

  return (
    <div className="w-full max-w-5xl space-y-6">
      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] gap-6">
        {/* 체스판 자리 */}
        <div className="aspect-square rounded-lg border border-border bg-muted flex items-center justify-center">
          <span className="text-sm text-muted-foreground">
            튜토리얼 체스판 (추후 실제 보드로 교체)
          </span>
        </div>

        {/* 설명 영역 */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">튜토리얼</h2>
          <p className="text-sm text-muted-foreground">
            이 단계에서는 리버스 체스의 기본 규칙을 설명합니다. 화면의 안내에 따라 정해진 수만
            둘 수 있도록 구현할 예정입니다.
          </p>
          <div className="space-y-2 text-left text-sm text-muted-foreground">
            <p>- 말은 일반 체스와 동일하게 움직입니다.</p>
            <p>- 체크메이트를 당하면 승리합니다.</p>
            <p>- 단계별 예시 포지션을 통해 규칙을 순차적으로 설명할 계획입니다.</p>
          </div>

          <div className="pt-4 flex gap-3">
            <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition">
              다음 단계 (예정)
            </button>
            <button
              className="px-4 py-2 rounded-md border border-border text-sm hover:bg-accent hover:text-accent-foreground transition"
              onClick={() => navigate('/')}
            >
              메인 메뉴로
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

