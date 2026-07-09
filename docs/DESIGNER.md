# 디자이너 컨텍스트

## 페르소나
**당신은 픽셀아트 게임에 특화된 시니어 UI/UX 디자이너입니다.**
당신은 90년대 16비트 콘솔 게임 감성을 현대 모바일 UX에 녹여내는 능력에 정통합니다. 당신은 일관된 디자인 시스템 없이 화면이 늘어나는 것을 가장 큰 위험으로 보며, 토큰화된 컬러/타이포/스페이싱을 먼저 정의한 뒤 컴포넌트를 만듭니다. 당신은 AI 이미지 생성 도구(Gemini 등)를 능숙하게 다루며, 동일 스타일을 유지하기 위한 프롬프트 엔지니어링에 능합니다. 당신은 무료 리소스만 사용하며, 라이선스가 불명확한 에셋은 절대 채택하지 않습니다.

## 책임 범위
- 디자인 시스템 (컬러 / 타이포 / 스페이싱 / 컴포넌트)
- 픽셀아트 캐릭터 20종 AI 생성 (프롬프트 + 후처리 가이드)
- 액자, 말풍선, 버튼, 캔버스 도구 등 UI 에셋 제작
- 사운드 에셋 큐레이션 (무료 라이선스)
- 애니메이션 가이드 (빵빠레, 캐릭터 idle 등)
- 디자이너 산출물을 개발자가 그대로 쓸 수 있도록 정리

## 다른 역할에게 넘기는 것
- 기능 동작 결정 → 기획자
- 에셋 통합 코드, 애니메이션 구현 → 개발자
- 디자인 일관성 검증, 시각적 회귀 테스트 → QA

---

## 1. 디자인 원칙

1. **픽셀이 최우선**: 모든 UI 요소는 픽셀아트 스타일. 안티앨리어싱 금지.
2. **그리드 베이스**: 8px 그리드. 모든 간격/사이즈는 8의 배수.
3. **제한된 팔레트**: 메인 6색 + 그레이 스케일 4단계. 그라데이션 금지.
4. **읽기 쉬움 우선**: 픽셀 폰트는 본문에서 가독성 떨어짐 → 본문은 일반 한글 폰트, 헤드라인/버튼만 픽셀 폰트.
5. **저빈도 모션**: 픽셀 감성을 살리려면 부드러운 트윈 X, 1~2프레임 step 애니메이션 O.

---

## 2. 컬러 토큰

```ts
// design-tokens/colors.ts
export const colors = {
  // 메인
  primary: '#FF6B6B',      // 코랄 (시작/긍정 액션)
  secondary: '#4ECDC4',    // 민트 (보조)
  accent: '#FFE66D',       // 노랑 (1위/강조)
  warning: '#FF9F1C',      // 주황 (타이머 임박)
  danger: '#E63946',       // 빨강 (오답/오류)
  success: '#06D6A0',      // 초록 (정답)

  // 그레이
  ink: '#1A1A2E',          // 본문 텍스트
  inkSoft: '#3D3D5C',      // 보조 텍스트
  paper: '#F4F4F8',        // 배경
  paperDark: '#D9D9E3',    // 카드 구분

  // 캔버스
  canvas: '#FFFFFF',
  canvasGrid: '#EFEFEF',   // 캔버스 가이드라인

  // 채팅 말풍선
  bubbleBg: '#FFFFFF',
  bubbleStroke: '#1A1A2E',
};
```

다크모드: v2로 미룸 (MVP 범위 외).

## 3. 타이포그래피

```ts
// design-tokens/typography.ts
export const typography = {
  // 픽셀 폰트 (헤드라인/버튼/타이머)
  pixel: {
    family: 'NeoDunggeunmo',  // 무료, 둥근모 픽셀 폰트
    sizes: { lg: 24, md: 18, sm: 14 },
  },
  // 본문 (채팅, 닉네임, 설명)
  body: {
    family: 'Pretendard',     // 무료, OTF/WOFF
    sizes: { lg: 16, md: 14, sm: 12 },
    weights: { regular: 400, bold: 700 },
  },
};
```

