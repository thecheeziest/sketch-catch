import tvOn from '@assets/audio/tv-on.wav';
import tvOff from '@assets/audio/tv-off.wav';
import tap from '@assets/audio/tap.wav';
import select from '@assets/audio/select.wav';
import confirm from '@assets/audio/confirm.wav';
import cancel from '@assets/audio/cancel.wav';
import warning from '@assets/audio/warning.wav';
import notify from '@assets/audio/notify.wav';
import match from '@assets/audio/match.wav';
import round from '@assets/audio/round.wav';
import correct from '@assets/audio/correct.wav';
import wrong from '@assets/audio/wrong.wav';
import gameover from '@assets/audio/gameover.wav';
import fanfare from '@assets/audio/fanfare.wav';
import splashWhoosh from '@assets/audio/splash-whoosh.wav';
import splashJingle from '@assets/audio/splash-jingle.wav';
import home from '@assets/audio/bgm-home.m4a';
import lobby from '@assets/audio/bgm-lobby.m4a';
import classic from '@assets/audio/bgm-classic.m4a';
import relay from '@assets/audio/bgm-relay.m4a';
import review from '@assets/audio/bgm-review.m4a';
import award from '@assets/audio/bgm-award.m4a';

export const soundSources = {
  tvOn,
  tvOff,
  tap,
  select,
  confirm,
  cancel,
  warning,
  notify,
  match,
  round,
  correct,
  wrong,
  gameover,
  fanfare,
  splashWhoosh,
  splashJingle,
};
export const musicSources = { home, lobby, classic, relay, review, award };
export type MusicScene = keyof typeof musicSources;
type Haptic = 'light' | 'soft' | 'selection' | 'success' | 'error' | 'warning' | 'heavy' | 'tvOn' | 'tvOff';
type FeedbackDefinition = {
  sound: keyof typeof soundSources;
  channel: 'ui' | 'game' | 'tv';
  priority: number;
  duration: number;
  haptic?: Haptic;
  hapticDelay?: number;
  volume?: number;
};

const durations = {
  tvOn: 340,
  tvOff: 240,
  tap: 60,
  select: 70,
  confirm: 280,
  cancel: 180,
  warning: 300,
  notify: 230,
  match: 650,
  round: 450,
  correct: 750,
  wrong: 260,
  gameover: 800,
  fanfare: 1600,
  splashWhoosh: 360,
  splashJingle: 1000,
};
const ui = (sound: keyof typeof soundSources, haptic: Haptic = 'light'): FeedbackDefinition => ({
  sound,
  channel: 'ui',
  priority: 1,
  duration: durations[sound],
  haptic,
});
const cue = (
  sound: keyof typeof soundSources,
  duration: number,
  haptic?: Haptic,
  priority = 3,
): FeedbackDefinition => ({ sound, channel: 'game', priority, duration, haptic });
const action = (sound: keyof typeof soundSources, haptic: Haptic = 'light'): FeedbackDefinition => ({
  ...ui(sound, haptic),
  priority: 2,
});

export const feedbackDefinitions = {
  tap: ui('tap'),
  select: ui('select', 'selection'),
  cancel: ui('cancel', 'soft'),
  tool: ui('select', 'selection'),
  undo: ui('cancel'),
  clear: ui('warning'),
  fill: action('confirm', 'soft'),
  send: action('select'),
  submit: action('confirm'),
  confirm: cue('confirm', 280, 'success'),
  warning: cue('warning', 300, 'warning', 8),
  notify: cue('notify', 230),
  splashWhoosh: cue('splashWhoosh', 360),
  splashJingle: cue('splashJingle', 1000, 'light'),
  matchStart: cue('round', 450, 'light'),
  matchFound: cue('match', 650, 'success', 5),
  matchCancel: ui('cancel', 'soft'),
  playerJoin: cue('notify', 230),
  playerLeave: cue('cancel', 180),
  ready: action('confirm'),
  unready: action('cancel'),
  gameStart: cue('round', 450, 'light', 5),
  roundStart: cue('round', 450, 'light', 5),
  drawer: cue('notify', 230, 'light'),
  promptRequest: cue('notify', 230, 'light'),
  promptSubmit: action('confirm'),
  tick: { ...cue('select', 80), volume: 0.4 },
  correct: cue('correct', 750, 'success', 10),
  otherCorrect: { ...cue('correct', 750, undefined, 10), volume: 0.45 },
  drawerCorrect: cue('correct', 750, 'success', 10),
  wrong: cue('wrong', 260, 'error', 6),
  gameover: cue('gameover', 800, 'warning', 10),
  stepStart: cue('round', 450, 'light', 5),
  frame: { ...cue('select', 80), volume: 0.5 },
  bestReveal: cue('fanfare', 1600, 'success', 10),
  awardEnter: cue('round', 450, 'heavy', 8),
  podiumWinner: cue('fanfare', 1600, 'heavy', 10),
  podiumOther: cue('confirm', 280),
  cheer: { ...cue('notify', 230), volume: 0.35 },
  tvOn: { sound: 'tvOn', channel: 'tv', priority: 5, duration: 340, haptic: 'tvOn', hapticDelay: 90 },
  tvOff: { sound: 'tvOff', channel: 'tv', priority: 5, duration: 240, haptic: 'tvOff', hapticDelay: 160 },
} satisfies Record<string, FeedbackDefinition>;

export type FeedbackName = keyof typeof feedbackDefinitions;
export function getFeedbackDefinition(name: FeedbackName): FeedbackDefinition {
  return feedbackDefinitions[name];
}
