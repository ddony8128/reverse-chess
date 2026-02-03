import { useNavigate } from 'react-router-dom';

export function PageHeader() {
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <h1 className="text-xl font-bold tracking-tight">리버스 체스</h1>
      <button
        className="text-muted-foreground hover:text-foreground text-sm transition"
        onClick={() => navigate('/')}
      >
        메인 메뉴로
      </button>
    </header>
  );
}
