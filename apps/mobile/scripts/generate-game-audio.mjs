import { mkdirSync, mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 프로젝트 전용 오리지널 chiptune: 외부 샘플 없이 melody/bass/arpeggio/drums를 합성한다.
const rate = 44100;
const directory = fileURLToPath(new URL('../assets/audio/', import.meta.url));
mkdirSync(directory, { recursive: true });
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
const triangle = phase => (2 / Math.PI) * Math.asin(Math.sin(phase));
function note(buffer, start, duration, midi, gain, voice = 'lead') {
  const hz = frequency(midi);
  const first = Math.round(start * rate);
  const length = Math.round(duration * rate);
  for (let i = 0; i < length && first + i < buffer.length; i += 1) {
    const t = i / rate;
    const envelope = Math.min(1, t / 0.006, (duration - t) / 0.035) * Math.exp(-t * 1.3);
    const phase = 2 * Math.PI * hz * t;
    let wave = triangle(phase);
    if (voice === 'lead') wave = Math.sin(phase) * 0.7 + Math.sin(phase * 2) * 0.15 + triangle(phase) * 0.15;
    buffer[first + i] += wave * gain * Math.max(0, envelope);
  }
}
function drum(buffer, start, kind, gain) {
  const first = Math.round(start * rate);
  const duration = kind === 'kick' ? 0.16 : 0.09;
  let seed = first + 123;
  for (let i = 0; i < duration * rate && first + i < buffer.length; i += 1) {
    const t = i / rate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    let wave = (seed / 4294967296) * 2 - 1;
    if (kind === 'kick') wave = Math.sin(2 * Math.PI * (68 * t + (60 * (1 - Math.exp(-t * 35))) / 35));
    buffer[first + i] += wave * gain * Math.exp(-t * (kind === 'kick' ? 28 : 65));
  }
}
function writeWave(path, buffer, maxPeak) {
  const pcm = Buffer.alloc(buffer.length * 2);
  let peak = 0;
  for (const value of buffer) peak = Math.max(peak, Math.abs(value));
  const gain = maxPeak / Math.max(peak, 0.001);
  buffer.forEach((value, i) => {
    const edge = Math.min(1, i / (rate * 0.008), (buffer.length - 1 - i) / (rate * 0.012));
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

const effects = {
  tap: [0.06, [76]],
  select: [0.07, [83]],
  confirm: [0.28, [72, 76, 79]],
  cancel: [0.18, [72, 65]],
  warning: [0.3, [62, 62]],
  notify: [0.23, [79, 84]],
  match: [0.65, [67, 72, 76, 79, 84]],
  round: [0.45, [60, 67, 72, 79]],
  correct: [0.75, [72, 76, 79, 84, 88]],
  wrong: [0.26, [58, 56]],
  gameover: [0.8, [67, 63, 60, 55]],
  fanfare: [1.6, [60, 64, 67, 72, 67, 72, 76, 79]],
};
for (const [name, [duration, notes]] of Object.entries(effects)) {
  const buffer = new Float64Array(Math.round(duration * rate));
  notes.forEach((midi, i) =>
    note(buffer, (i * duration * 0.75) / notes.length, (duration / notes.length) * 1.35, midi, 0.18),
  );
  if (name === 'fanfare' || name === 'round') drum(buffer, 0, 'kick', 0.1);
  writeWave(join(directory, `${name}.wav`), buffer, 0.55);
}

const themes = {
  home: {
    bpm: 104,
    root: 60,
    chords: [0, 7, 9, 5, 0, 4, 5, 7],
    melody: [0, 4, 7, 12, 9, 7, 4, 2, 4, 7, 9, 12, 7, 4, 2, 0],
  },
  lobby: {
    bpm: 92,
    root: 62,
    chords: [0, 5, 7, 0, 9, 5, 2, 7],
    melody: [7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 7, 12, 9, 7, 4, 2],
  },
  classic: {
    bpm: 120,
    root: 57,
    chords: [0, 5, 3, 7, 0, 3, 5, 7],
    melody: [0, 7, 3, 10, 7, 5, 3, 7, 0, 3, 7, 12, 10, 7, 5, 3],
    minor: true,
  },
  relay: {
    bpm: 108,
    root: 65,
    chords: [0, 9, 5, 7, 0, 5, 2, 7],
    melody: [0, 2, 4, 7, 4, 2, 9, 7, 4, 7, 12, 9, 7, 4, 2, 4],
  },
  review: {
    bpm: 88,
    root: 67,
    chords: [0, 4, 5, 0, 9, 5, 7, 0],
    melody: [4, 7, 12, 7, 9, 7, 4, 2, 0, 4, 7, 9, 7, 4, 2, 0],
  },
  award: {
    bpm: 112,
    root: 60,
    chords: [0, 5, 0, 7, 9, 5, 7, 0],
    melody: [7, 7, 12, 12, 16, 14, 12, 7, 9, 12, 16, 19, 16, 12, 7, 12],
  },
};
const temporary = mkdtempSync(join(tmpdir(), 'sketch-catch-audio-'));
for (const [name, theme] of Object.entries(themes)) {
  const beat = 60 / theme.bpm;
  const duration = beat * 4 * 16;
  const buffer = new Float64Array(Math.round(duration * rate));
  for (let bar = 0; bar < 16; bar += 1) {
    const chord = theme.chords[bar % 8];
    const base = bar * 4 * beat;
    let third = [2, 4, 9].includes(chord) ? 3 : 4;
    if (theme.minor) third = [3, 8, 10].includes(chord) ? 4 : 3;
    for (let step = 0; step < 8; step += 1) {
      const when = base + (step * beat) / 2;
      const melody = theme.melody[(bar * 4 + step) % theme.melody.length];
      const variation = bar >= 8 && step % 3 === 0 ? 12 : 0;
      note(buffer, when, beat * 0.43, theme.root + 12 + melody + variation, 0.085);
      note(buffer, when, beat * 0.3, theme.root + chord + [0, third, 7, 12][step % 4], 0.035, 'arp');
      drum(buffer, when, 'hat', 0.022);
    }
    for (let step = 0; step < 4; step += 1) {
      note(buffer, base + step * beat, beat * 0.72, theme.root - 12 + chord + (step % 2 ? 7 : 0), 0.12, 'bass');
      drum(buffer, base + step * beat, step % 2 ? 'snare' : 'kick', 0.07);
    }
  }
  const wave = join(temporary, `${name}.wav`);
  writeWave(wave, buffer, 0.6);
  const result = spawnSync(
    '/usr/bin/afconvert',
    [wave, join(directory, `bgm-${name}.m4a`), '-f', 'm4af', '-d', 'aac ', '-b', '64000'],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(result.stderr || 'afconvert failed');
  unlinkSync(wave);
}
rmdirSync(temporary);
