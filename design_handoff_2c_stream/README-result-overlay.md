# 결과 오버레이 (확정안 8b) — 정답 / 오답 / 게임 오버

레퍼런스: `Result Overlay Final.dc.html` (브라우저에서 열면 ① 출제 화면 → ② 정답 → ③ 오답 → ④ 게임 오버 순으로 나란히, 3초 루프로 재생)
게임방 화면 스펙은 `README.md`(2c), 색·타이포 토큰은 그 문서를 따른다. 이전 탐색안 문서 `README-result-screens.md`는 **폐기**하고 이 문서를 따른다.

## 확정 규칙

- 오버레이는 **출제(플레이) 화면 위에 얹히는 레이어**다. 화면 전환이 아니다. 상단 내비·제시어·참가자 그리드·하단 툴바/입력창은 계속 보인다.
- 노출 시간은 **정확히 2.0초** = `fade in 0.2s` + `hold 1.5s` + `fade out 0.3s`. 이 안에 모든 모션이 끝난다.
- 2초가 지나면 오버레이는 완전히 사라지고 출제 화면이 그대로 남는다. 별도 CTA 버튼 없음(탭으로 조기 닫기는 허용).
- **오답에 기회 카운트 룰은 없다.** "남은 기회 N번" 같은 문구를 절대 넣지 않는다. 오답은 알림만 하고 라운드는 계속된다.
- **점수는 앱이 계산한 값을 그대로 표시**한다. UI는 `+{score} POINT` 포맷으로만 렌더하며 계산 로직을 갖지 않는다.

## 데이터 계약

```ts
type ResultOverlay =
  | { kind: 'correct'; winnerName: string; answer: string; score: number; solveSeconds: number }
  | { kind: 'wrong';   guesserName: string; guess: string }
  | { kind: 'gameover'; answer: string };
```

- `correct` → 제목 `정답입니다!`, 점수 칩 `+{score} POINT`, 메타 칩 `{winnerName} · {solveSeconds}초`
- `wrong` → 제목 `오답입니다!`, 점수 칩 없음, 메타 칩 `{guesserName} · {guess}`
- `gameover` → 제목 `GAME OVER`, 메타 칩 `아무도 못 맞혔어요`, 정답 슬래브 `정답은 {answer}!`

`score`는 서버/클라이언트에서 계산해 넘긴다(예: 남은 시간 가중, 순위 보너스 등 — UI는 관여하지 않는다). 0이면 칩을 숨기지 말고 `+0 POINT`로 표시할지 결정은 프로덕트 판단이나, 기본은 `score > 0`일 때만 칩을 렌더.

## 레이아웃 (오버레이 내부)

캔버스 영역(`position: relative`) 안에 쌓는 3개 레이어:

1. **스크림** — `position: absolute; inset: 0`, `fade` 애니메이션
   - correct `rgba(6,37,26,.34)` / wrong `rgba(42,13,22,.30)` / gameover `rgba(26,16,48,.50)`
   - 얕게 유지 — 뒤의 스케치가 계속 읽혀야 한다.
2. **컨페티 폭죽** — 원점 `left: 50%; top: 42%`, 조각을 그 지점에 절대 배치하고 12방향 방사로 이동
   - correct: **사각 블록** — 반경 118px, 12개, 8px(1/3은 12px), 색 `#ff2e6a #ffd21f #2ce39f #6fd3f0 #c4a3f5 #ff8ac0`, 각 조각 `box-shadow: 0 0 0 2px #0f0a19`
   - wrong: **픽셀 X** — 반경 112px, 10개, 색 `#ff2e6a` / `#ff8ac0`
   - gameover: **픽셀 X** — 반경 116px, 12개, 색 `#c4a3f5` / `#c0b4d8`
   - 픽셀 X는 투명 래퍼 안에 30% 폭 바 2개를 `rotate(±45deg)`로 겹쳐 만든다(글리프·SVG 아님).
   - 조각 간 `animation-delay: (i % 4) * 0.05s` — 버스트가 한 덩어리로 터지되 미세하게 흩어진다.
