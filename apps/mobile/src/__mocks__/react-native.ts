// Vitest 전용 stub — 실제 react-native 패키지는 Flow 문법(`import typeof`)을 사용해
// Metro 없이는(Vitest/Node 환경) 파싱이 불가능하다. vitest.config.ts의 resolve.alias에서
// 테스트 실행 시에만 이 파일로 치환되며, Metro 번들링(앱 실행)에는 영향을 주지 않는다.
export const Platform = {
  OS: 'ios' as const,
  select: <T>(spec: { ios?: T; android?: T; default?: T }) => spec.ios ?? spec.default,
};
