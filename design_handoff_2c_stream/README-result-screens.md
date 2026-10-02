# 결과 오버레이 3화면 — 정답 / 오답 / 게임 오버

레퍼런스 파일: `Result Screens.dc.html` (4a 정답, 4b 오답, 4c 게임 오버 — 브라우저에서 바로 열면 애니메이션 재생)
이 문서는 `README.md`(2c 게임방 화면)의 **연장**이다. 색상·타이포·픽셀 테두리 규칙은 모두 그 문서를 따르고, 여기서는 결과 상태에 추가되는 것만 정의한다.

## 공통 규칙 (3화면 통일 시스템)

세 화면은 **동일한 구조**를 쓰고 색/파티클만 바뀐다. 상단(내비 + 제시어 + 참가자 그리드)은 게임방 화면 그대로 유지되고, **캔버스 영역만 결과 스테이지로 전환**된다.

| | 정답 | 오답 | 게임 오버 |
|---|---|---|---|
| 스테이지 배경 | `#0b2a20` (불투명) | 흰 캔버스 유지 + `rgba(42,13,22,.55)` 스크림 | `#1a1030` (불투명) |
| 대표색 | `#2ce39f` | `#ff2e6a` | `#ff2020` + `#ffd21f` |
| 배경 그래픽 | 회전 방사 광선 + 라디얼 글로우 | 흐르는 대각 경고 스트라이프 | `MISS` 워터마크 격자 + 보라 라디얼 |
| 파티클 | 컨페티 블록 + 방사 스파크 | X 컨페티 | 스케치 픽셀 디졸브 + 균열 |
| 슬래브 | 초록 `정답입니다!` | 빨강 `오답입니다!` (떨림) | 빨강 `GAME OVER` 스탬프 + 노랑 `정답은 ○○!` |
| 캐릭터 | 폴짝 뛰기(hop) | 부들 떨기(shiver) | 부들 떨기 + 말풍선 |
| CTA | `다음 라운드` (점멸) | `계속 추측하기` (점멸 없음) | `다음 라운드` (점멸) |

공통 구성 요소(세 화면 모두 동일 스펙):
- **스테이지**: `position: relative; overflow: hidden`, `flex: 1`, 배경만 상태별 교체
- **발화 칩** (상단): 아바타 20px + 닉네임 12px + 추측 텍스트 13px (+정답 시 `+100` 배지), `padding: 7px 11px`, `box-shadow: 0 0 0 3px #0f0a19`
- **결과 슬래브**: `padding: 12px 22px`, Galmuri14 **27px**, 픽셀 테두리 `0 0 0 4px #0f0a19` + 입체 굽 `0 7px 0 4px <어두운 대표색>`, `border-radius: 0`
- **링 펄스**: 150×150 정사각형, `box-shadow: 0 0 0 5px <대표색>`, `ringPop 1.6~1.8s steps(6) infinite` (scale .2→2.4, opacity .9→0). 정답은 초록·노랑 2개를 .9s 엇갈려 사용
- **CTA 버튼**: 좌우 14px 인셋, 높이 **44px**, 배경 = 스테이지 배경, `inset 0 0 0 3px <대표색>`, 라벨 13px
- 모든 애니메이션은 `steps()` 또는 짧은 `ease-in-out`만 사용 — 부드러운 cubic-bezier 금지(레트로 픽셀 느낌 유지)

## Keyframes (그대로 사용)

