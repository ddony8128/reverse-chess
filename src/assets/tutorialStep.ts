import type { Board } from "@/engine/board";
import { createEmptyBoard } from "@/engine/boardUtils";



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
    // Step 1: Introduction
    const introBoard = createEmptyBoard();
    introBoard.setPiece({ file: 'e', rank: 5 }, { type: 'king', color: 'white' });
    introBoard.setPiece({ file: 'd', rank: 4 }, { type: 'pawn', color: 'black' });

    // Step 2: Pawn movement
    const pawnBoard = createEmptyBoard();
    pawnBoard.setPiece({ file: 'e', rank: 7 }, { type: 'pawn', color: 'white' });
    pawnBoard.setPiece({ file: 'd', rank: 2 }, { type: 'pawn', color: 'black' });

    // Step 3: Capture
    const captureBoard = createEmptyBoard();
    captureBoard.setPiece({ file: 'e', rank: 4 }, { type: 'pawn', color: 'white' });
    captureBoard.setPiece({ file: 'd', rank: 3 }, { type: 'pawn', color: 'black' });

    // Step 4: Knight
    const knightBoard = createEmptyBoard();
    knightBoard.setPiece({ file: 'e', rank: 4 }, { type: 'knight', color: 'white' });

    // Step 5: Bishop
    const bishopBoard = createEmptyBoard();
    bishopBoard.setPiece({ file: 'e', rank: 4 }, { type: 'bishop', color: 'white' });

    // Step 6: Rook
    const rookBoard = createEmptyBoard();
    rookBoard.setPiece({ file: 'e', rank: 4 }, { type: 'rook', color: 'white' });

    // Step 7: Queen
    const queenBoard = createEmptyBoard();
    queenBoard.setPiece({ file: 'e', rank: 4 }, { type: 'queen', color: 'white' });

    // Step 8: King
    const kingBoard = createEmptyBoard();
    kingBoard.setPiece({ file: 'e', rank: 4 }, { type: 'king', color: 'white' });

    // Step 9: Reverse Chess Rule
    const reverseBoard = createEmptyBoard();
    reverseBoard.setPiece({ file: 'e', rank: 7 }, { type: 'king', color: 'white' });
    reverseBoard.setPiece({ file: 'e', rank: 1 }, { type: 'king', color: 'black' });
    reverseBoard.setPiece({ file: 'e', rank: 4 }, { type: 'pawn', color: 'white' });

    return [
        {
            title: '리버스 체스에 오신 것을 환영합니다!',
            description: '리버스 체스는 일반 체스와 반대로, 자신의 모든 말을 잃거나 움직일 수 없게 되면 승리합니다. 먼저 체스 말의 기본 움직임을 배워봅시다.',
            board: introBoard,
            expected: {
                check: (board: Board) => {
                    return board.getAllPieces().length === 1
                },
                message: '축하합니다.',
            },
        },
        {
            title: '폰 (Pawn) ♙',
            description: '폰은 앞으로 한 칸 이동합니다. 시작 위치에서는 두 칸도 가능합니다. 폰을 클릭해서 이동 가능한 위치를 확인해보세요.',
            board: pawnBoard,
        },
        {
            title: '폰의 공격',
            description: '폰은 대각선 앞으로만 적을 잡을 수 있습니다. 흰색 폰을 클릭하고 검은색 폰을 잡아보세요.',
            board: captureBoard,
        },
        {
            title: '나이트 (Knight) ♘',
            description: '나이트는 L자 모양으로 이동합니다 (2칸+1칸). 다른 말을 뛰어넘을 수 있는 유일한 말입니다. 클릭해서 이동 범위를 확인해보세요.',
            board: knightBoard,
        },
        {
            title: '비숍 (Bishop) ♗',
            description: '비숍은 대각선으로 원하는 만큼 이동합니다. 같은 색 칸만 이동할 수 있습니다.',
            board: bishopBoard,
        },
        {
            title: '룩 (Rook) ♖',
            description: '룩은 가로 또는 세로로 원하는 만큼 이동합니다.',
            board: rookBoard,
        },
        {
            title: '퀸 (Queen) ♕',
            description: '퀸은 가장 강력한 말로, 대각선과 직선 모두 원하는 만큼 이동할 수 있습니다.',
            board: queenBoard,
        },
        {
            title: '킹 (King) ♔',
            description: '킹은 모든 방향으로 한 칸씩만 이동합니다. 킹은 잡히면 안 되는 특별한 말입니다.',
            board: kingBoard,
        },
        {
            title: '리버스 체스 규칙',
            description: '리버스 체스에서는 킹을 제외한 모든 말을 잃으면 승리합니다! 체크메이트나 스테일메이트를 당해도 승리입니다. 흑이 선공이며, 전략적으로 말을 희생시키세요!',
            board: reverseBoard,
        },
    ];
};