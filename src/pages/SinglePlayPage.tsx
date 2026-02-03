import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Difficulty = 'easy' | 'hard' | null

export function SinglePlayPage() {
  const navigate = useNavigate()
  const [difficulty, setDifficulty] = useState<Difficulty>(null)
  const [open, setOpen] = useState(false)

  const label =
    difficulty === 'easy' ? '쉬움' : difficulty === 'hard' ? '어려움' : '난이도 선택'

  return (
    <div className="w-full max-w-5xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">혼자 하기</h2>
          <p className="text-sm text-muted-foreground">
            리버스 체스 엔진과 대전합니다. 난이도를 선택한 뒤 게임을 시작하세요.
          </p>
        </div>

        <div className="relative">
          <button
            type="button"
            className="inline-flex items-center justify-between min-w-40 px-3 py-2 rounded-md border border-border bg-background text-sm hover:bg-accent hover:text-accent-foreground transition"
            onClick={() => setOpen((prev) => !prev)}
          >
            <span>{label}</span>
            <span className="ml-2 text-xs text-muted-foreground">▼</span>
          </button>
          {open && (
            <div className="absolute right-0 mt-1 w-full rounded-md border border-border bg-background shadow-lg text-sm">
              <button
                className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setDifficulty('easy')
                  setOpen(false)
                }}
              >
                쉬움
              </button>
              <button
                className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setDifficulty('hard')
                  setOpen(false)
                }}
              >
                어려움
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] gap-6">
        {/* 체스판 자리 */}
        <div className="aspect-square rounded-lg border border-border bg-muted flex items-center justify-center">
          <span className="text-sm text-muted-foreground">
            싱글 플레이 체스판 (엔진 연동 예정)
          </span>
        </div>

        {/* 설명 / 상태 */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
            <p>
              <span className="font-medium">선후:</span>{' '}
              <span className="text-muted-foreground">흑이 선공, 선후는 랜덤으로 결정 예정</span>
            </p>
            <p className="text-muted-foreground">
              플레이어의 진영에 맞춰 체스판 상·하 방향이 자동으로 뒤집히도록 구현할 계획입니다.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              className="flex-1 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
              disabled={!difficulty}
            >
              {difficulty ? '게임 시작 (엔진 연동 예정)' : '난이도를 먼저 선택하세요'}
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