3. **중앙 스택** — `left: 0; right: 0; top: 30%`, flex column, `align-items: center; gap: 11px`, `pop` 애니메이션
   - 결과 슬래브: `padding: 11px 18px`, Galmuri14 **21px**, 배경 = 대표색, `box-shadow: 0 0 0 4px #0f0a19, 0 6px 0 4px <대표색 어두운 톤>`
   - 점수 칩(correct만): `padding: 6px 12px`, 배경 `#ffd21f`, Galmuri14 16px `#14101c`, `box-shadow: 0 0 0 3px #0f0a19`
   - 메타 칩: `padding: 5px 10px`, Galmuri11 12px, `box-shadow: 0 0 0 3px #0f0a19`
     - correct 배경 `#0b6b4c` 텍스트 `#eafff6` / wrong 배경 `#4c1020` 텍스트 `#ffc4d5` / gameover 배경 `#2f2440` 텍스트 `#e8dff5`
   - 정답 슬래브(gameover만): `padding: 8px 14px`, 배경 `#ffd21f`, Galmuri14 16px `#14101c`, 굽 `0 5px 0 4px #7a4a24`
   - 캐릭터 40px: correct `hop .9s ease-in-out infinite` / wrong·gameover `shiver .24~.28s steps(2) infinite`
   - 모든 코너 `border-radius: 0`.

부수 상태 변화(오버레이와 함께):
- correct — 제시어 공개 + `#2ce39f`, 채팅 스트림에 정답 말풍선(초록 `#14c98a`, 텍스트 `#08251a`) 추가, 참가자 그리드에서 정답자 테두리 `#14c98a`·점 `#2ce39f`, 입력창 테두리·문구 `정답! 다음 라운드 준비중`
- wrong — 제시어 `□ □ □ □` 유지, 타이머 계속 감소, 입력창 테두리 `#ff2e6a` + `다시 입력하세요`
- gameover — 타이머 `0` `#ff2020`, 입력창 비활성(`#3a2d52` / `#9d90bb`, `라운드 종료`)

## 애니메이션 (실제 구현용 — 2.0s 단발)

레퍼런스 파일은 확인 편의를 위해 3초 루프(`cycle*` 키프레임)로 돌린다. 실제 앱에서는 아래 단발 키프레임을 쓰고 2.0s 후 DOM에서 제거한다.

```css
@keyframes overlayFade {
  0%   { opacity: 0 }
  10%  { opacity: 1 }   /* 0.2s */
  85%  { opacity: 1 }   /* 1.7s */
  100% { opacity: 0 }   /* 2.0s */
}
@keyframes overlayPop {
  0%   { opacity: 0; transform: scale(.7) }
  10%  { opacity: 1; transform: scale(1.06) }
  19%  { transform: scale(1) }
  85%  { opacity: 1; transform: scale(1) }
  100% { opacity: 0; transform: scale(.94) }
}
@keyframes confettiBurst {
  0%   { opacity: 0; transform: translate(0,0) scale(.6) }
  12%  { opacity: 1 }
  75%  { opacity: 1 }
  100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1) }
}
```

적용: 스크림 `overlayFade 2s linear forwards` / 중앙 스택 `overlayPop 2s steps(7) forwards` / 조각 `confettiBurst 2s steps(9) forwards`.
캐릭터 hop·shiver는 무한 루프로 두고 오버레이 제거 시 함께 사라진다(2초 안에 2~8회 반복 → 살아있는 느낌).
`steps()` 유지 — 부드러운 cubic-bezier는 픽셀 룩을 깨뜨린다.

구현 체크:
- 등장 모션은 상태당 **한 동작만**(pop). 2초 예산에 회전·글리치·순차 등장을 더하면 읽히기 전에 사라진다.
- 오버레이는 드로잉 입력을 막아야 한다: 레이어에 `pointer-events: auto`, 단 탭 시 즉시 닫히게(조기 종료).
- 연속 정답이 빠르게 들어오면 큐에 쌓지 말고 **최신 결과로 교체**(replace)해 2초 타이머를 리셋한다.
- `prefers-reduced-motion: reduce` → 컨페티 제거, 스크림·중앙 스택은 opacity 페이드만(2초 유지).

## 토큰 (README.md 토큰에 추가)

- correct: 대표 `#2ce39f`, 어두운 굽 `#0b6b4c`, 온-초록 `#06251a` / `#08251a`, 정답 말풍선 `#14c98a`
- wrong: 대표 `#ff2e6a`, 굽 `#7a0a26`, 온-핑크 `#2b0410`, 칩 `#4c1020`, 텍스트 `#ffc4d5`
- gameover: 대표 `#ff2020`, 굽 `#5a0a14`, 칩 `#2f2440`, 텍스트 `#e8dff5`
- 점수·정답 노랑: `#ffd21f`, 굽 `#7a4a24`, 온-노랑 `#14101c`
- 컨페티 팔레트: `#ff2e6a #ffd21f #2ce39f #6fd3f0 #c4a3f5 #ff8ac0`
- 픽셀 테두리 잉크: `#0f0a19`
