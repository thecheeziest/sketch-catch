/** RN에 CSS steps() 이징이 없어 진행값 자체를 n단으로 양자화해 흉내낸다 (픽셀 룩 유지). */
export function makeStepEasing(steps: number) {
  return (t: number) => {
    'worklet';
    return Math.floor(t * steps) / steps;
  };
}