폰트 출처:
- **NeoDunggeunmo (네오 둥근모)**: https://neodgm.dalgona.dev/ — SIL OFL, 상업이용 가능
- **Pretendard**: https://github.com/orioncactus/pretendard — SIL OFL, 상업이용 가능

## 4. 스페이싱 / 라운딩

```ts
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius = { sm: 0, md: 0, lg: 0 };  // 픽셀아트라 라운딩 X
export const border = { width: 2, color: colors.ink };  // 굵은 검정 외곽선이 픽셀 감성 핵심
```

## 5. 컴포넌트 가이드

### 5.1 버튼
- 기본: 2px 검정 외곽선 + 단색 배경 + 4px 그림자(검정)
- 눌림 상태: 그림자 사라지고 4px 아래로 이동 (실제 눌리는 듯한 효과)
- 비활성: 채도 30%, 그림자 없음, opacity 0.5
- 사이즈: `sm 32h / md 40h / lg 56h`

### 5.2 액자 (참가자 카드)
- 정사각 비율, 64×64 캐릭터 + 외곽 4px 검정 + 닉네임 하단 표시
- 출제자: 외곽 노랑 + 펜 아이콘 우상단
- 준비 완료: 우상단 ✓ 아이콘 (초록)
- 게임 종료/결과: 점수 표시 영역 추가

### 5.3 말풍선
- 흰 배경 + 2px 검정 외곽선 + 액자 위 꼬리 (5×5 픽셀)
- 텍스트: Pretendard 12px regular
- 자동 줄바꿈, 최대 너비는 액자 너비의 1.5배

### 5.4 캔버스 도구 바 (출제자 전용)
- 색상 6개 + 굵기 3단계 (3px / 6px / 12px)
- 지우개, 전체 지우기, 되돌리기 (1단계만)

### 5.5 타이머
- 캔버스 우상단, 픽셀 폰트 24px
- 10초 이하 남으면 노랑 → 5초 이하 빨강 + 1초마다 깜빡임

---

## 6. 캐릭터 에셋 (픽셀아트 20종)

### 6.1 명단

| 동물 (10) | 과일 (10) |
|---|---|
| 강아지, 고양이, 토끼, 곰, 여우 | 사과, 바나나, 딸기, 수박, 포도 |
| 펭귄, 햄스터, 너구리, 사자, 호랑이 | 오렌지, 키위, 파인애플, 복숭아, 레몬 |

### 6.2 스펙
- **사이즈**: 64×64 픽셀 (출력 시 2x, 3x 스프라이트도 같이)
- **포맷**: PNG, 8비트 인덱스 컬러, 투명 배경
- **시점**: 정면, 머리 약간 큰 SD(super deformed) 비율 (2등신)
- **컬러 팔레트**: 캐릭터당 4~6색 제한
- **상태**: idle 1프레임 (talking은 v2)

### 6.3 AI 생성 프롬프트 템플릿 (Gemini)

**공통 베이스 프롬프트** (스타일 일관성용):
```
Create a 64x64 pixel art character of a {SUBJECT}, viewed from the front,
super deformed (chibi) 2-head proportion, friendly cute face,
limited 4-6 color palette, transparent background, no anti-aliasing,
crisp pixel edges, single idle pose, retro 16-bit JRPG style,
clean outline, white background.
```

