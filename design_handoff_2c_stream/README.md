# Handoff: 스케치 퀴즈 — 2c "스트림" 게임방 화면 (12인 만석)

## Overview
그림 퀴즈(스케치 퀴즈) 게임방의 플레이 화면. 한 명(출제자)이 제시어를 그리고, 나머지 유저가 채팅으로 정답을 추측한다.
핵심 과제는 **최대 12명의 채팅을 좁은 모바일 화면에서 겹치지 않게, 귀엽게** 보여주는 것.

2c안의 해법:
- 참가자 전원은 상단 **6열 × 2행 아바타 그리드**로 압축 (테두리/점 색으로 역할·상태 표시).
- 추측 채팅은 캐릭터마다 말풍선을 띄우지 않고, **캔버스 우측 상단에서 위로 밀려 올라가는 단일 스트림**(최대 5개 고정).
  → 인원이 3명이든 12명이든 말풍선 개수가 고정이므로 레이아웃이 절대 무너지지 않는다.
- 오래된 말풍선은 **불투명 배경 밝기 단계**로 흐릿함을 표현한다(투명도 사용 금지 — 흰 캔버스 위에서 글자가 사라짐).

## About the Design Files
이 폴더의 HTML 파일은 **디자인 레퍼런스(프로토타입)**다. 의도한 룩앤필과 동작을 보여주기 위한 것이며, 그대로 프로덕션에 붙여 쓰는 코드가 아니다.
작업은 이 디자인을 **타깃 코드베이스의 기존 환경(React / Vue / SwiftUI / Flutter 등)과 기존 패턴·라이브러리로 재현**하는 것이다. 아직 환경이 없다면 프로젝트에 가장 적합한 프레임워크를 골라 구현한다.
실제 게임 로직(소켓 통신, 채점, 라운드 진행)은 이 프로토타입에 없다 — UI/UX 스펙만 담겨 있다. 프로토타입의 1.6초 타이머는 데모용 더미 데이터 재생기이며 실제 구현에서는 서버 이벤트로 대체한다.

## Fidelity
**High-fidelity (hifi).** 색상·타이포·간격·상태 색이 모두 확정값이다. 아래 스펙의 hex와 px를 그대로 사용해 픽셀 단위로 재현할 것. (단, 아바타 캐릭터 스프라이트는 CSS 블록으로 흉내낸 **플레이스홀더**다 — 실제 픽셀 아트 에셋으로 교체 필요. 아래 Assets 참고.)

## Screens / Views

### Screen: 게임방 플레이 화면 (출제자 시점 / 관전·추측자 시점 공용 레이아웃)
- **Purpose**: 출제자는 그리고, 나머지는 추측을 입력한다. 모든 유저가 누가 참여 중인지, 누가 정답을 맞혔는지, 최근 추측이 무엇인지 한눈에 본다.
- **Frame**: 360 × 780 (모바일 세로, 1x). 세로 flex column, `overflow: hidden`. 바깥 프레임 테두리 `box-shadow: 0 0 0 4px #2f2440` (목업용 베젤 — 실제 앱에서는 생략).
- **수직 구성 순서 / 높이**
  1. 상단 내비게이션 — 배경 `#241b34`, padding `13px 16px`, 높이 약 50px
  2. 제시어 + 타이머 행 — 배경 `#241b34`, padding `8px 16px`
  3. 상태 범례 행 — 배경 `#241b34`, padding `0 16px 6px`
  4. 참가자 아바타 그리드 — 배경 `#241b34`, padding `0 12px 12px`, 2행 약 116px
  5. 드로잉 캔버스 — 배경 `#ffffff`, `flex: 1` (실측 약 360px, 화면의 약 46%), `position: relative; overflow: hidden`
  6. 드로잉 툴바 — 배경 `#171122`, 높이 약 132px (고정)

#### 1. 상단 내비게이션
- 뒤로가기 `‹` (U+2039 스타일 픽셀 셰브론), Galmuri14 18px, `#f4ecff`
- 라운드 라벨 `ROUND 2 (2/10)` — Galmuri14 15px, `letter-spacing: 1px`, `#f4ecff`
- 우측 인원 카운터 `12/12` — Galmuri11 12px, `#b9aed2`
- 요소 간 `gap: 14px`, 인원 카운터는 `margin-left: auto`

