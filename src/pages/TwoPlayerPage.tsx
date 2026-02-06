import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Board } from '@/engine/board';
import { Game } from '@/engine/game';
import { trackEvent } from '@/lib/utils';
import { EventName, type EventParams } from '@/types/analyticsEvent';
import {
  Color,
  type Move,
  type Location,
  PieceType,
  GameEndReason,
  locationToKey,
} from '@/engine/types';
import { cloneBoard } from '@/engine/boardUtils';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TurnIndicator from '@/components/TurnIndicator';
import { ChessBoard } from '@/components/ChessBoard';
import { GameResultModal } from '@/components/GameResultModal';
import { CheckIndicator } from '@/components/CheckIndicator';

export function TwoPlayerPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [validMoves, setValidMoves] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Color>(Color.Black);
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

  const gameIdRef = useRef<string | null>(null);
  const gameStartAtRef = useRef<number | null>(null);
  const endedSentRef = useRef<boolean>(false);

  useEffect(() => {
    startNewGame();
  }, []);

  useEffect(() => {
    return () => {
      if (!endedSentRef.current && gameIdRef.current) {
        const duration = gameStartAtRef.current ? Date.now() - gameStartAtRef.current : undefined;

        trackEvent(EventName.GameEnd, {
          mode: 'two',
          game_id: gameIdRef.current,
          end_reason: 'abort',
          duration_ms: duration,
        });
      }
    };
  }, [isEnded]);

  const startNewGame = () => {
    const newGame = new Game();
    newGame.startGame();
    setGame(newGame);
    setBoard(newGame.getBoard());

    setSelectedLocation(null);
    setValidMoves([]);
    setLegalMoves(newGame.getLegalMoves(Color.Black));
    setCurrentPlayer(Color.Black);
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
      mode: 'two',
      game_id: newGameId,
    } as EventParams);
  };

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
      return;
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
          mode: 'two',
          game_id: gameIdRef.current ?? undefined,
          winner: winnerParam,
          end_reason: endReasonParam,
          duration_ms: durationMs,
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
        <div className="grid grid-cols-[max-content]">
          {/* 첫 번째 줄: TurnIndicator 가운데 */}
          <div className="flex justify-center pb-4">
            <TurnIndicator
              currentTurn={currentPlayer}
              isSinglePlay={false}
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
                      mode: 'two',
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
            flipped={false}
            disabled={isEnded}
          />
        </div>

        {/* Game result modal */}
        {endModalOpen && (
          <GameResultModal
            winner={winner ?? 'draw'}
            endReason={endReason ?? null}
            isTwoPlayer={true}
            onConfirm={() => setEndModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
