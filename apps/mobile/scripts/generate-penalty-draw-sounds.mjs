import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 벌칙 꼴등 추첨 연출 효과음: 스팅·드럼롤·조명 끄기/켜기·좌절·생존 이동. 외부 샘플 없이 합성하고 seed를 고정한다.
const rate = 44100;
const directory = fileURLToPath(new URL('../assets/audio/', import.meta.url));
mkdirSync(directory, { recursive: true });

// 드럼롤 길이 — features/game/config/penaltyDraw.ts의 DRUM_START_MS ~ REVEAL_MS 구간과 맞춘다
const DRUMROLL_SECONDS = 8.1;

function writeWave(path, buffer, maxPeak) {
  const pcm = Buffer.alloc(buffer.length * 2);
  let peak = 0;
  for (const value of buffer) peak = Math.max(peak, Math.abs(value));
  const gain = maxPeak / Math.max(peak, 0.001);
  buffer.forEach((value, i) => {
    const edge = Math.min(1, i / (rate * 0.002), (buffer.length - 1 - i) / (rate * 0.012));
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

let seed = 20261113;
function noiseSample() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return (seed / 4294967296) * 2 - 1;
}

const createBuffer = seconds => new Float64Array(Math.round(seconds * rate));

// state-variable 필터를 거친 노이즈 버스트 (mode: band | high | low), 지수 감쇠
function noise(buffer, start, duration, { mode, center, damping = 0.8, gain, decay }) {
  const first = Math.round(start * rate);
  const f = 2 * Math.sin((Math.PI * Math.min(center, rate / 6)) / rate);
  let low = 0;
  let band = 0;
  for (let i = 0; i < duration * rate && first + i < buffer.length; i += 1) {
    const t = i / rate;
    const input = noiseSample();
    const high = input - low - damping * band;
    band += f * high;
    low += f * band;
    let value = band;
    if (mode === 'high') value = high;
    if (mode === 'low') value = low;
    buffer[first + i] += value * gain * Math.exp(-t * decay);
  }
}

// 주파수 글라이드 + attack/release 엔벨로프 톤. lp가 있으면 1-pole lowpass, vibrato는 Hz 폭
function tone(
  buffer,
  start,
  duration,
  { f0, f1 = f0, wave = 'sine', gain, attack = 0.005, release = 0.06, lp, vibrato = 0 },
) {
  const first = Math.round(start * rate);
  const length = Math.round(duration * rate);
  const alpha = lp ? 1 - Math.exp((-2 * Math.PI * lp) / rate) : 1;
  let phase = 0;
  let filtered = 0;
  for (let i = 0; i < length && first + i < buffer.length; i += 1) {
    const t = i / rate;
    const progress = t / duration;
    const vib = vibrato && t > 0.25 ? Math.sin(2 * Math.PI * 5.5 * t) * vibrato : 0;
    const hz = f0 * (f1 / f0) ** progress + vib;
    phase += (2 * Math.PI * hz) / rate;
    let value = Math.sin(phase);
    if (wave === 'square') value = Math.sin(phase) >= 0 ? 1 : -1;
    if (wave === 'saw') value = ((phase / Math.PI) % 2) - 1;
    filtered += alpha * (value - filtered);
    const envelope = Math.min(1, t / attack, (duration - t) / release);
    buffer[first + i] += filtered * gain * Math.max(0, envelope);
  }
}

const sounds = {
  // 낮은 불협화음 '둥' — 최종 꼴등 뽑기 문구 등장
  'draw-sting': () => {
    const buffer = createBuffer(0.8);
    tone(buffer, 0, 0.78, { f0: 110, wave: 'square', gain: 0.1, lp: 900, release: 0.3 });
    tone(buffer, 0, 0.78, { f0: 116.5, wave: 'square', gain: 0.08, lp: 900, release: 0.3 });
    tone(buffer, 0, 0.5, { f0: 80, f1: 45, gain: 0.5, release: 0.3 });
    return [buffer, 0.55];
  },
  // 두구두구 — 48ms 간격 스네어 롤, 끝으로 갈수록 커진다
  'draw-drumroll': () => {
    const buffer = createBuffer(DRUMROLL_SECONDS);
    let hit = 0;
    for (let t = 0; t < DRUMROLL_SECONDS - 0.05; t += 0.048) {
      const gain = 0.1 + 0.4 * (t / DRUMROLL_SECONDS) ** 1.3;
      noise(buffer, t, 0.07, { mode: 'band', center: 200, gain, decay: 45 });
      if (hit % 2 === 0) tone(buffer, t, 0.07, { f0: 95, f1: 55, gain: gain * 0.7, release: 0.05 });
      hit += 1;
    }
    return [buffer, 0.55];
  },
  // 탁 — 조명 스위치를 끈다
  'light-off': () => {
    const buffer = createBuffer(0.16);
    noise(buffer, 0, 0.05, { mode: 'band', center: 1400, damping: 0.35, gain: 0.8, decay: 90 });
    tone(buffer, 0, 0.14, { f0: 170, f1: 60, gain: 0.55, release: 0.1 });
    return [buffer, 0.6];
  },
  // 탁 — 핀 조명이 켜진다
  spotlight: () => {
    const buffer = createBuffer(0.12);
    noise(buffer, 0, 0.04, { mode: 'high', center: 2200, gain: 0.7, decay: 110 });
    tone(buffer, 0, 0.08, { f0: 260, f1: 120, gain: 0.35, release: 0.06 });
    return [buffer, 0.55];
  },
  // 심벌 크래시 + 좌절 트롬본 '와-와-와-와아~'
  'draw-fail': () => {
    const buffer = createBuffer(3.3);
    noise(buffer, 0, 1.4, { mode: 'high', center: 4000, damping: 1.2, gain: 0.35, decay: 3.2 });
    tone(buffer, 0, 0.6, { f0: 75, f1: 38, gain: 0.7, release: 0.4 });
    const notes = [
      [233.08, 0.38],
      [220, 0.38],
      [207.65, 0.38],
      [196, 1.5],
    ];
    let cursor = 0.35;
    notes.forEach(([hz, length], i) => {
      const last = i === notes.length - 1;
      tone(buffer, cursor, length, {
        f0: hz,
        wave: 'saw',
        gain: 0.16,
        attack: 0.04,
        release: last ? 0.5 : 0.06,
        lp: 1100,
        vibrato: last ? 5 : 0,
      });
      cursor += length;
    });
    return [buffer, 0.55];
  },
  // 조명 ON + 생존 단상으로 점프 — 상승 아르페지오
  'draw-promote': () => {
    const buffer = createBuffer(0.65);
    noise(buffer, 0, 0.04, { mode: 'high', center: 2200, gain: 0.7, decay: 110 });
    tone(buffer, 0, 0.08, { f0: 260, f1: 120, gain: 0.35, release: 0.06 });
    tone(buffer, 0.15, 0.3, { f0: 300, f1: 900, gain: 0.12, release: 0.1 });
    [523.25, 659.25, 783.99, 1046.5].forEach((hz, i) =>
      tone(buffer, 0.15 + i * 0.09, 0.12, { f0: hz, wave: 'square', gain: 0.07, lp: 4000, release: 0.05 }),
    );
    return [buffer, 0.55];
  },
};

for (const [name, render] of Object.entries(sounds)) {
  const [buffer, peak] = render();
  writeWave(join(directory, `${name}.wav`), buffer, peak);
  console.log(`${name}.wav ${(buffer.length / rate).toFixed(2)}s`);
}
