import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 승인된 미리듣기 WAV만 가져온다. 인자 없이 실행해 확정 음원을 옛 합성음으로 덮어쓰지 않는다.
const [coinPath, closePath, openPath] = process.argv.slice(2);
if (!coinPath || !closePath || !openPath) {
  throw new Error('Usage: node generate-shop-sounds.mjs <coin-1356ms.wav> <close-650ms.wav> <open-650ms.wav>');
}
const directory = fileURLToPath(new URL('../assets/audio/', import.meta.url));

function readWave(path, durationMs) {
  const buffer = readFileSync(path);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`Not a WAV file: ${path}`);
  }
  let format;
  let pcm;
  for (let offset = 12; offset + 8 <= buffer.length; ) {
    const size = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + size);
    const id = buffer.toString('ascii', offset, offset + 4);
    if (id === 'fmt ') format = chunk;
    if (id === 'data') pcm = chunk;
    offset += 8 + size + (size % 2);
  }
  if (!format || !pcm || format.readUInt16LE(0) !== 1 || format.readUInt16LE(14) !== 16) {
    throw new Error(`Expected PCM 16-bit WAV: ${path}`);
  }
  const rate = format.readUInt32LE(4);
  const channels = format.readUInt16LE(2);
  const frameSize = channels * 2;
  const frames = Math.round((rate * durationMs) / 1000);
  if (pcm.length !== frames * frameSize) throw new Error(`Expected ${durationMs}ms: ${path}`);
  return { format, pcm, rate, channels, frameSize };
}

function writeWave(name, format, pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  format.copy(header, 20, 0, 16);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  writeFileSync(`${directory}${name}.wav`, Buffer.concat([header, pcm]));
}

// 입력 세 개를 모두 검증한 뒤 적용한다. 원본의 속도·음높이·스테레오를 유지한다.
const coin = readWave(coinPath, 1356);
const close = readWave(closePath, 650);
const open = readWave(openPath, 650);
const split = Math.round(coin.rate * 0.56) * coin.frameSize;
const rain = Buffer.from(coin.pcm.subarray(0, split));
// 로딩 중 반복 경계에만 2ms 페이드. 마지막 낙하음은 승인본의 560~1356ms를 그대로 사용한다.
const fadeFrames = Math.round(coin.rate * 0.002);
const totalFrames = rain.length / coin.frameSize;
for (let frame = 0; frame < fadeFrames; frame++) {
  const gain = frame / (fadeFrames - 1);
  for (let channel = 0; channel < coin.channels; channel++) {
    const offset = (totalFrames - 1 - frame) * coin.frameSize + channel * 2;
    rain.writeInt16LE(Math.round(rain.readInt16LE(offset) * gain), offset);
  }
}
writeWave('coin-rain', coin.format, rain);
writeWave('coin-rain-tail', coin.format, coin.pcm.subarray(split));
writeWave('curtain-close', close.format, close.pcm);
writeWave('curtain-open', open.format, open.pcm);
