import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { MainMenuPage } from './pages/MainMenuPage'
import { TutorialPage } from './pages/TutorialPage'
import { SinglePlayPage } from './pages/SinglePlayPage'
import { TwoPlayerPage } from './pages/TwoPlayerPage'

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const isMenu = location.pathname === '/'

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">리버스 체스</h1>
        {!isMenu && (
          <button
            className="text-sm text-muted-foreground hover:text-foreground transition"
            onClick={() => navigate('/')}
          >
            메인 메뉴로
          </button>
        )}
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <Routes>
          <Route path="/" element={<MainMenuPage />} />
          <Route path="/tutorial" element={<TutorialPage />} />
          <Route path="/single" element={<SinglePlayPage />} />
          <Route path="/two" element={<TwoPlayerPage />} />
        </Routes>
      </main>
    </div>
  )
}
export default App
