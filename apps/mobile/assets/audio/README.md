# TV 모달 효과음

- `tv-on.wav`: 340ms. 전원 클릭, 상승하는 전자음, 약한 CRT 잡음.
- `tv-off.wav`: 240ms. 하강하는 전자음, 화면이 점으로 줄어드는 160ms 지점의 전원 클릭.
- 44.1kHz / mono / 16-bit PCM WAV. 최대 진폭 0.55, 양 끝 fade 적용.
- 외부 음원·샘플을 사용하지 않고 이 프로젝트에서 직접 합성한 에셋. 별도 출처 표시나 외부 라이선스 비용 없음.
- 재생성: 저장소 루트에서 `node apps/mobile/scripts/generate-tv-sounds.mjs`.
