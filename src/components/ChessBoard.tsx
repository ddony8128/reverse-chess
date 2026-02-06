import { Board } from '@/engine/board';
import { PIECE_SYMBOLS } from '@/lib/pieceSymbols';
import { cn } from '@/lib/utils';
import { File, Rank, fileToIndex, rankToIndex, type Location, PieceType } from '@/engine/types';

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

  const squareClass = 'h-[clamp(36px,9.5vw,64px)] w-[clamp(36px,9.5vw,64px)]';
  const coordTextClass = 'text-[clamp(9px,2.2vw,12px)]';
  const squareSize = 'clamp(36px,9.5vw,64px)';
  const coordSize = `calc(${squareSize} / 4)`;
  return (
    <div className="relative rounded-lg p-3 shadow-2xl bg-linear-to-br from-amber-900/80 to-amber-950/80">
      {/* 9x9 grid: (좌측 좌표 1열) + (보드 8열) / (보드 8행) + (아래 좌표 1행) */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${coordSize} repeat(8, ${squareSize})`,
          gridTemplateRows: `repeat(8, ${squareSize}) ${coordSize}`,
        }}
      >
        {/* 좌측 랭크 좌표: col 1, row 1~8 */}
        <div className="col-start-1 col-end-2 row-start-1 row-end-9 flex flex-col justify-between pr-1 text-muted-foreground font-medium">
          {displayRanks.map((rank) => (
            <div
              key={rank}
              className={cn('flex items-center justify-center select-none', coordTextClass)}
              style={{
                width: coordSize,
                height: squareSize,
              }}
            >
              {rank}
            </div>
          ))}
        </div>

        {/* 보드 영역: col 2~9, row 1~8 */}
        <div className="col-start-2 col-end-10 row-start-1 row-end-9">
          <div className="grid grid-cols-8 overflow-visible rounded-sm shadow-inner">
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

                const movingPiece = isPromotionSquare ? board.getPieceByLocation(promotionLocation) : null;

                return (
                  <button
                    key={`${file}-${rank}`}
                    onClick={() => handleClick(location)}
                    disabled={disabled}
                    className={cn(
                      'relative z-10 flex items-center justify-center transition-all duration-150',
                      squareClass,
                      isLightSquare ? 'chess-square-light' : 'chess-square-dark',
                      selected && 'chess-square-selected',
                      validMove && !capture && 'chess-square-moveable',
                      capture && 'chess-square-moveable chess-square-capture',
                      isPromotionSquare && 'z-30',
                      !disabled && 'cursor-pointer hover:brightness-110',
                      disabled && 'cursor-default',
                    )}
                  >
                    {piece && (
                      <span
                        className={cn(
                          // 말 크기도 칸 크기에 맞춰 clamp
                          'select-none transition-transform text-[clamp(26px,7vw,48px)]',
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
                      <div className="absolute -top-10 left-1/2 z-20 flex -translate-x-1/2 flex-row items-center justify-center space-x-1 rounded-md bg-black/70 px-1 py-1 shadow-lg">
                        {promotionOptions.map((promotion) => (
                          <div
                            key={promotion}
                            role="button"
                            tabIndex={0}
                            className={cn(
                              'bg-background/95 cursor-pointer items-center justify-center rounded-full shadow flex',
                              // 프로모션 선택도 칸 크기 따라감
                              'h-[clamp(32px,9vw,48px)] w-[clamp(32px,9vw,48px)] text-[clamp(14px,4vw,18px)]',
                            )}
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

        {/* 아래 파일 좌표: col 2~9, row 9 */}
        <div className="col-start-2 col-end-10 row-start-9 row-end-10 flex justify-between pt-1 text-muted-foreground font-medium">
          {displayFiles.map((file) => (
            <div
              key={file}
              className={cn('flex items-center justify-center select-none', coordTextClass)}
              style={{
                width: squareSize,
                height: coordSize,
              }}
            >
              {file}
            </div>
          ))}
        </div>

        {/* 좌하단 빈 칸 (좌표 교차점) */}
        <div className="col-start-1 col-end-2 row-start-9 row-end-10" />
      </div>
    </div>
  );
}

