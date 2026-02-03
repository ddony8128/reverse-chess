import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'

export function TwoPlayerPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PageHeader />
      <div className="flex-1 w-full max-w-5xl mx-auto space-y-6 p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">둘이 하기</h2>
            <p className="text-sm text-muted-foreground">
              오프라인 2인용 테이블 모드입니다. 백이 아래에 위치한 체스판으로 고정됩니다.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] gap-6">
          {/* 체스판 자리 */}
          <div className="aspect-square rounded-lg border border-border bg-muted flex items-center justify-center">
            <span className="text-sm text-muted-foreground">
              2인용 체스판 (턴 관리 / 승패 판정 연동 예정)
            </span>
          </div>

          {/* 설명 / 종료 모달 자리 */}
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>- 플레이어 1: 백 (보드 하단)</p>
            <p>- 플레이어 2: 흑 (보드 상단)</p>
            <p>- 승리 시 어느 플레이어가 이겼는지 알려주는 모달을 띄울 예정입니다.</p>

            <button
              className="mt-4 px-4 py-2 rounded-md border border-border text-sm hover:bg-accent hover:text-accent-foreground transition"
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

