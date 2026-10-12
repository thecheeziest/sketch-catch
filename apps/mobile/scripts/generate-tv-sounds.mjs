import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 외부 샘플 없이 합성한 CRT 전원 효과음. seed를 고정해 재생성 결과도 동일하다.
const sampleRate = 44100;
const directory = fileURLToPath(new URL('../assets/audio/', import.meta.url));
mkdirSync(directory, { recursive: true });

function makeSound(kind, duration) {
  const count = Math.round(sampleRate * duration);
  const samples = new Float64Array(count);
  let seed = 1234567;
  let phase = 0;
  let lowNoise = 0;
  for (let i = 0; i < count; i += 1) {
    const t = i / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed / 4294967296) * 2 - 1;
    lowNoise += (noise - lowNoise) * 0.14;
    const opening = kind === 'on';
    const progress = Math.min(1, t / (opening ? 0.29 : 0.22));
    let frequency = 1050 - 860 * progress;
    if (opening) frequency = 220 + 1000 * progress;
    phase += (2 * Math.PI * frequency) / sampleRate;
    const envelope = Math.sin(Math.PI * Math.min(1, t / duration)) ** 1.4;
    const tone = Math.sin(phase) + 0.16 * Math.sin(phase * 2);
    const clickTime = opening ? 0.005 : 0.16;
    const clickAge = t - clickTime;
    let click = 0;
    if (clickAge >= 0 && clickAge < 0.028) {
      click = (0.3 * noise + 0.5 * Math.sin(2 * Math.PI * 130 * clickAge)) * Math.exp(-clickAge * 180);
    }
    const hum = Math.sin(2 * Math.PI * 60 * t) * 0.018;
    const fade = Math.min(1, t / 0.003, (duration - t) / 0.008);
    samples[i] = (0.13 * tone * envelope + 0.035 * lowNoise * envelope + click + hum * envelope) * fade;
  }
  const pcm = Buffer.alloc(count * 2);
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  const gain = 0.55 / peak;
  samples.forEach((value, i) => pcm.writeInt16LE(Math.round(value * gain * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  writeFileSync(`${directory}tv-${kind}.wav`, Buffer.concat([header, pcm]));
}

makeSound('on', 0.34);
makeSound('off', 0.24);
