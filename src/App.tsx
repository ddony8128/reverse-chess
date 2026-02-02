import { useState } from 'react'
import { MainMenuPage } from './pages/MainMenuPage'
import { TutorialPage } from './pages/TutorialPage'
import { SinglePlayPage } from './pages/SinglePlayPage'
import { TwoPlayerPage } from './pages/TwoPlayerPage'

export type Screen = 'menu' | 'tutorial' | 'single' | 'two'

function App() {
  const [screen, setScreen] = useState<Screen>('menu')

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">리버스 체스</h1>
        {screen !== 'menu' && (
          <button
            className="text-sm text-muted-foreground hover:text-foreground transition"
            onClick={() => setScreen('menu')}
          >
            메인 메뉴로
          </button>
        )}
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-6">
        {screen === 'menu' && <MainMenuPage onSelect={setScreen} />}
        {screen === 'tutorial' && <TutorialPage onExit={() => setScreen('menu')} />}
        {screen === 'single' && <SinglePlayPage onExit={() => setScreen('menu')} />}
        {screen === 'two' && <TwoPlayerPage onExit={() => setScreen('menu')} />}
      </main>
    </div>
  )
}
export default App
