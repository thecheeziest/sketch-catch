import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 외부 샘플 없이 합성한다. 같은 seed로 동일한 금속 충돌·천 마찰음을 재생성한다.
const RATE = 44100;
const directory = fileURLToPath(new URL('../assets/audio/', import.meta.url));
let seed = 82291;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}

function write(name, samples, peak) {
  const maximum = samples.reduce((value, sample) => Math.max(value, Math.abs(sample)), 0);
  const pcm = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, index) => pcm.writeInt16LE(Math.round((sample / maximum) * peak * 32767), index * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  writeFileSync(`${directory}${name}.wav`, Buffer.concat([header, pcm]));
}

function coins(duration, tail) {
  const samples = new Float64Array(Math.round(RATE * duration));
  // 정수 배음이 아닌 공진으로 얇은 금속끼리 부딪치는 질감을 만든다.
  for (let hit = 0; hit < 64; hit++) {
    const start = (hit / 64) * duration + random() * 0.012;
    const frequency = 1800 + random() * 1800;
    const amplitude = 0.18 + random() * 0.35;
    for (let i = 0; i < RATE * 0.18; i++) {
      const t = i / RATE;
      let index = Math.floor(start * RATE) + i;
      if (tail && index >= samples.length) break;
      index %= samples.length;
      const ring =
        Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 48) +
        0.5 * Math.sin(2 * Math.PI * frequency * 1.47 * t) * Math.exp(-t * 65) +
        0.3 * Math.sin(2 * Math.PI * frequency * 2.09 * t) * Math.exp(-t * 85);
      const impact = (random() * 2 - 1) * Math.exp(-t * 600);
      samples[index] += amplitude * (ring * Math.min(1, t / 0.0007) + impact * 0.25);
    }
  }
  if (tail) {
    samples.forEach((sample, i) => {
      samples[i] = sample * (1 - i / samples.length) ** 1.4;
    });
  } else {
    // 반복 경계의 클릭을 억제하고 대기 중에도 동전 밀도를 유지한다.
    samples.forEach((sample, i) => {
      samples[i] = sample * Math.min(1, i / 100, (samples.length - 1 - i) / 100);
    });
  }
  return samples;
}

function curtain(opening) {
  const samples = new Float64Array(Math.round(RATE * 0.38));
  let low = 0;
  let fabric = 0;
  for (let i = 0; i < samples.length; i++) {
    const progress = i / (samples.length - 1);
    const noise = random() * 2 - 1;
    low += (noise - low) * 0.07;
    fabric += (noise - fabric) * (0.22 + progress * 0.16);
    // 닫기는 처음 힘 있게, 열기는 뒤로 갈수록 펼쳐지는 소리. 화면의 cubic easing과 맞춘다.
    let envelope = Math.sin(Math.PI * progress) ** 0.7 * (1.5 - progress);
    if (opening) envelope = Math.sin(Math.PI * progress) ** 0.65 * (0.35 + progress * 1.6);
    const folds = 0.82 + 0.18 * Math.sin(2 * Math.PI * (14 * progress + progress * progress * 5));
    const swish = (fabric - low) * 0.85 + low * 0.35;
    samples[i] = swish * envelope * folds;
  }
  return samples;
}

write('coin-rain', coins(1.12, false), 0.62);
write('coin-rain-tail', coins(0.796, true), 0.54);
write('curtain-close', curtain(false), 0.6);
write('curtain-open', curtain(true), 0.65);
