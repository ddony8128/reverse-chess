import { useNavigate } from 'react-router-dom';

export function PageHeader() {
  const navigate = useNavigate();

  return (
    <header className="border-b px-6 py-4 flex items-center justify-between">
      <h1 className="text-xl font-bold tracking-tight">리버스 체스</h1>
      <button
        className="text-sm text-muted-foreground hover:text-foreground transition"
        onClick={() => navigate('/')}
      >
        메인 메뉴로
      </button>
    </header>
  );
}