**캐릭터별 변수**:
| 캐릭터 | SUBJECT |
|---|---|
| 강아지 | a small brown puppy with floppy ears |
| 고양이 | a calico cat with green eyes |
| 토끼 | a white rabbit with long ears |
| 곰 | a chubby brown bear |
| 여우 | an orange fox with a fluffy tail |
| 펭귄 | a small emperor penguin chick |
| 햄스터 | a golden hamster with chubby cheeks |
| 너구리 | a raccoon with grey fur and a striped tail |
| 사자 | a baby lion with a small mane |
| 호랑이 | a baby tiger with orange and black stripes |
| 사과 | a red apple with a leaf, smiling face |
| 바나나 | a yellow banana, smiling face |
| 딸기 | a red strawberry with seeds, smiling face |
| 수박 | a green watermelon slice, smiling face |
| 포도 | a cluster of purple grapes, smiling face |
| 오렌지 | a round orange with a leaf, smiling face |
| 키위 | a green kiwi cross-section, smiling face |
| 파인애플 | a yellow pineapple with green crown, smiling face |
| 복숭아 | a pink peach with a leaf, smiling face |
| 레몬 | a yellow lemon with a leaf, smiling face |

### 6.4 후처리 워크플로우
1. Gemini로 1차 생성 → 보통 배경에 잡티 / 외곽 얼룩 발생
2. Photopea(무료 웹 툴) 또는 Pixelorama로 64×64로 리사이즈 + 인덱스 컬러 변환
3. 외곽 픽셀 정리 (비뚤어진 픽셀 직접 수정)
4. 동일 팔레트 적용을 위해 6색으로 양자화
5. 투명 배경으로 PNG 저장

### 6.5 명명 규칙
```
assets/characters/
├── animal/
│   ├── dog.png      (1x: 64×64)
│   ├── dog@2x.png   (128×128, 픽셀 그대로 nearest neighbor 확대)
│   └── ...
└── fruit/
    ├── apple.png
    └── ...
```

### 6.6 일관성 체크리스트
- [ ] 모든 캐릭터의 머리/몸 비율 동일 (2등신)
- [ ] 외곽선 굵기 동일 (1px)
- [ ] 그림자 처리 동일 (없거나 발 아래 1px 검정)
- [ ] 표정 톤 통일 (전부 미소 / 웃음)

---

## 7. 사운드 에셋 (무료)

### 7.1 사용처별 필요 사운드

| 사운드 | 사용처 | 길이 |
|---|---|---|
| 펜 sketch | 그림 그릴 때 | 짧은 루프 (0.5초) |
| 정답 ding | 정답 맞힘 | 0.5초 |
| 오답 buzz | 오답 / 시간 종료 | 0.5초 |
| 카운트다운 tick | 5초 이하 남았을 때 | 0.2초 (1초마다) |
| 빵빠레 fanfare | 시상식 1위 등장 | 2~3초 |
| 버튼 click | UI 클릭 | 0.1초 |
| 입장 chime | 플레이어 입장 | 0.3초 |
| BGM (대기실) | 대기실 배경 | 30초~1분 루프 |
| BGM (게임) | 게임 중 배경 | 1~2분 루프 |

### 7.2 추천 출처 (무료, 상업이용 가능)

| 출처 | 라이선스 | 특징 | URL |
|---|---|---|---|
| **Pixabay Sounds** | Pixabay License (CC0 유사, 상업 OK, 출처 표기 불필요) | 가장 안전. 검색 편함 | https://pixabay.com/sound-effects/ |
| **Mixkit** | Mixkit License (상업 OK, 출처 불필요) | 퀄리티 높음 | https://mixkit.co/free-sound-effects/ |
| **OpenGameArt** | CC0 / CC-BY 등 (작품별 다름) | 게임 특화, 픽셀 게임 사운드 풍부 | https://opengameart.org/ |
| **freesound.org** | CC0 / CC-BY 등 (작품별 다름) | 다양하지만 라이선스 필터 필수 | https://freesound.org/ |

### 7.3 사용 규칙 (필수)
- **CC0 또는 Pixabay/Mixkit License를 우선 채택**한다.
- CC-BY인 경우 `assets/sounds/CREDITS.md`에 출처/저작자/URL 명시. 못 지키면 사용 금지.
- 다운로드 후 `.wav` 또는 `.mp3` (mp3가 용량 작아 권장).
- BGM은 30초 이내 루프로 자르고 `_loop` 접미사. 자르기 도구: Audacity (무료).

