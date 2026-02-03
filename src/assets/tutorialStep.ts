import { Board } from '@/engine/board';
import { createEmptyBoard } from '@/engine/boardUtils';

export interface TutorialStep {
  title: string;
  description: string;
  board: Board;
  expected?: {
    check: (board: Board) => boolean;
    message: string;
  };
}

export const createTutorialSteps = (): TutorialStep[] => {
  // Step 1: Intro - standard starting position
  const introBoard = new Board();

  // Step 2: Lose all pieces (except king) wins
  const losePiecesBoard = createEmptyBoard();
  losePiecesBoard.setPiece({ file: 'd', rank: 8 }, { type: 'king', color: 'black' });
  losePiecesBoard.setPiece({ file: 'd', rank: 5 }, { type: 'pawn', color: 'black' });
  losePiecesBoard.setPiece({ file: 'e', rank: 4 }, { type: 'pawn', color: 'white' });
  losePiecesBoard.setPiece({ file: 'd', rank: 1 }, { type: 'king', color: 'white' });

  // Step 3: Checkmated side wins
  const checkmateBoard = createEmptyBoard();
  checkmateBoard.setPiece({ file: 'h', rank: 1 }, { type: 'king', color: 'white' });
  checkmateBoard.setPiece({ file: 'g', rank: 8 }, { type: 'rook', color: 'black' });
  checkmateBoard.setPiece({ file: 'a', rank: 7 }, { type: 'rook', color: 'black' });
  checkmateBoard.setPiece({ file: 'c', rank: 4 }, { type: 'pawn', color: 'white' });
  checkmateBoard.setPiece({ file: 'b', rank: 6 }, { type: 'king', color: 'black' });

  // Step 4: Forced capture
  const forcedCaptureBoard = new Board();
  const blackRookH8 = forcedCaptureBoard.getPieceByLocation({ file: 'h', rank: 8 });
  if (blackRookH8) {
    forcedCaptureBoard.movePiece(blackRookH8, { file: 'h', rank: 6 });
  }

  // Step 5: Avoiding check
  const avoidCheckBoard = createEmptyBoard();
  avoidCheckBoard.setPiece({ file: 'h', rank: 1 }, { type: 'rook', color: 'white' });
  avoidCheckBoard.setPiece({ file: 'h', rank: 8 }, { type: 'king', color: 'black' });
  avoidCheckBoard.setPiece({ file: 'a', rank: 1 }, { type: 'king', color: 'white' });
  avoidCheckBoard.setPiece({ file: 'c', rank: 7 }, { type: 'rook', color: 'black' });

  // Step 6: Good strategy
  const goodStrategyBoard = createEmptyBoard();
  goodStrategyBoard.setPiece({ file: 'c', rank: 2 }, { type: 'queen', color: 'white' });
  goodStrategyBoard.setPiece({ file: 'g', rank: 2 }, { type: 'pawn', color: 'white' });
  goodStrategyBoard.setPiece({ file: 'h', rank: 2 }, { type: 'pawn', color: 'white' });
  goodStrategyBoard.setPiece({ file: 'g', rank: 1 }, { type: 'king', color: 'white' });
  goodStrategyBoard.setPiece({ file: 'd', rank: 8 }, { type: 'rook', color: 'black' });
  goodStrategyBoard.setPiece({ file: 'e', rank: 8 }, { type: 'bishop', color: 'black' });
  goodStrategyBoard.setPiece({ file: 'g', rank: 7 }, { type: 'pawn', color: 'black' });
  goodStrategyBoard.setPiece({ file: 'a', rank: 8 }, { type: 'king', color: 'black' });

  // Step 7: Lone island rule
  const loneIslandBoard = createEmptyBoard();
  loneIslandBoard.setPiece({ file: 'd', rank: 5 }, { type: 'pawn', color: 'black' });
  loneIslandBoard.setPiece({ file: 'd', rank: 3 }, { type: 'pawn', color: 'white' });
  loneIslandBoard.setPiece({ file: 'a', rank: 8 }, { type: 'king', color: 'black' });
  loneIslandBoard.setPiece({ file: 'a', rank: 1 }, { type: 'king', color: 'white' });

  // Step 8: Promotion
  const promotionBoard = createEmptyBoard();
  promotionBoard.setPiece({ file: 'd', rank: 2 }, { type: 'pawn', color: 'black' });

  // Step 9: Stalemate
  const stalemateBoard = createEmptyBoard();
  stalemateBoard.setPiece({ file: 'b', rank: 3 }, { type: 'king', color: 'black' });
  stalemateBoard.setPiece({ file: 'a', rank: 1 }, { type: 'king', color: 'white' });
  stalemateBoard.setPiece({ file: 'c', rank: 3 }, { type: 'pawn', color: 'black' });
  stalemateBoard.setPiece({ file: 'g', rank: 3 }, { type: 'pawn', color: 'white' });
  stalemateBoard.setPiece({ file: 'g', rank: 4 }, { type: 'pawn', color: 'black' });

  // Step 10: Final - free play
  const finalBoard = new Board();

  return [
    {
      title: '리버스 체스에 오신 것을 환영합니다!',
      description:
        '리버스 체스는 기본 체스와 많은 규칙이 정반대입니다. 가장 먼저, 선공은 흑입니다!',
      board: introBoard,
    },
    {
      title: '말을 다 잃으면 승리!',
      description: '킹을 제외한 모든 말을 다 잃으면 승리합니다. 백의 폰을 잡아보세요.',
      board: losePiecesBoard,
      expected: {
        check: (board: Board) => {
          const pieces = board.getAllPieces();
          if (pieces.length !== 3) return false;

          const whiteKings = pieces.filter((p) => p.color === 'white' && p.type === 'king');
          const blackKings = pieces.filter((p) => p.color === 'black' && p.type === 'king');
          const blackPawns = pieces.filter((p) => p.color === 'black' && p.type === 'pawn');

          return whiteKings.length === 1 && blackKings.length === 1 && blackPawns.length === 1;
        },
        message: '백 킹만 남아서 백의 승리!',
      },
    },
    {
      title: '체크메이트를 당하면 승리!',
      description:
        '기본 체스에서는 체크메이트를 당하면 패배합니다. 하지만 리버스 체스에서는 체크메이트를 당하면 승리합니다. 한 수만 움직여서 체크메이트를 만들어보세요.',
      board: checkmateBoard,
      expected: {
        check: (board: Board) => {
          const rookG8 = board.getPieceByLocation({ file: 'g', rank: 8 });
          const rookH7 = board.getPieceByLocation({ file: 'h', rank: 7 });
          const allPieces = board.getAllPieces();
          const blackRooks = allPieces.filter((p) => p.color === 'black' && p.type === 'rook');

          return (
            !!rookG8 &&
            rookG8.color === 'black' &&
            rookG8.type === 'rook' &&
            !!rookH7 &&
            rookH7.color === 'black' &&
            rookH7.type === 'rook' &&
            blackRooks.length === 2
          );
        },
        message: '백이 체크메이트를 당해서 백의 승리!',
      },
    },
    {
      title: '강제 캡쳐',
      description:
        '잡을 수 있는 말이 있다면 반드시 그 중 하나를 잡아야 합니다. 지금 흑 룩만 움직일 수 있습니다.',
      board: forcedCaptureBoard,
      expected: {
        check: (board: Board) => {
          const piece = board.getPieceByLocation({ file: 'h', rank: 2 });
          return !!piece && piece.color === 'black' && piece.type === 'rook';
        },
        message: '다른 수가 없었습니다…',
      },
    },
    {
      title: '체크 피하기',
      description:
        '체크 상태가 되면 반드시 체크를 피해야 합니다. 또한 일부러 체크 상태가 되도록 두는 것을 허용하지 않습니다. (강제 캡처보다 체크 피하기가 우선입니다)',
      board: avoidCheckBoard,
      expected: {
        check: (board: Board) => {
          const kingG8 = board.getPieceByLocation({ file: 'g', rank: 8 });
          const kingG7 = board.getPieceByLocation({ file: 'g', rank: 7 });
          const rookH7 = board.getPieceByLocation({ file: 'h', rank: 7 });

          const isKingG8 = !!kingG8 && kingG8.color === 'black' && kingG8.type === 'king';
          const isKingG7 = !!kingG7 && kingG7.color === 'black' && kingG7.type === 'king';
          const isRookH7 = !!rookH7 && rookH7.color === 'black' && rookH7.type === 'rook';

          return isKingG8 || isKingG7 || isRookH7;
        },
        message: '잘 피했습니다!',
      },
    },
    {
      title: '좋은 전략!',
      description:
        '강제 캡처 규칙과 체크 피하기 규칙을 활용해 백이 흑의 모든 말을 잡을 수밖에 없도록 유도해보세요.',
      board: goodStrategyBoard,
      expected: {
        check: (board: Board) => {
          const pieces = board.getAllPieces();
          const blackPieces = pieces.filter((p) => p.color === 'black');
          if (blackPieces.length === 0) return false;

          const nonKingBlack = blackPieces.filter((p) => p.type !== 'king');
          return nonKingBlack.length === 0;
        },
        message: '흑 킹만 남아서 흑의 승리!',
      },
    },
    {
      title: '추가 규칙 : 외딴섬',
      description: '내가 움직일 수 있는 말이 킹만 남아도 승리합니다. 흑 폰을 앞으로 이동해보세요.',
      board: loneIslandBoard,
      expected: {
        check: (board: Board) => {
          const blackPawnD4 = board.getPieceByLocation({ file: 'd', rank: 4 });
          const whitePawnD3 = board.getPieceByLocation({ file: 'd', rank: 3 });

          return (
            !!blackPawnD4 &&
            blackPawnD4.color === 'black' &&
            blackPawnD4.type === 'pawn' &&
            !!whitePawnD3 &&
            whitePawnD3.color === 'white' &&
            whitePawnD3.type === 'pawn'
          );
        },
        message: '외딴섬 규칙으로 백의 승리!',
      },
    },
    {
      title: '추가 규칙 : 프로모션',
      description:
        '기본 체스와 동일하게 프로모션 규칙이 적용됩니다.  흑 폰을 앞으로 움직여 퀸으로 바꿔보세요. ( 앙파상과 캐슬링은 없습니다. )',
      board: promotionBoard,
      expected: {
        check: (board: Board) => {
          const piece = board.getPieceByLocation({ file: 'd', rank: 1 });
          return !!piece && piece.color === 'black' && piece.type === 'queen';
        },
        message: '새 여왕입니다!',
      },
    },
    {
      title: '추가 규칙 : 스테일메이트',
      description:
        '기본 체스와 동일하게 스테일메이트(체크는 아닌데 둘 수 있는 수가 없는 상태)는 무승부입니다. 흑 폰을 앞으로 움직여서 스테일메이트를 만들어보세요.',
      board: stalemateBoard,
      expected: {
        check: (board: Board) => {
          const blackKingB3 = board.getPieceByLocation({ file: 'b', rank: 3 });
          const whiteKingA1 = board.getPieceByLocation({ file: 'a', rank: 1 });
          const pawnC2 = board.getPieceByLocation({ file: 'c', rank: 2 });
          const whitePawnG3 = board.getPieceByLocation({ file: 'g', rank: 3 });
          const blackPawnG4 = board.getPieceByLocation({ file: 'g', rank: 4 });

          return (
            !!blackKingB3 &&
            blackKingB3.color === 'black' &&
            blackKingB3.type === 'king' &&
            !!whiteKingA1 &&
            whiteKingA1.color === 'white' &&
            whiteKingA1.type === 'king' &&
            !!pawnC2 &&
            pawnC2.color === 'black' &&
            pawnC2.type === 'pawn' &&
            !!whitePawnG3 &&
            whitePawnG3.color === 'white' &&
            whitePawnG3.type === 'pawn' &&
            !!blackPawnG4 &&
            blackPawnG4.color === 'black' &&
            blackPawnG4.type === 'pawn'
          );
        },
        message: '백의 스테일메이트로 무승부',
      },
    },
    {
      title: '이제 게임을 하러 가세요!',
      description: '이것으로 리버스 체스의 모든 규칙을 살펴봤습니다. 이제 본 게임을 시작해보세요!',
      board: finalBoard,
      expected: {
        check: (board: Board) => {
          const pieces = board.getAllPieces();
          return pieces.length <= 26;
        },
        message: '이건 진짜 게임이 아닙니다. 완료 버튼을 누르세요.',
      },
    },
  ];
};
