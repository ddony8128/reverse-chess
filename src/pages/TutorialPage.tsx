import { useNavigate } from 'react-router-dom';
import { Board } from '@/engine/board';
import { useMemo, useState, useEffect } from 'react';
import { Color, locationToKey } from '@/engine/types';
import type { Location, PieceType, Move } from '@/engine/types';
import { createEmptyBoard, cloneBoard } from '@/engine/boardUtils';
import { ArrowRight, ArrowLeft, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChessBoard } from '@/components/ChessBoard';
import { PageHeader } from '@/components/PageHeader';
import { Game } from '@/engine/game';
import { createTutorialSteps } from '@/assets/tutorialStep';
import { trackEvent } from '@/lib/utils';
import { EventName, type EventParams } from '@/types/analyticsEvent';

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
    trackEvent(EventName.TutorialStart, {
    } as EventParams);
  }, []);
  
  useEffect(() => {
    if (currentStep < steps.length - 1) {
      trackEvent(EventName.TutorialStepView, {
        step_name: step.title,
      } as EventParams);
    }
  }, [currentStep, step.title]);
  
  useEffect(() => {
    const clonedBoard = cloneBoard(step.board);
    const newGame = new Game(clonedBoard, Color.Black);

    setBoard(clonedBoard);
    setGame(newGame);
    setSelectedLocation(null);
    setValidMoves([]);
    setLegalMoves(newGame.getLegalMoves(Color.Black));
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
        new Set(promotionMoves.map((m) => m.promotion).filter((p): p is PieceType => !!p)),
      );
      const isPromotionMove = promotionTypes.length > 0;

      if (isPromotionMove) {
        const virtualBoard = cloneBoard(board);
        const virtualSelectedPiece = virtualBoard.getPieceByLocation(selectedLocation!);
        if (virtualSelectedPiece) {
          virtualBoard.movePiece(virtualSelectedPiece, location);
        }
        setBoard(virtualBoard);
        setPromotionActive(true);
        setPromotionLocation(location);
        setPromotionOptionsState(promotionTypes);
        setValidMoves([]);
        return;
      }

      const move = candidateMoves[0];
      if (!move) return;

      game.applyMoveForSearch(move);
      const updatedBoard = game.getBoard();
      const nextPlayer = game.getCurrentPlayer();

      setBoard(updatedBoard);
      setSelectedLocation(null);
      setValidMoves([]);
      setCurrentPlayer(nextPlayer);
      setLegalMoves(game.getLegalMoves(nextPlayer));

      if (step.expected && step.expected.check(updatedBoard)) {
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

    if (!selectedLocation) return;

    const fromKey = locationToKey(selectedLocation);
    const toKey = locationToKey(location);

    const promotionMove = legalMoves.find(
      (m) =>
        locationToKey(m.from) === fromKey &&
        locationToKey(m.to) === toKey &&
        m.promotion === promotion,
    );
    if (!promotionMove) return;

    const baseBoard = game.getBoard();
    setBoard(baseBoard);

    setPromotionActive(false);
    setPromotionLocation(null);
    setPromotionOptionsState(undefined);
    setSelectedLocation(null);
    setValidMoves([]);

    game.applyMoveForSearch(promotionMove);
    const finalBoard = game.getBoard();
    const nextPlayer = game.getCurrentPlayer();

    setBoard(finalBoard);
    setCurrentPlayer(nextPlayer);
    setLegalMoves(game.getLegalMoves(nextPlayer));

    if (step.expected && step.expected.check(finalBoard)) {
      setStepCompleted(true);
    }
  };

  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      trackEvent(EventName.TutorialComplete, {
      } as EventParams);
      navigate('/');
    }
  };

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
    setLegalMoves(newGame.getLegalMoves(Color.Black));

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
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--gradient-dark)' }}>
      <PageHeader />
      <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <h2 className="text-primary mb-2 text-2xl font-bold md:text-3xl">{step.title}</h2>
          <div className="text-muted-foreground text-sm">
            {currentStep + 1} / {steps.length}
          </div>
        </div>

        {/* Chess Board */}
        <div className="relative mb-8">
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
            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
              <div className="text-primary rounded-lg bg-black/80 px-6 py-3 text-xl font-semibold shadow-2xl md:text-2xl">
                {step.expected.message}
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="mb-8 max-w-md px-4 text-left">
          <div className="text-foreground min-h-22 text-left text-base leading-relaxed">
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
            <ArrowLeft className="h-4 w-4" />
            이전
          </Button>

          <Button
            onClick={handleNextStep}
            disabled={!isLastStep && !canProceed}
            className="btn-menu flex items-center gap-2"
          >
            {isLastStep ? '완료' : '다음'}
            {!isLastStep && <ArrowRight className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            onClick={handleRestart}
            className="btn-menu text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            다시하기
          </Button>
          <Button
            variant="ghost"
            onClick={handleNextStep}
            className="btn-menu text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            <SkipForward className="h-4 w-4" />
            건너뛰기
          </Button>
        </div>
      </div>
    </div>
  );
}
