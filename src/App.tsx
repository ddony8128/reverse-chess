import { Routes, Route, Navigate } from 'react-router-dom';
import { MainMenuPage } from './pages/MainMenuPage';
import { TutorialPage } from './pages/TutorialPage';
import { SinglePlayPage } from './pages/SinglePlayPage';
import { TwoPlayerPage } from './pages/TwoPlayerPage';
import { AnalyticsTracker } from './lib/analyticsTracker';

function App() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <AnalyticsTracker />
      <main className="min-h-dvh">
        <Routes>
          <Route path="/" element={<MainMenuPage />} />
          <Route path="/tutorial" element={<TutorialPage />} />
          <Route path="/single/:difficulty" element={<SinglePlayPage />} />
          <Route path="/two" element={<TwoPlayerPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
export default App;
