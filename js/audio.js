// audio.js — speech playback for target sentences.
// Uses the browser's own speech engine: no key, no network, works on GitHub Pages.

import { getSettings, patchSettings } from "./store.js";

const synth = window.speechSynthesis;
export const supported = typeof synth !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";

let voices = [];
let current = null;

/** Voices load asynchronously in most browsers, so resolve on the event too. */
export function loadVoices() {
  if (!supported) return Promise.resolve([]);
  const grab = () => synth.getVoices().filter((v) => /^en(-|_|$)/i.test(v.lang));
  voices = grab();
  if (voices.length) return Promise.resolve(voices);
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      voices = grab();
      resolve(voices);
    };
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1200); // Safari sometimes never fires the event
  });
}

export const listVoices = () => voices;

// Naturalness heuristic. Neural/premium voices carry these markers across platforms;
// anything unranked still plays, it just sorts last.
const MARKERS = [
  [/natural|neural|premium|enhanced|siri/i, 60],
  [/google/i, 45],
  [/samantha|serena|allison|ava|zoe|evan|nathan|aria|jenny|guy/i, 30],
  [/microsoft/i, 12],
  [/en-us/i, 8],
  [/en-gb/i, 6],
];

function score(v) {
  const hay = `${v.name} ${v.voiceURI} ${v.lang}`;
  let n = MARKERS.reduce((acc, [re, pts]) => acc + (re.test(hay) ? pts : 0), 0);
  if (v.localService) n += 4;      // no network hitch mid-drill
  if (/compact|eloquence/i.test(hay)) n -= 40;
  return n;
}

export function rankedVoices() {
  return [...voices].sort((a, b) => score(b) - score(a));
}

/** Honours the saved choice, otherwise picks the best-sounding voice available. */
export function pickVoice() {
  if (!voices.length) return null;
  const saved = getSettings().voiceURI;
  if (saved) {
    const hit = voices.find((v) => v.voiceURI === saved);
    if (hit) return hit;
  }
  return rankedVoices()[0] || null;
}

export function setVoice(voiceURI) { patchSettings({ voiceURI }); }

export function stop() {
  if (!supported) return;
  try { synth.cancel(); } catch { /* already idle */ }
  current = null;
}

/**
 * Speaks `text`. onBoundary(charIndex, charLength) drives the karaoke highlight where
 * the browser reports word boundaries (Chrome desktop, Edge); elsewhere it simply
 * never fires and the sentence plays without highlighting.
 */
export function speak(text, { rate, onBoundary, onEnd, onStart } = {}) {
  if (!supported || !text) { onEnd?.(); return () => {}; }
  stop();

  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) { u.voice = v; u.lang = v.lang; }
  u.rate = rate ?? getSettings().rate ?? 1;
  u.pitch = 1;

  u.onstart = () => onStart?.();
  u.onboundary = (e) => {
    if (e.name && e.name !== "word") return;
    onBoundary?.(e.charIndex, e.charLength || 0);
  };
  u.onend = () => { current = null; onEnd?.(); };
  u.onerror = () => { current = null; onEnd?.(); };

  current = u;
  // Chrome drops utterances queued too soon after cancel().
  setTimeout(() => { if (current === u) synth.speak(u); }, 30);

  return stop;
}

export const speaking = () => supported && synth.speaking;
