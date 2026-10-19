// 필기·완성 대기 시간을 분리해 두 스피너의 반복 속도를 한 곳에서 관리한다.
const duration = { fast: 160, base: 240, slow: 400 } as const;

export const loadingMotion = {
  circleCycle: duration.fast * 8,
  notebookBlank: duration.slow,
  notebookWriting: duration.base * 10,
  notebookHold: duration.base * 4,
  sparkleStep: duration.fast,
} as const;

export const notebookCycle = loadingMotion.notebookBlank + loadingMotion.notebookWriting + loadingMotion.notebookHold;
