function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="space-y-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight">reverse-chess</h1>
        <p className="text-muted-foreground">
          Tailwind가 제대로 적용되었는지 확인하는 테스트 페이지입니다.
        </p>

        <div className="flex justify-center gap-4">
          <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition">
            기본 버튼
          </button>
          <button className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition">
            세컨더리 버튼
          </button>
        </div>

        <div className="mt-6 flex justify-center gap-4">
          <div className="w-10 h-10 rounded-full bg-destructive animate-bounce" />
          <div className="w-10 h-10 rounded-full bg-accent animate-pulse" />
        </div>

        <p className="text-xs text-muted-foreground">
          위 색상/애니메이션이 보이면 `index.css`의 Tailwind 설정이 잘 동작하는 것입니다.
        </p>
      </div>
    </div>
  )
}

export default App
