import { Board } from '@/engine/board';
import { PIECE_SYMBOLS } from '@/lib/pieceSymbols';
import { cn } from '@/lib/utils';
import {
  File,
  Rank,
  fileToIndex,
  rankToIndex,
  type Location,
  PieceType,
} from '@/engine/types';

interface ChessBoardProps {
  board: Board;
  selectedLocation: Location | null;
  validMoves: Location[];
  onSquareClick: (position: Location) => void;
  onPromotion: (position: Location, promotion: PieceType) => void;
  promotionTarget?: boolean;
  promotionLocation?: Location | null;
  promotionOptions?: PieceType[];
  flipped?: boolean;
  disabled?: boolean;
}

const FILES = Object.values(File) as File[];
const RANKS = Object.values(Rank) as Rank[];
export function ChessBoard({
  board,
  selectedLocation,
  validMoves,
  onSquareClick,
  onPromotion,
  promotionTarget = false,
  promotionLocation = null,
  promotionOptions,
  flipped = false,
  disabled = false,
}: ChessBoardProps) {
  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;
  const displayFiles = flipped ? [...FILES].reverse() : FILES;

  const isSelected = (location: Location) =>
    selectedLocation?.file === location.file && selectedLocation?.rank === location.rank;

  const isValidMove = (location: Location) =>
    validMoves.some((m) => m.file === location.file && m.rank === location.rank);

  const hasCapture = (location: Location) => {
    const piece = board.getPieceByLocation(location);
    return piece !== null && isValidMove(location);
  };

  const handleClick = (location: Location) => {
    if (disabled) return;
    onSquareClick(location);
  };

  return (
    <div className="relative">
      {/* Board border */}
      <div className="absolute -inset-3 bg-linear-to-br from-amber-900/80 to-amber-950/80 rounded-lg shadow-2xl" />

      {/* Coordinates */}
      <div className="absolute -left-6 top-0 bottom-0 flex flex-col justify-around text-muted-foreground text-sm font-medium">
        {displayRanks.map((rank) => (
          <span key={rank} className="h-12 flex items-center justify-center">
            {rank}
          </span>
        ))}
      </div>
      <div className="absolute -bottom-6 left-0 right-0 flex justify-around text-muted-foreground text-sm font-medium">
        {displayFiles.map((file) => (
          <span key={file} className="w-12 flex items-center justify-center">
            {file}
          </span>
        ))}
      </div>

      {/* Chess board */}
      <div className="relative grid grid-cols-8 gap-0 rounded-sm overflow-visible shadow-inner">
        {displayRanks.map((rank) =>
          displayFiles.map((file) => {
            const location: Location = { file, rank };
            const piece = board.getPieceByLocation(location);

            const fileIndex = fileToIndex(file);
            const rankIndex = rankToIndex(rank);
            const isLightSquare = (fileIndex + rankIndex) % 2 !== 0;
            const selected = isSelected(location);
            const validMove = isValidMove(location);
            const capture = hasCapture(location);

            const isPromotionSquare =
              promotionTarget &&
              promotionLocation &&
              promotionLocation.file === location.file &&
              promotionLocation.rank === location.rank;

            const movingPiece = isPromotionSquare
              ? board.getPieceByLocation(promotionLocation)
              : null;

            return (
              <button
                key={`${file}-${rank}`}
                onClick={() => handleClick(location)}
                disabled={disabled}
                className={cn(
                  'w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 flex items-center justify-center',
                  'transition-all duration-150 relative z-10',
                  isLightSquare ? 'chess-square-light' : 'chess-square-dark',
                  selected && 'chess-square-selected',
                  validMove && !capture && 'chess-square-moveable',
                  capture && 'chess-square-moveable chess-square-capture',
                  isPromotionSquare && 'z-30',
                  !disabled && 'hover:brightness-110 cursor-pointer',
                  disabled && 'cursor-default',
                )}
              >
                {piece && (
                  <span
                    className={cn(
                      'text-4xl md:text-5xl lg:text-6xl select-none transition-transform',
                      piece.color === 'white'
                        ? 'text-[hsl(var(--chess-white-piece))] drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]'
                        : 'text-[hsl(var(--chess-black-piece))] drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]',
                      selected && 'scale-110',
                    )}
                  >
                    {PIECE_SYMBOLS[piece.type][piece.color]}
                  </span>
                )}

                {isPromotionSquare && movingPiece && promotionOptions && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20 bg-black/70 rounded-md px-1 py-1 flex flex-row items-center justify-center space-x-1 shadow-lg">
                    {promotionOptions.map((promotion) => (
                      <div
                        key={promotion}
                        role="button"
                        tabIndex={0}
                        className="w-12 h-12 rounded-full bg-background/95 flex items-center justify-center text-lg shadow cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPromotion(location, promotion);
                        }}
                      >
                        {PIECE_SYMBOLS[promotion][movingPiece.color]}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
};