```css
@keyframes rayTurn      { from { transform: rotate(0) }   to { transform: rotate(360deg) } }
@keyframes ringPop      { 0% { transform: scale(.2); opacity: .9 } 100% { transform: scale(2.4); opacity: 0 } }
@keyframes slabPop      { 0% { transform: scale(.55) translateY(16px); opacity: 0 }
                          60% { transform: scale(1.1) translateY(0); opacity: 1 }
                          100% { transform: scale(1) translateY(0); opacity: 1 } }
@keyframes idleBob      { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
@keyframes hop          { 0%,100% { transform: translateY(0) } 40% { transform: translateY(-10px) } }
@keyframes shiver       { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-2px) } 75% { transform: translateX(2px) } }
@keyframes confettiFall { 0% { transform: translateY(-30px) rotate(0); opacity: 0 } 10% { opacity: 1 }
                          85% { opacity: 1 } 100% { transform: translateY(420px) rotate(180deg); opacity: 0 } }
@keyframes sparkOut     { 0% { transform: translate(0,0) scale(1); opacity: 1 }
                          100% { transform: translate(var(--dx), var(--dy)) scale(.4); opacity: 0 } }
@keyframes xDrop        { 0% { transform: translateY(-30px) rotate(0); opacity: 0 } 12% { opacity: 1 }
                          100% { transform: translateY(430px) rotate(120deg); opacity: 0 } }
@keyframes blockFall    { 0% { transform: translateY(0) rotate(0); opacity: 1 } 60% { opacity: .85 }
                          100% { transform: translateY(170px) rotate(28deg); opacity: 0 } }
@keyframes barrelRoll   { from { background-position: 0 0 } to { background-position: 0 28px } }
@keyframes crackGrow    { 0% { transform: scaleY(0); opacity: 0 } 100% { transform: scaleY(1); opacity: 1 } }
@keyframes stampIn      { 0% { transform: scale(2.6) rotate(-9deg); opacity: 0 }
                          45% { transform: scale(1) rotate(-5deg); opacity: 1 }
                          60% { transform: scale(1.07) rotate(-5deg) }
                          100% { transform: scale(1) rotate(-5deg); opacity: 1 } }
@keyframes stampIdle    { 0%,100% { transform: rotate(-5deg) translateY(0) } 50% { transform: rotate(-5deg) translateY(-3px) } }
@keyframes hardBlink    { 0%,55% { opacity: 1 } 56%,100% { opacity: .2 } }
@keyframes scoreRise    { 0% { transform: translateY(10px); opacity: 0 } 100% { transform: translateY(-14px); opacity: 1 } }
```

⚠️ **등장 애니메이션과 idle 루프는 반드시 분리**한다: `slabPop .4s steps(5) both, idleBob 2.2s ease-in-out .4s infinite` 처럼 등장은 `both`로 1회, 그 뒤 idle만 무한 루프. `infinite alternate` 하나로 처리하면 요소가 주기적으로 사라진다.

---

## 4a. 정답 (`정답입니다!`)

- 스테이지 배경 `#0b2a20`
- **방사 광선**: 620×620, 스테이지 중심 상단(left 50%, top 34%)에 배치, `repeating-conic-gradient(from 0deg, rgba(44,227,159,.17) 0 14deg, transparent 14deg 28deg)`, `rayTurn 14s linear infinite`
- **글로우**: `radial-gradient(circle at 50% 34%, rgba(44,227,159,.22) 0%, transparent 58%)`
- **링 펄스 2개**: `#2ce39f`(delay 0), `#ffd21f`(delay .9s)
- **컨페티 20개**: 8px(2/3) / 12px(1/3) 정사각형, 색 `#ff2e6a #ffd21f #2ce39f #6fd3f0 #c4a3f5 #ff8ac0` 순환, 각 블록 `box-shadow: 0 0 0 2px #0f0a19`, x위치 `(i*83)%92+4 %`, `confettiFall 1.9~2.9s linear infinite`, delay `(i%10)*0.21s`
- **방사 스파크 12개**: 7px 정사각형, 중심에서 12방향(각 `i/12*2π`, 반경 96px)으로 `sparkOut 1.3s steps(5) infinite`, 색 노랑/초록 교차, delay `(i%4)*0.32s`
- **발화 칩**: 배경 `#14c98a`, 텍스트 `#08251a`, `+100` 배지 포함
- **슬래브**: 배경 `#2ce39f`, 텍스트 `#06251a`, 굽 `#0b6b4c`
- **점수**: Galmuri14 15px `#ffd21f`, `+100 POINT`, `scoreRise 1.4s ease-out infinite`
- **캐릭터**: 44px, `hop 1s ease-in-out infinite`, 유저별 delay 0 / .15s
- **CTA**: `다음 라운드`, 테두리·텍스트 `#2ce39f`, `hardBlink 1.1s steps(1) infinite`

