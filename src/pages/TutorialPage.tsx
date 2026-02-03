import { useNavigate } from 'react-router-dom';
import { Board } from '@/engine/board';
import { useMemo, useState, useEffect } from 'react';
import { Color, reverseColor, locationToKey } from '@/engine/types';
import type { Location, PieceType, Move } from '@/engine/types';
import { createEmptyBoard, cloneBoard } from '@/engine/boardUtils';
import { ArrowRight, ArrowLeft, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChessBoard } from '@/components/ChessBoard';
import { PageHeader } from '@/components/PageHeader';
import { Game } from '@/engine/game';
import { createTutorialSteps } from '@/assets/tutorialStep';


export function TutorialPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [validMoves, setValidMoves] = useState<Location[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [stepCompleted, setStepCompleted] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<Color>(Color.Black);
  const [promotionActive, setPromotionActive] = useState(false);
  const [promotionLocation, setPromotionLocation] = useState<Location | null>(null);
  const [promotionOptionsState, setPromotionOptionsState] = useState<PieceType[] | undefined>(
    undefined,
  );

  const steps = useMemo(() => createTutorialSteps(), []);
  const step = steps[currentStep];
  
  useEffect(() => {
    const clonedBoard = cloneBoard(step.board);
    const newGame = new Game(clonedBoard, Color.Black);

    setBoard(clonedBoard);
    setGame(newGame);
    setSelectedLocation(null);
    setValidMoves([]);
    setLegalMoves(newGame.getLegalMovesNoCache(Color.Black));
    setCurrentPlayer(Color.Black);
    setPromotionActive(false);
    setPromotionLocation(null);
    setPromotionOptionsState(undefined);

    if (step.expected) {
      setStepCompleted(step.expected.check(clonedBoard));
    } else {
      setStepCompleted(true);
    }
  }, [currentStep, step]);

  const handleSquareClick = (location: Location) => {
    if (promotionActive) return;
    if (step.expected && stepCompleted) return;
    if (!board || !game) return;

    const clickedPiece = board.getPieceByLocation(location);
    const selectedPiece = selectedLocation ? board.getPieceByLocation(selectedLocation) : null;

    if (selectedPiece && validMoves.some((m) => locationToKey(m) === locationToKey(location))) {
      const fromKey = locationToKey(selectedLocation!);
      const toKey = locationToKey(location);

      const candidateMoves = legalMoves.filter(
        (m) => locationToKey(m.from) === fromKey && locationToKey(m.to) === toKey,
      );

      const promotionMoves = candidateMoves.filter((m) => m.promotion);
      const promotionTypes = Array.from(
        new Set(
          promotionMoves
            .map((m) => m.promotion)
            .filter((p): p is PieceType => !!p),
        ),
      );
      const isPromotionMove = promotionTypes.length > 0;

      board.movePiece(selectedPiece, location);

      if (isPromotionMove) {
        setPromotionActive(true);
        setPromotionLocation(location);
        setPromotionOptionsState(promotionTypes);
        setSelectedLocation(null);
        setValidMoves([]);
        return;
      }

      const nextPlayer = reverseColor(currentPlayer);
      setSelectedLocation(null);
      setValidMoves([]);
      setCurrentPlayer(nextPlayer);
      setLegalMoves(game.getLegalMovesNoCache(nextPlayer));

      if (step.expected && step.expected.check(board)) {
        setStepCompleted(true);
      }
      return;
    }

    if (clickedPiece && clickedPiece.color === currentPlayer) {
      if (selectedLocation && locationToKey(selectedLocation) === locationToKey(location)) {
        setSelectedLocation(null);
        setValidMoves([]);
      } else {
        const fromKey = locationToKey(location);
        const pieceMoves = legalMoves.filter((m) => locationToKey(m.from) === fromKey);
        const destinations: Location[] = pieceMoves.map((m) => m.to);

        setSelectedLocation(location);
        setValidMoves(destinations);
      }
    } else {
      setSelectedLocation(null);
      setValidMoves([]);
    }
  };

  const handlePromotion = (location: Location, promotion: PieceType) => {
    if (!board || !game) return;

    const piece = board.getPieceByLocation(location);
    if (!piece) return;

    board.changePieceType(piece, promotion);

    setPromotionActive(false);
    setPromotionLocation(null);
    setPromotionOptionsState(undefined);
    setSelectedLocation(null);
    setValidMoves([]);

    const nextPlayer = reverseColor(currentPlayer);
    setCurrentPlayer(nextPlayer);
    setLegalMoves(game.getLegalMovesNoCache(nextPlayer));

    if (step.expected && step.expected.check(board)) {
      setStepCompleted(true);
    }
  };

  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      navigate('/');
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleRestart = () => {
    const clonedBoard = cloneBoard(step.board);
    const newGame = new Game(clonedBoard, Color.Black);

    setBoard(clonedBoard);
    setGame(newGame);
    setSelectedLocation(null);
    setValidMoves([]);
    setLegalMoves(newGame.getLegalMovesNoCache(Color.Black));

    if (step.expected) {
      setStepCompleted(step.expected.check(clonedBoard));
    } else {
      setStepCompleted(true);
    }
    setCurrentPlayer(Color.Black);
    setPromotionActive(false);
    setPromotionLocation(null);
    setPromotionOptionsState(undefined);
  };

  const isLastStep = currentStep === steps.length - 1;
  const canProceed = stepCompleted;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--gradient-dark)' }}
    >
      <PageHeader />
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-primary mb-2">
            {step.title}
          </h2>
          <div className="text-muted-foreground text-sm">
            {currentStep + 1} / {steps.length}
          </div>
        </div>

        {/* Chess Board */}
        <div className="mb-8 relative">
          <ChessBoard
            board={board ?? createEmptyBoard()}
            selectedLocation={selectedLocation}
            validMoves={validMoves}
            onSquareClick={handleSquareClick}
            onPromotion={handlePromotion}
            promotionTarget={promotionActive}
            promotionLocation={promotionLocation}
            promotionOptions={promotionActive ? promotionOptionsState : undefined}
            disabled={false}
          />
          {step.expected && stepCompleted && (
            <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
              <div className="px-6 py-3 rounded-lg bg-black/80 text-xl md:text-2xl font-semibold text-primary shadow-2xl">
                {step.expected.message}
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="max-w-md text-left mb-8 px-4">
          <div className="text-foreground text-base leading-relaxed text-left min-h-16">
            {step.description}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            이전
          </Button>

          <Button
            onClick={handleNextStep}
            disabled={!canProceed}
            className="btn-menu flex items-center gap-2"
          >
            {isLastStep ? '완료' : '다음'}
            {!isLastStep && <ArrowRight className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            onClick={handleRestart}
            className="btn-menu flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-4 h-4" />
            다시하기
          </Button>
          <Button
            variant="ghost"
            onClick={handleNextStep}
            className="btn-menu flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <SkipForward className="w-4 h-4" />
            건너뛰기
          </Button>
        </div>
      </div>
    </div>
  );

}