#### 2. 제시어 + 타이머
- 제시어 `장갑` — Galmuri14 **25px**, `#ff2e6a` (출제자에게만 노출; 추측자 화면에서는 `_ _` 형태의 글자 수 힌트로 대체할 것)
- 타이머 `20` — Galmuri14 **23px**, `#f4ecff`
- `display: flex; align-items: baseline; justify-content: space-between`

#### 3. 상태 범례 (legend)
- `display: flex; gap: 12px`
- 각 항목: 8×8px 색 사각형 + Galmuri11 11px `#b9aed2` 라벨, `gap: 5px`
- 항목: `#ff8ac0` 출제자 / `#2ce39f` 정답 / `#c0b4d8` 추측중

#### 4. 참가자 아바타 그리드 (최대 12명)
- `display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px`
- 셀: 배경 `#1d1629`, `padding: 4px 0`, flex column, `align-items: center`, `gap: 2px`
- 셀 테두리 `box-shadow: 0 0 0 2px <ring>`
  - 출제자: `#ff2e6a` (**핑크 테두리는 출제자 전용**)
  - 정답자: `#14c98a`
  - 그 외: `#4a3a5c`
- 아바타: 40×40 스프라이트를 `transform: scale(.75)`로 30×30 표시 (`overflow: hidden` 래퍼)
- 닉네임: Galmuri11 **11px**, `#cbbfe2` (11px 미만 금지 — 한글 픽셀 폰트 가독성 한계)
- 상태 점: 8×8px — 출제자 `#ff8ac0` / 정답 `#2ce39f` / 추측 발화 있음 `#c0b4d8` / 미발화 `#4a3a5c`
- 인원이 12명 미만이면 셀 수만 줄어들고 그리드 규칙은 동일 (3~6명이면 1행)

#### 5. 드로잉 캔버스 + 채팅 스트림
- 캔버스: 흰 배경, 스트로크 `#14101c`, `stroke-linecap: round`, 기본 굵기 14px
- 스트림 컨테이너: `position: absolute; right: 10px; top: 10px`, flex column, `align-items: flex-end`, `gap: 6px`
  - **최신 메시지가 아래**, 오래된 것이 위로 밀려 올라간다. 최대 5개 유지, 초과분은 제거.
- 말풍선(한 줄): `display: flex; align-items: center; gap: 7px; padding: 7px 10px`
  - 테두리 `box-shadow: 0 0 0 3px #0f0a19`, `border-radius: 0` (픽셀 룩 — 라운드 금지)
  - 스피커 색 칩 11×11px (해당 캐릭터 대표색) + `box-shadow: 0 0 0 2px #0f0a19`
  - 닉네임: Galmuri11 11px, `#f4ecff`
  - 추측 텍스트: Galmuri11 **13px**, `#e8dff5`
  - 점수 배지(정답만): Galmuri14 11px, `#08251a`, 텍스트 `+100`
  - 등장 애니메이션: `popIn .18s steps(3)` — `translateY(8px) scale(.9)` + opacity 0 → 원위치 (steps로 레트로 느낌)
- **나이(오래됨) 표현 = 불투명 배경 단계** (오래된 → 최신):
  `#6a5c86` → `#5b4e75` → `#4c4064` → `#3d3252` → `#2f2440`
  - ⚠️ `opacity` 페이드는 사용하지 말 것. 흰 캔버스 위에서 배경과 글자가 함께 흰색으로 수렴해 대비가 2:1 수준으로 붕괴한다(실측).
- 정답 말풍선: 배경 `#14c98a`, 텍스트/닉네임/배지 `#08251a`

#### 6. 드로잉 툴바 (`DrawToolbar.dc.html`)
- 컨테이너: 배경 `#171122`, `padding: 9px 12px 10px`, flex column, `gap: 8px`
- **색상 팔레트**: `grid-template-columns: repeat(8, 1fr); gap: 5px`, 스와치 높이 **34px**, 테두리 `box-shadow: 0 0 0 2px #0f0a19`, 선택된 스와치는 `0 0 0 3px #ff2e6a`
  - 순서(계열별 묶음, 연한 색 → 진한 색):
    1행 `#ff7a6e` 연빨 · `#d61f24` 진빨 · `#ffc79c` 살구 · `#ff8a1f` 주황 · `#7a4a24` 갈색 · `#ffd21f` 노랑 · `#a8e05a` 연두 · `#17a86b` 초록
    2행 `#6fd3f0` 하늘 · `#1f5bd6` 파랑 · `#c4a3f5` 연보라 · `#7a2ee0` 보라 · `#ff8ac0` 핑크 · `#ffffff` 하양 · `#9a9aa6` 회색 · `#14101c` 검정
