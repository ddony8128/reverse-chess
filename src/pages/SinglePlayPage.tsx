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
import { EventName, type EventParams } from '@/types/analyticsEvent';
import { trackEvent } from '@/lib/utils';

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

  const gameIdRef = useRef<string | null>(null);
  const gameStartAtRef = useRef<number | null>(null);
  const endedSentRef = useRef<boolean>(false);

  useEffect(() => {
    startNewGame();
  }, [resolvedDifficulty]);

  useEffect(() => {
    aiClientRef.current = new AIWorkerClient();
    return () => {
      aiClientRef.current?.dispose();
      aiClientRef.current = null;
    };
  }, [resolvedDifficulty]);

  const startNewGame = () => {
    if (aiPlayer) {
      aiPlayer.clearTranspositionTable();
    }

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

    const ai = aiPlayer ?? createAIPlayer(resolvedDifficulty);
    if (!aiPlayer) setAiPlayer(ai);

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

    const newGameId = crypto.randomUUID();
    gameIdRef.current = newGameId;
    gameStartAtRef.current = Date.now();
    endedSentRef.current = false;

    trackEvent(EventName.GameStart, {
      mode: 'single',
      game_id: newGameId,
      difficulty: resolvedDifficulty === difficultyLevel.Easy ? 'easy' : 'hard',
    } as EventParams);
  };

  const isPlayerTurn = currentPlayer === humanColor;

  useEffect(() => {
    return () => {
      if (!endedSentRef.current && gameIdRef.current) {
        const duration = gameStartAtRef.current ? Date.now() - gameStartAtRef.current : undefined;

        trackEvent(EventName.GameEnd, {
          mode: 'single',
          game_id: gameIdRef.current,
          difficulty: resolvedDifficulty === difficultyLevel.Easy ? 'easy' : 'hard',
          end_reason: 'abort',
          duration_ms: duration,
        } as EventParams);
      }
    };
  }, [isEnded]);

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
        trackEvent(EventName.Error, {
          mode: 'single',
          difficulty: resolvedDifficulty === difficultyLevel.Easy ? 'easy' : 'hard',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        } as EventParams);

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
      if (!endedSentRef.current) {
        endedSentRef.current = true;

        const durationMs = gameStartAtRef.current ? Date.now() - gameStartAtRef.current : undefined;

        const winnerParam =
          result.winner === Color.White
            ? 'white'
            : result.winner === Color.Black
              ? 'black'
              : 'draw';

        const endReasonParam =
          result.endReason === GameEndReason.Checkmate
            ? 'checkmate'
            : result.endReason === GameEndReason.Stalemate
              ? 'stalemate'
              : result.endReason === GameEndReason.LoneIsland
                ? 'lone_island'
                : result.endReason === GameEndReason.OnlyKingLeft
                  ? 'only_king_left'
                  : undefined;

        trackEvent(EventName.GameEnd, {
          mode: 'single',
          game_id: gameIdRef.current ?? undefined,
          color_human: humanColor === Color.White ? 'white' : 'black',
          winner: winnerParam,
          end_reason: endReasonParam,
          duration_ms: durationMs,
          difficulty: resolvedDifficulty === difficultyLevel.Easy ? 'easy' : 'hard',
        } as EventParams);
      }

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

      const difficultyText = resolvedDifficulty === difficultyLevel.Easy ? '쉬움' : '어려움';
      const winText = winner === humanColor ? '승리' : '패배';
      return `(${difficultyText}) ${winText}!`;
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
        <div className="grid grid-cols-[max-content]">
          {/* 첫 번째 줄: TurnIndicator 가운데 */}
          <div className="flex justify-center pb-4">
            <TurnIndicator
              currentTurn={currentPlayer}
              isSinglePlay={true}
              isPlayerTurn={isPlayerTurn}
              isEnded={isEnded}
              winner={winner}
            />
          </div>
          {/* 두 번째 줄: 왼쪽 CheckIndicator, 오른쪽 한 판 더 하기 (빈 상태에서도 높이 고정) */}
          <div className="mb-6 flex min-h-10 w-full items-center justify-between">
            <div>{text ? <CheckIndicator text={text} /> : null}</div>
            <div>
              {isEnded ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    trackEvent(EventName.RematchClick, {
                      mode: 'single',
                      difficulty: resolvedDifficulty === difficultyLevel.Easy ? 'easy' : 'hard',
                      prev_game_id: gameIdRef.current ?? undefined,
                    } as EventParams);
                    startNewGame();
                  }}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm sm:text-lg"
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
            difficulty={resolvedDifficulty === difficultyLevel.Easy ? 'easy' : 'hard'}
            onConfirm={() => setEndModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
