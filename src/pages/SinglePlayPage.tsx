import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Board } from '@/engine/board';
import { Game } from '@/engine/game';
import { AIWorkerClient } from '@/engine/aiWorkerClient';
import {
  Color,
  type Move,
  type Location,
  PieceType,
  GameEndReason,
  locationToKey,
  difficultyLevel,
  type DifficultyLevel,
} from '@/engine/types';
import { cloneBoard } from '@/engine/boardUtils';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TurnIndicator from '@/components/TurnIndicator';
import { ChessBoard } from '@/components/ChessBoard';
import { GameResultModal } from '@/components/GameResultModal';
import { CheckIndicator } from '@/components/CheckIndicator';
import { createAIPlayer, type AIPlayerAPI } from '@/engine/aiPlayer';

export function SinglePlayPage() {
  const { difficulty } = useParams<{ difficulty: string }>();

  const resolvedDifficulty: DifficultyLevel =
    difficulty === 'hard' ? difficultyLevel.Hard : difficultyLevel.Easy;

  const [board, setBoard] = useState<Board | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [validMoves, setValidMoves] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Color>(Color.Black);
  const [humanColor, setHumanColor] = useState<Color>(Color.White);
  const [aiColor, setAiColor] = useState<Color>(Color.Black);
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [aiPlayer, setAiPlayer] = useState<AIPlayerAPI | null>(null);
  const [promotionActive, setPromotionActive] = useState(false);
  const [promotionLocation, setPromotionLocation] = useState<Location | null>(null);
  const [promotionOptionsState, setPromotionOptionsState] = useState<PieceType[] | undefined>(
    undefined,
  );
  const [captureForced, setCaptureForced] = useState(false);
  const [isInCheck, setIsInCheck] = useState(false);
  const [endReason, setEndReason] = useState<GameEndReason | null>(null);
  const [winner, setWinner] = useState<Color | null>(null);
  const [isEnded, setIsEnded] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);

  const aiClientRef = useRef<AIWorkerClient | null>(null);
  const aiRequestGenerationRef = useRef(0);

  useEffect(() => {
    startNewGame();
  }, []);

  useEffect(() => {
    aiClientRef.current = new AIWorkerClient();
    return () => {
      aiClientRef.current?.dispose();
      aiClientRef.current = null;
    };
  }, []);

  const startNewGame = () => {
    const newGame = new Game();
    newGame.startGame();
    setGame(newGame);
    setBoard(newGame.getBoard());

    const humanPlaysBlack = Math.random() < 0.5;
    const nextHumanColor = humanPlaysBlack ? Color.Black : Color.White;
    const nextAiColor = humanPlaysBlack ? Color.White : Color.Black;
    setHumanColor(nextHumanColor);
    setAiColor(nextAiColor);
    setBoardFlipped(!humanPlaysBlack);

    const ai = createAIPlayer(resolvedDifficulty);
    setAiPlayer(ai);

    setSelectedLocation(null);
    setValidMoves([]);
    const firstPlayer = newGame.getCurrentPlayer();
    setLegalMoves(newGame.getLegalMoves(firstPlayer));
    setCaptureForced(newGame.isCaptureForced());
    setCurrentPlayer(firstPlayer);
    setPromotionActive(false);
    setPromotionLocation(null);
    setPromotionOptionsState(undefined);
    setIsEnded(false);
    setEndReason(null);
    setWinner(null);
    setEndModalOpen(false);
    setIsInCheck(false);
    setCaptureForced(false);
  };

  const isPlayerTurn = currentPlayer === humanColor;

  useEffect(() => {
    if (!game || !board || !aiPlayer || aiClientRef.current === null) return;
    if (isEnded) return;
    if (currentPlayer !== aiColor) return;

    const requestGeneration = ++aiRequestGenerationRef.current;

    const makeRequest = (resetAI: boolean, isRetry: boolean) => {
      const client = aiClientRef.current;
      if (!client) return;

      const warmUp = false;
      const timeoutMs = 30000;

      const fallbackWithRandomMove = () => {
        if (!game || isEnded || currentPlayer !== aiColor) {
          return;
        }
        const legal = game.getLegalMoves(aiColor);
        if (legal.length === 0) {
          return;
        }
        const randomMove = legal[Math.floor(Math.random() * legal.length)];
        try {
          handleTurnProgress(
            aiColor,
            randomMove.from,
            randomMove.to,
            randomMove.promotion ?? undefined,
          );
        } catch (e) {
          console.error(e);
        }
      };

      const handleFailure = (error: unknown) => {
        console.error(error);
        if (requestGeneration !== aiRequestGenerationRef.current) {
          return;
        }
        if (!game || isEnded || currentPlayer !== aiColor) {
          return;
        }
        if (!isRetry) {
          window.setTimeout(() => makeRequest(true, true), 50);
        } else {
          fallbackWithRandomMove();
        }
      };

      try {
        const getMoveWithTimeout = () =>
          new Promise<Move>((resolve, reject) => {
            const timerId = window.setTimeout(() => {
              reject(new Error('AI move timeout'));
            }, timeoutMs);

            client
              .getNextMove(board, currentPlayer, resolvedDifficulty, warmUp, resetAI)
              .then((move) => {
                window.clearTimeout(timerId);
                resolve(move);
              })
              .catch((error) => {
                window.clearTimeout(timerId);
                reject(error);
              });
          });

        getMoveWithTimeout()
          .then((move) => {
            if (requestGeneration !== aiRequestGenerationRef.current) {
              return;
            }
            if (!game || isEnded || currentPlayer !== aiColor) {
              return;
            }

            try {
              handleTurnProgress(aiColor, move.from, move.to, move.promotion ?? undefined);
            } catch (error) {
              handleFailure(error);
            }
          })
          .catch((error) => {
            handleFailure(error);
          });
      } catch (error) {
        handleFailure(error);
      }
    };

    const timer = window.setTimeout(() => makeRequest(false, false), 10);

    return () => {
      window.clearTimeout(timer);
    };
  }, [game, board, aiPlayer, currentPlayer, aiColor, isEnded]);

  const handleTurnProgress = (
    color: Color,
    from: Location,
    to: Location,
    promotion?: PieceType,
  ) => {
    if (!board || !game) return;
    const result = game.progressTurn(color, from, to, promotion);
    if (!result.success) {
      console.error(result.error);
      throw new Error(result.error);
    }
    const nextPlayer = game.getCurrentPlayer();
    setLegalMoves(game.getLegalMoves(nextPlayer));
    setCurrentPlayer(nextPlayer);
    setCaptureForced(game.isCaptureForced());
    setIsInCheck(game.checkForCheck(nextPlayer).isInCheck);
    if (result.end) {
      setEndReason(result.endReason ?? null);
      setWinner(result.winner ?? null);
      setIsEnded(true);
      setEndModalOpen(true);
    }
  };

  const handleSquareClick = (location: Location) => {
    if (promotionActive || isEnded) return;
    if (!isPlayerTurn) return;
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
        virtualBoard.movePiece(virtualSelectedPiece!, location);
        setBoard(virtualBoard);
        setPromotionActive(true);
        setPromotionLocation(location);
        setPromotionOptionsState(promotionTypes);
        setValidMoves([]);
        return;
      }

      setSelectedLocation(null);
      setValidMoves([]);
      handleTurnProgress(currentPlayer, selectedLocation!, location);
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
    if (!board || !game || isEnded) return;

    const piece = board.getPieceByLocation(location);
    if (!piece) return;

    const currentSelectedLocation = selectedLocation;
    setBoard(game.getBoard());
    setPromotionActive(false);
    setPromotionLocation(null);
    setPromotionOptionsState(undefined);
    setSelectedLocation(null);
    setValidMoves([]);

    handleTurnProgress(currentPlayer, currentSelectedLocation!, location, promotion);
  };

  const announceText = () => {
    if (isEnded) {
      switch (endReason) {
        case GameEndReason.Checkmate:
          return `체크메이트!`;
        case GameEndReason.Stalemate:
          return `스틸메이트!`;
        case GameEndReason.LoneIsland:
          return `외딴 섬!`;
        case GameEndReason.OnlyKingLeft:
          return `왕만 남음!`;
        default:
          return `게임 종료!`;
      }
    } else if (isInCheck) {
      return `체크!`;
    } else if (captureForced) {
      return `강제 캡처!`;
    }
    return null;
  };

  const text = announceText();

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <PageHeader />
      <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-8">
        <div className="inline-block">
          {/* Turn indicator + status + restart (centered over board width) */}
          <div className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center">
            {/* Left slot */}
            <div className="min-w-0 justify-self-start">
              {text ? <CheckIndicator text={text} /> : null}
            </div>

            {/* Center slot: 항상 정중앙 */}
            <div className="justify-self-center">
              <TurnIndicator
                currentTurn={currentPlayer}
                isSinglePlay={true}
                isPlayerTurn={isPlayerTurn}
              />
            </div>

            {/* Right slot */}
            <div className="min-w-0 justify-self-end">
              {isEnded ? (
                <Button
                  variant="ghost"
                  onClick={startNewGame}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />한 판 더 하기
                </Button>
              ) : null}
            </div>
          </div>

          {/* Chess Board - White at bottom (not flipped) */}
          <ChessBoard
            board={board ?? new Board()}
            selectedLocation={selectedLocation}
            validMoves={validMoves}
            onSquareClick={handleSquareClick}
            onPromotion={handlePromotion}
            promotionTarget={promotionActive}
            promotionLocation={promotionLocation}
            promotionOptions={promotionOptionsState}
            flipped={boardFlipped}
            disabled={isEnded || !isPlayerTurn}
          />
        </div>

        {/* Game result modal */}
        {endModalOpen && (
          <GameResultModal
            winner={winner ?? 'draw'}
            endReason={endReason ?? null}
            singlePlayerColor={humanColor}
            isTwoPlayer={false}
            onConfirm={() => setEndModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