## 4b. 오답 (`오답입니다!`)

- **캔버스 유지**: 흰 캔버스와 진행 중인 스케치 스트로크를 그대로 두고, 그 위에 `rgba(42,13,22,.55)` 스크림 → 경고 스트라이프 → 글로우 순으로 얹는다. 출제자는 계속 그리는 중이므로 그림이 완전히 가려지면 안 된다.
- **경고 스트라이프**: `inset: -30px`, `repeating-linear-gradient(135deg, rgba(255,46,106,.16) 0 14px, transparent 14px 28px)`, `barrelRoll 1.1s linear infinite` (계속 흐름)
- **글로우**: `radial-gradient(circle at 50% 32%, rgba(255,46,106,.26) 0%, transparent 60%)` + 링 펄스 `#ff2e6a` 1개
- **X 컨페티 14개**: 14px(2/3) / 20px(1/3), 두 개의 30%-폭 바를 ±45° 회전시켜 만든 픽셀 X, 색 `#ff2e6a`(기본) / `#ff8ac0`(1/4), `xDrop 2.1~3.0s linear infinite`, delay `(i%7)*0.3s`
- **발화 칩**: 배경 `#4c1020`, 닉네임 `#ffc4d5`, 텍스트 `#ffe3ea` (점수 배지 없음)
- **슬래브**: 배경 `#ff2e6a`, 텍스트 `#2b0410`, 굽 `#7a0a26`, 등장 후 `shiver .18s steps(2) infinite`
- **서브 라인**: `남은 기회 2번` — 반드시 **불투명 칩 안에** 넣는다(`background: #4c1020; box-shadow: 0 0 0 3px #0f0a19; padding: 5px 10px`, 위의 발화 칩과 동일 처리). 텍스트 13px `#ffc4d5`, 숫자만 `#ffd21f`. 스테이지가 반투명 스크림이라 칩 없이 얹으면 대비가 3:1 아래로 떨어진다.
- **캐릭터**: 오답을 낸 유저 1명만, 말풍선(`아 뭐야`) + 44px 아바타, 전체를 `shiver .22s steps(2) infinite`
- **CTA**: `계속 추측하기` — 라운드가 끝난 게 아니므로 **점멸 없음**, 배경 `#2a0d16` + 외곽 테두리 `0 0 0 3px #ff2e6a`(스크림 위에 얹히므로 inset 대신 외곽), 텍스트 `#ffc4d5`
- 오답은 라운드를 멈추지 않는다 → 상단 제시어는 `□ □ □ □` 형태의 글자 수 힌트 유지, 타이머 계속 감소

## 4c. 게임 오버 (`GAME OVER`)

기존 3b의 "정체 불명 픽셀 입자"를 제거하고, 실패를 명시하는 3가지 그래픽으로 교체했다:

1. **MISS 워터마크 격자** — 스테이지 전체에 `MISS` 텍스트(Galmuri14 30px, `#c0b4d8`)를 2열 그리드로 8개 반복, `opacity: .16`. 정적(움직이지 않음) — 배경 노이즈가 아니라 "실패" 라벨임이 읽힌다.
2. **스케치 픽셀 디졸브** — 아무도 못 맞힌 그림이 블록으로 부서져 떨어진다. 12×12 그리드(`grid-auto-rows: 14px`, 좌우 44px 인셋, 높이 176px, `overflow: hidden`), 블록 색 `#c0b4d8`, `blockFall 2.6s steps(8) infinite`, delay `row*0.09 + (col%4)*0.05` — 위에서 아래로 무너지는 파도. 마스크(1=블록):
   ```
   000111111000  001100001100  011000000110  011000110110
   011001111010  011000110010  001100000110  000111111100
   000001100000  000011110000  000110011000  001100001100
   ```
   (실제 구현에서는 해당 라운드의 캔버스를 12×12로 다운샘플링해 마스크를 만들면 "내가 보던 그림이 부서진다"가 된다 — 권장)