- **도구 행 (한 줄)**: `display: flex; gap: 6px`
  - 브러시 크기 그룹: 배경 `#241b34`, `padding: 3px`, 버튼 3개 **44×44** (`gap: 2px`), 각 버튼 안에 흰 사각 점 6 / 12 / 19px, 미선택 배경 `#1d1629`, 선택 배경 `#2f2440` + `inset 0 0 0 3px #ff2e6a`
  - 지우개: `flex: 1`, 높이 46, 배경 `#241b34`, `inset 0 0 0 3px #3a2d52`, 아이콘(18×9 흰 블록 + `0 3px 0 #ff9ec7`) + 라벨 `지우개` 11px `#f4ecff`
  - 이전으로: `flex: 1`, 높이 46, 배경 `#2f2440`, `inset 0 0 0 3px #4a3a5c`, 좌향 화살표 픽셀 아이콘 + 라벨 `이전으로`
  - 전부지우기: `flex: 1`, 높이 46, 배경 `#3a1226`, `inset 0 0 0 3px #ff2e6a`, X 아이콘(`#ff86a8`) + 라벨 `전부지우기` `#ffc4d5`
  - 모든 터치 타깃 ≥ 44px 유지

## Interactions & Behavior
- **추측 입력**: 추측자는 하단 입력창(이 화면에는 미포함 — 실제 앱의 채팅 입력 UI 사용)으로 제출. 제출 즉시 스트림 하단에 말풍선 추가, 기존 말풍선이 위로 이동, 6번째부터 가장 위 항목 제거.
- **오답**: 회색-보라 계열 말풍선으로 스트림에만 남는다(별도 오답 표시 없음 — 정답만 강조).
- **정답**: 해당 말풍선이 초록(`#14c98a`) + `+100` 배지, 동시에 상단 그리드에서 그 유저의 테두리가 `#14c98a`, 상태 점이 `#2ce39f`로 변경(라운드 종료까지 유지).
- **출제자**: 추측할 수 없다. 상단 그리드에서 핑크 테두리 + 핑크 점으로 상시 구분.
- **입장/퇴장**: 그리드 셀 추가/제거만 하면 되고 스트림 레이아웃은 영향 없음.
- **애니메이션**: 말풍선 등장 `popIn .18s steps(3)`. 위로 밀려 올라가는 이동은 같은 계단식 타이밍(`steps`)으로 처리해 픽셀 게임 느낌 유지. 이징에 부드러운 cubic-bezier 사용 지양.
- **드로잉**: 브러시 크기 3단(작음/보통/큼 = 스트로크 6/14/22px 권장), 지우개, 이전으로(undo 스택), 전부지우기(확인 모달 권장).
- **반응형**: 프레임 폭은 기기 폭에 맞춰 늘어남. 팔레트는 8열 고정(폭에 따라 스와치 폭만 신축), 아바타 그리드는 6열 고정, 스트림 말풍선은 `max-width: 70%`로 제한하고 긴 텍스트는 말줄임.

## State Management
- `room.players: { id, nickname, spriteColor, snoutColor, isDrawer, hasSolved, lastGuessAt }[]` (최대 12)
- `room.word`, `room.round`, `room.totalRounds`, `room.timer`(초, 1초 감소)
- `chat.stream: { id, playerId, text, isCorrect, receivedAt }[]` — 최근 5개만 렌더 (전체 로그는 별도 보관 가능)
- `draw.tool: 'brush' | 'eraser'`, `draw.size: 0|1|2`, `draw.color: string`, `draw.strokes[]`, `draw.undoStack[]`
- 전이 트리거: 서버 이벤트(guess, correct, join, leave, roundStart, roundEnd, stroke)로 위 상태 갱신. 프로토타입의 `setInterval`은 제거 대상.

