import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';

type Difficulty = 'easy' | 'hard' | null;

export function SinglePlayPage() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState<Difficulty>(null);
  const [open, setOpen] = useState(false);

  const label = difficulty === 'easy' ? '쉬움' : difficulty === 'hard' ? '어려움' : '난이도 선택';

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <PageHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">혼자 하기</h2>
            <p className="text-muted-foreground text-sm">
              리버스 체스 엔진과 대전합니다. 난이도를 선택한 뒤 게임을 시작하세요.
            </p>
          </div>

          <div className="relative">
            <button
              type="button"
              className="border-border bg-background hover:bg-accent hover:text-accent-foreground inline-flex min-w-40 items-center justify-between rounded-md border px-3 py-2 text-sm transition"
              onClick={() => setOpen((prev) => !prev)}
            >
              <span>{label}</span>
              <span className="text-muted-foreground ml-2 text-xs">▼</span>
            </button>
            {open && (
              <div className="border-border bg-background absolute right-0 mt-1 w-full rounded-md border text-sm shadow-lg">
                <button
                  className="hover:bg-accent hover:text-accent-foreground w-full px-3 py-2 text-left"
                  onClick={() => {
                    setDifficulty('easy');
                    setOpen(false);
                  }}
                >
                  쉬움
                </button>
                <button
                  className="hover:bg-accent hover:text-accent-foreground w-full px-3 py-2 text-left"
                  onClick={() => {
                    setDifficulty('hard');
                    setOpen(false);
                  }}
                >
                  어려움
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          {/* 체스판 자리 */}
          <div className="border-border bg-muted flex aspect-square items-center justify-center rounded-lg border">
            <span className="text-muted-foreground text-sm">
              싱글 플레이 체스판 (엔진 연동 예정)
            </span>
          </div>

          {/* 설명 / 상태 */}
          <div className="space-y-4">
            <div className="border-border space-y-2 rounded-lg border p-4 text-sm">
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
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 rounded-md px-4 py-2 transition disabled:opacity-50"
                disabled={!difficulty}
              >
                {difficulty ? '게임 시작 (엔진 연동 예정)' : '난이도를 먼저 선택하세요'}
              </button>
              <button
                className="border-border hover:bg-accent hover:text-accent-foreground rounded-md border px-4 py-2 text-sm transition"
                onClick={() => navigate('/')}
              >
                메인 메뉴로
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
