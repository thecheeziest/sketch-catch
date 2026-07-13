// Pitfall 2 스모크 테스트 — Alpine(musl) 컨테이너에서 @napi-rs/canvas 한글 폰트 렌더링 실패 가능성 확인
// 로컬(darwin)에서는 항상 정상 렌더링되므로, 이 스크립트의 진짜 검증 가치는 실제 서버 Dockerfile로
// 빌드한 컨테이너(node:20-alpine) 안에서 실행했을 때 나온다.
//
// 실행: node dist/scripts/gif-font-smoke.js (빌드 후) 또는 tsx apps/server/scripts/gif-font-smoke.ts (로컬)
import { sheetToGif, debugRenderTextFrame } from '../src/services/gif.service.js';

const SAMPLE_TEXT = '강아지가 하늘을 난다';
const GIF_MAGIC = 'GIF89a'; // 0x47 0x49 0x46 0x38 0x39 0x61
const BACKGROUND = { r: 0xfa, g: 0xfa, b: 0xfa }; // #FAFAFA (TEXT_BG in gif.service.ts)
const CHANNEL_TOLERANCE = 10;

async function main(): Promise<void> {
  // 1) sheetToGif 전체 파이프라인이 실제로 유효한 GIF 바이너리를 생성하는지 확인
  const buffer = await sheetToGif({
    steps: [{ kind: 'PROMPT', authorId: 'smoke-test', text: SAMPLE_TEXT }],
    width: 480,
    height: 480,
    fps: 12,
  });

  const magic = buffer.subarray(0, 6).toString('ascii');
  if (magic !== GIF_MAGIC) {
    console.error(`[FAIL] GIF magic bytes 불일치: got "${magic}", expected "${GIF_MAGIC}"`);
    process.exit(1);
  }
  console.log(`[OK] GIF89a 매직 바이트 확인 (${buffer.length} bytes)`);

  // 2) 텍스트 프레임에 배경색(#FAFAFA)이 아닌 픽셀(=글자)이 실제로 존재하는지 확인
  //    Alpine/musl 환경에서 폰트 렌더링이 실패하면 전체가 배경색으로만 채워짐 (Pitfall 2)
  const { data, width, height } = debugRenderTextFrame(SAMPLE_TEXT, 480, 480);

  let nonBackgroundPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const diff = Math.abs(r - BACKGROUND.r) + Math.abs(g - BACKGROUND.g) + Math.abs(b - BACKGROUND.b);
    if (diff > CHANNEL_TOLERANCE) {
      nonBackgroundPixels++;
    }
  }

  console.log(`[INFO] non-background(글자) 픽셀 수: ${nonBackgroundPixels} / ${width * height}`);

  if (nonBackgroundPixels === 0) {
    console.error(
      '[FAIL] 한글 텍스트가 렌더링되지 않음 — Alpine/musl 폰트 렌더링 이슈로 의심됨 (RESEARCH Pitfall 2). ' +
        'apps/server/Dockerfile runner base를 node:20-alpine → node:20-slim으로 교체 검토 필요.'
    );
    process.exit(1);
  }

  console.log('[PASS] 한글 텍스트 GIF 프레임 렌더링 확인 완료');
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('[FAIL] 스모크 테스트 실행 중 예외 발생', err);
  process.exit(1);
});