## Design Tokens
- **배경**: 딥 배경 `#0c0813` / 프레임 `#171122` / 헤더·패널 `#241b34` / 서브 패널 `#1d1629` / 베젤·구분 `#2f2440`
- **말풍선**: 기본 `#2f2440`, 나이 단계 `#3d3252` `#4c4064` `#5b4e75` `#6a5c86`, 정답 `#14c98a`, 테두리 `#0f0a19`
- **텍스트**: 주 `#f4ecff` / 보조 `#cbbfe2` / 뮤트 `#b9aed2` / 말풍선 본문 `#e8dff5` / 어두운 온-초록 `#08251a`
- **강조**: 핑크(출제자·선택) `#ff2e6a`, 밝은 핑크 `#ff8ac0`, 정답 초록 `#14c98a` / 밝은 초록 `#2ce39f`
- **중립 테두리**: `#4a3a5c`
- **잉크(캔버스 스트로크)**: `#14101c`
- **타이포**: Galmuri14 (헤딩/숫자), Galmuri11 (본문/라벨) — https://galmuri.quiple.dev , woff2: `https://cdn.jsdelivr.net/npm/galmuri@latest/dist/Galmuri11.woff2`
  - 스케일: 25px 제시어 / 23px 타이머 / 18px 내비 아이콘 / 15px 라운드 / 13px 추측 텍스트 / 12px 인원·닉네임 / 11px 라벨·배지 (**11px 하한**)
- **간격**: 2 / 5 / 6 / 8 / 12 / 16px
- **모서리**: 전부 `0` (픽셀 룩). 그림자 대신 `box-shadow: 0 0 0 Npx <color>`를 픽셀 테두리로 사용.
- **터치 타깃**: 최소 44px

## Assets
- **캐릭터 스프라이트**: 현재 `PixelPet.dc.html`은 CSS 블록으로 만든 **임시 대체물**(귀 2 + 얼굴 + 눈 2 + 코 구성, 40×40 그리드). 실제 구현 시 40×40(또는 2x/3x) 픽셀 아트 PNG/스프라이트시트로 교체하고 `image-rendering: pixelated` 적용. 캐릭터별 대표색은 말풍선 색 칩과 동일해야 한다.
  - 12종 대표색/코색: 조아 `#f2a0bc`/`#d97d9d`, 브리 `#a9734a`/`#8a5a37`, 토리 `#8ad7f5`/`#5fb4d6`, 모카 `#c9a27e`/`#a67f5c`, 달이 `#f5e07a`/`#d6bd4f`, 코코 `#b189f0`/`#8f65d1`, 하늘 `#7fe0b0`/`#4fbb8b`, 방울 `#ff9f6e`/`#e07a4a`, 루비 `#ff6b8f`/`#e0476c`, 구름 `#d8d3e8`/`#b0aac4`, 별이 `#9fb4ff`/`#7089e0`, 쿠키 `#e8c58a`/`#c8a065`
- **아이콘**: 모두 CSS 블록으로 그린 픽셀 아이콘(지우개/undo/X). 프로덕션에서는 동일 실루엣의 픽셀 아이콘 에셋 권장.
- **폰트**: Galmuri (SIL Open Font License) — npm `galmuri` 또는 위 CDN.

## Files
- `Screen 2c.dc.html` — 이 화면 단독 레퍼런스 (브라우저에서 바로 열림, 더미 채팅 자동 재생)
- `README-result-overlay.md` + `Result Overlay Final.dc.html` — **확정** 결과 오버레이(정답 / 오답 / 게임 오버, 2.0초 노출) 스펙과 레퍼런스
- `README-result-screens.md` + `Result Screens.dc.html` — 폐기된 초기 탐색안. 참고만 하고 구현하지 말 것
- `PixelPet.dc.html` — 캐릭터 스프라이트 플레이스홀더 (props: `color`, `snout`)
- `DrawToolbar.dc.html` — 드로잉 툴바 (팔레트 16색 + 도구 한 줄)
- `support.js` — 위 HTML 프로토타입을 브라우저에서 렌더하기 위한 런타임. **구현에는 사용하지 말 것** (레퍼런스 실행용)
