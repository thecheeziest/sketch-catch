// 결과 오버레이(정답/오답/게임오버) 데이터 계약 — README-result-overlay.md 확정안 8b
export type GameResultOverlayData =
  | {
      kind: 'correct';
      /** 리렌더 시 애니메이션·타이머를 재시작시키는 인스턴스 식별자 */
      id: string;
      winnerName: string;
      answer: string;
      score: number;
      solveSeconds: number;
      characterId: string;
    }
  | {
      kind: 'wrong';
      id: string;
      guesserName: string;
      guess: string;
      characterId: string;
    }
  | {
      kind: 'gameover';
      id: string;
      answer: string;
      characterId: string;
    };
