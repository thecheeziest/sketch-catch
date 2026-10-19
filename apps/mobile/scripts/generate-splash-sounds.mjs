import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 스플래시 로고 효과음: 빠르게 날아드는 바람 소리 + 흔들림에 맞춘 방울 소리. 외부 샘플 없이 합성하고 seed를 고정한다.
const rate = 44100;
const directory = fileURLToPath(new URL('../assets/audio/', import.meta.url));
mkdirSync(directory, { recursive: true });

function writeWave(path, buffer, maxPeak) {
  const pcm = Buffer.alloc(buffer.length * 2);
  let peak = 0;
  for (const value of buffer) peak = Math.max(peak, Math.abs(value));
  const gain = maxPeak / Math.max(peak, 0.001);
  buffer.forEach((value, i) => {
    const edge = Math.min(1, i / (rate * 0.003), (buffer.length - 1 - i) / (rate * 0.012));
    pcm.writeInt16LE(Math.round(value * gain * Math.max(0, edge) * 32767), i * 2);
  });
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  writeFileSync(path, Buffer.concat([header, pcm]));
}

// 대역이 300Hz → 3.2kHz로 올라가는 필터 노이즈 + 상승 글라이드 — 로고가 화면 밖에서 빠르게 들어오는 느낌
function whoosh(duration) {
  const buffer = new Float64Array(Math.round(duration * rate));
  let seed = 424242;
  let low = 0;
  let band = 0;
  let phase = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const t = i / rate;
    const progress = t / duration;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed / 4294967296) * 2 - 1;
    const center = 300 * (3200 / 300) ** Math.min(1, progress * 1.25);
    const f = 2 * Math.sin((Math.PI * center) / rate);
    const high = noise - low - 0.8 * band;
    band += f * high;
    low += f * band;
    phase += (2 * Math.PI * (320 + 1100 * progress ** 1.5)) / rate;
    const envelope = progress < 0.65 ? (progress / 0.65) ** 1.6 : Math.exp(-(progress - 0.65) * 14);
    buffer[i] = (band * 0.9 + Math.sin(phase) * 0.12) * envelope;
  }
  return buffer;
}

// 비조화 배음을 가진 작은 방울. 흔들림 방향이 바뀌는 시점(0·110·240·350·450ms)마다 두 음을 번갈아 친다.
const BELL_PARTIALS = [
  [1, 1, 7],
  [2.0, 0.32, 10],
  [2.76, 0.48, 14],
  [4.07, 0.22, 20],
  [5.4, 0.16, 26],
];
function bell(buffer, start, hz, gain) {
  const first = Math.round(start * rate);
  for (let i = 0; first + i < buffer.length; i += 1) {
    const t = i / rate;
    const attack = Math.min(1, t / 0.0015);
    let value = 0;
    for (const [ratio, amp, decay] of BELL_PARTIALS) {
      value += Math.sin(2 * Math.PI * hz * ratio * t) * amp * Math.exp(-t * decay);
    }
    if (Math.exp(-t * 7) < 0.0005) break;
    buffer[first + i] += value * gain * attack;
  }
}
function jingle(duration) {
  const buffer = new Float64Array(Math.round(duration * rate));
  const hits = [
    [0, 1760, 1],
    [0.11, 2093, 0.85],
    [0.24, 1760, 0.72],
    [0.35, 2093, 0.56],
    [0.45, 1760, 0.42],
  ];
  for (const [start, hz, gain] of hits) {
    bell(buffer, start, hz, gain);
    // 방울 속 구슬이 한 번 더 부딪히는 짤랑임
    bell(buffer, start + 0.014, hz * 1.5 * 1.004, gain * 0.28);
  }
  return buffer;
}

writeWave(join(directory, 'splash-whoosh.wav'), whoosh(0.36), 0.5);
writeWave(join(directory, 'splash-jingle.wav'), jingle(1.0), 0.55);