3. **바닥 균열** — 디졸브 아래 `#4a3a5c` 3px 지면선 + 아래로 자라는 균열 5개(높이 18/30/22/34/24px, `crackGrow 1.6s steps(4) infinite`, delay `i*0.18s`)

- 스테이지 배경 `#1a1030` + `radial-gradient(circle at 50% 26%, #3d2a6b, #1a1030 56%, #0c0813)`
- **GAME OVER 스탬프**: 배경 `#ff2020`, 텍스트 `#2b0410` Galmuri14 26px, 굽 `#5a0a14`, `stampIn .5s steps(6) both` → `stampIdle 2.4s ease-in-out .5s infinite` (-5° 기울기 유지)
- **서브 라인**: `아무도 못 맞혔어요` 13px `#c0b4d8`
- **정답 공개 슬래브**: 배경 `#ffd21f`, 텍스트 `#14101c` Galmuri14 22px, 굽 `#7a4a24`, `slabPop .4s steps(5) .25s both` → `idleBob`
- **캐릭터**: 전원 말풍선(`아 뭐야...`, `내 그림 맞는데`) + 44px 아바타, `shiver .26s steps(2) infinite`
- **CTA**: `다음 라운드`, 테두리 `#ff2e6a`, `hardBlink`
- 상단: 제시어 `□ □ □ □`(미공개 유지), 타이머 `0` `#ff2020`, 참가자 정답 점은 전부 회색 `#4a3a5c`

---

## 타이밍 / 연출 시나리오 (실제 구현)

레퍼런스는 확인용으로 모든 애니메이션을 무한 루프로 돌린다. 실제 앱에서는:

| 화면 | 트리거 | 지속 | 종료 |
|---|---|---|---|
| 정답 | 서버 `correct` 이벤트 | 약 2.0s | 자동 닫힘 → 다음 라운드 (CTA 탭으로 스킵 가능) |
| 오답 | 본인 추측이 오답 판정 | 약 1.2s | 자동 닫힘 → 입력창 복귀 (게임은 진행 중) |
| 게임 오버 | 타이머 0 / 전원 실패 | 약 3.0s 이상 | CTA 탭 또는 서버 `roundStart` |

- 파티클은 **1회 버스트**로: 컨페티/X는 `animation-iteration-count: 1`로 생성 후 종료 시 제거. 링 펄스는 2~3회만.
- 오답 오버레이는 캔버스 위에 반투명으로 얹고 드로잉을 가리지 않게 유지(출제자는 계속 그리는 중).
- 정답/게임오버는 캔버스 전체를 결과 스테이지로 덮는다.
- 사운드가 있다면: 정답 = 상승 아르페지오, 오답 = 짧은 부저, 게임오버 = 하강 3음. 전부 8비트 칩튠.
- `prefers-reduced-motion: reduce`에서는 파티클·회전·점멸을 모두 끄고 슬래브 페이드인만 남긴다.

## 추가 토큰 (README.md 토큰에 더해서)

- 정답: `#2ce39f` / `#14c98a` / 스테이지 `#0b2a20` / 온-초록 텍스트 `#06251a` `#08251a` / 굽 `#0b6b4c`
- 오답: `#ff2e6a` / `#ff8ac0` / 스테이지 `#2a0d16` / 칩 `#4c1020` / 온-빨강 텍스트 `#2b0410` / 굽 `#7a0a26`
- 게임오버: `#ff2020` / 굽 `#5a0a14` / 스테이지 `#1a1030` / 보라 글로우 `#3d2a6b` / 워터마크·디졸브 `#c0b4d8` / 지면·균열 `#4a3a5c`
- 강조 노랑: `#ffd21f` / 굽 `#7a4a24`
- 컨페티 팔레트: `#ff2e6a #ffd21f #2ce39f #6fd3f0 #c4a3f5 #ff8ac0`
