import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { MainMenuPage } from './pages/MainMenuPage'
import { TutorialPage } from './pages/TutorialPage'
import { SinglePlayPage } from './pages/SinglePlayPage'
import { TwoPlayerPage } from './pages/TwoPlayerPage'

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const isMenu = location.pathname === '/'

  return (
    <div className="bg-background text-foreground">
      {!isMenu && (<header className="border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">리버스 체스</h1>
          <button
            className="text-sm text-muted-foreground hover:text-foreground transition"
            onClick={() => navigate('/')}
          >
            메인 메뉴로
          </button>
      </header>
      )}

      <main>
        <Routes>
          <Route path="/" element={<MainMenuPage />} />
          <Route path="/tutorial" element={<TutorialPage />} />
          <Route path="/single/:difficulty" element={<SinglePlayPage />} />
          <Route path="/two" element={<TwoPlayerPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  )
}
export default App