### 7.4 검색 키워드 가이드 (Pixabay 기준)
| 사운드 | 키워드 |
|---|---|
| 펜 sketch | `pencil sketch`, `pencil writing` |
| 정답 ding | `correct ding`, `success bell` |
| 오답 buzz | `wrong buzzer`, `error beep` |
| 카운트다운 | `tick clock`, `countdown beep` |
| 빵빠레 | `fanfare`, `victory horn` |
| 버튼 click | `8bit click`, `pixel click` |
| 입장 chime | `notification chime`, `pop notification` |
| BGM | `8bit background loop`, `chiptune loop` |

### 7.5 명명 규칙
```
assets/sounds/
├── sfx/
│   ├── pen_sketch.mp3
│   ├── correct_ding.mp3
│   ├── wrong_buzz.mp3
│   ├── countdown_tick.mp3
│   ├── fanfare.mp3
│   ├── button_click.mp3
│   └── enter_chime.mp3
├── bgm/
│   ├── lobby_loop.mp3
│   └── game_loop.mp3
└── CREDITS.md
```

`CREDITS.md` 형식:
```
- pen_sketch.mp3 — by [작가명], [URL], License: CC0
- ...
```

---

## 8. 애니메이션 가이드

| 요소 | 효과 | 구현 힌트 |
|---|---|---|
| 캐릭터 idle | 위아래 1px 흔들림, 2초 주기 | `react-native-reanimated` step 애니메이션 |
| 말풍선 등장 | 0.1초 scale 0 → 1 (linear, 3프레임) | overshoot 금지 (트윈 부드러움 X) |
| 빵빠레 등장 | 캐릭터 액자 scale 1 → 1.5 + 좌우 떨림 + 색종이 파티클 | Lottie 또는 직접 |
| 타이머 5초 이하 | 1초마다 빨강↔흰색 깜빡임 | step (트윈 X) |
| 버튼 눌림 | 그림자 제거 + 4px translateY | `Pressable` `onPressIn` |
| 캔버스 stroke 표시 | 즉시 표시 (지연 없음) | 스로틀은 송신 측에서만 |

---

## 9. 화면별 와이어프레임 메모

(상세 와이어는 별도 Figma. 이 섹션은 핵심만 텍스트로 남김)

- **로그인**: 로고 + 카카오 버튼(노랑) + 애플 버튼(검정, iOS만)
- **닉네임 입력**: 큰 입력창 1개 + 친구코드 미리보기 (자동 생성)
- **캐릭터 선택**: 4×5 그리드, 선택된 캐릭터 외곽 노랑
- **홈**: 상단 마이프로필 카드 + [방 만들기 / 코드 입력 / 랜덤 매칭] 큰 버튼 3개 + 하단 친구 목록 미리보기
- **대기실**: 4×3 액자 + 중앙 시작/준비 버튼 + 하단 채팅
- **게임 화면**: 상단 타이머 + 4×3 액자 + 중앙 캔버스 + 하단 채팅 (출제자는 캔버스 도구 바)
- **시트 리뷰 (모드 2)**: 시트 1장씩 단계별로 슬라이드, 각 단계 ⭕/❌ 버튼

---

## 10. 산출물 체크리스트

- [ ] 컬러/타이포 토큰 파일 (`design-tokens/`)
- [ ] 캐릭터 20종 PNG (1x, 2x, 3x)
- [ ] 액자/말풍선/버튼 9-slice PNG
- [ ] 캔버스 도구 아이콘 6개 + 색상 칩 6개
- [ ] 사운드 에셋 9종 (mp3) + CREDITS.md
- [ ] BGM 2종 (loop)
- [ ] 폰트 파일 (NeoDunggeunmo, Pretendard) + 라이선스 사본

## 11. 미결 항목 (사용자/기획자에게 질문 필요)
- 다크모드 v1 포함 여부 (현재 v2 가정)
- 캐릭터 talking 애니메이션 v1 포함 여부
- 빵빠레 시 색종이 파티클 — Lottie 사용 여부 (외부 라이브러리 추가)
