// store.js — localStorage for Replay (v3).
// Namespaced eng30:v3:* so the archived grammar app's eng30:v2:* keys are untouched.

const NS = "eng30:v3:";
const K = {
  stats: NS + "stats",       // { reps, points, sets: { "000": {best, plays, reps, at} } }
  streak: NS + "streak",     // { current, longest, lastActiveISO, days: [] }
  settings: NS + "settings",
  mistakes: NS + "mistakes", // { itemId: { setId, misses, due, at } }
};

const DEFAULTS = {
  [K.stats]: { reps: 0, points: 0, sets: {} },
  [K.streak]: { current: 0, longest: 0, lastActiveISO: null, days: [] },
  [K.settings]: {
    theme: "light",
    bnMode: "always",   // "always" | "challenge"
    rate: 1,
    voiceURI: "",
    sound: true,
    motion: "on",
  },
  [K.mistakes]: {},
};

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(DEFAULTS[key]);
    return { ...structuredClone(DEFAULTS[key]), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULTS[key]);
  }
}

function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota / private mode */ }
  return val;
}

export const getStats = () => read(K.stats);
export const getStreak = () => read(K.streak);
export const getSettings = () => read(K.settings);
export const getMistakes = () => read(K.mistakes);

export function patchSettings(patch) {
  return write(K.settings, { ...read(K.settings), ...patch });
}

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Records a finished set: adds reps + points, updates per-set bests and the streak. */
export function recordSet(setId, { reps, points, accuracy }) {
  const stats = read(K.stats);
  stats.reps += reps;
  stats.points += points;
  const prev = stats.sets[setId] || { best: 0, plays: 0, reps: 0 };
  stats.sets[setId] = {
    best: Math.max(prev.best, points),
    plays: prev.plays + 1,
    reps: prev.reps + reps,
    accuracy,
    at: new Date().toISOString(),
  };
  write(K.stats, stats);
  return { stats, streak: touchStreak() };
}

/** Adds today to the streak. Same day twice is a no-op; a gap resets to 1. */
export function touchStreak() {
  const s = read(K.streak);
  const today = dayKey();
  if (s.days.includes(today)) return s;

  const yesterday = dayKey(new Date(Date.now() - 864e5));
  s.current = s.days.includes(yesterday) ? s.current + 1 : 1;
  s.longest = Math.max(s.longest, s.current);
  s.lastActiveISO = new Date().toISOString();
  s.days = [...s.days, today].slice(-400);
  return write(K.streak, s);
}

/** True if a set was already finished today — drives the home screen's "done" badge. */
export function playedToday() {
  return read(K.streak).days.includes(dayKey());
}

/** Cards you fumbled come back later via the mistake bank. */
export function logMiss(itemId, setId) {
  const m = read(K.mistakes);
  const rec = m[itemId] || { setId, misses: 0 };
  rec.misses += 1;
  rec.setId = setId;
  rec.due = new Date(Date.now() + (rec.misses > 2 ? 1 : 2) * 864e5).toISOString();
  rec.at = new Date().toISOString();
  m[itemId] = rec;
  return write(K.mistakes, m);
}

export function clearMiss(itemId) {
  const m = read(K.mistakes);
  if (m[itemId]) { delete m[itemId]; write(K.mistakes, m); }
}

export function dueMistakes() {
  const m = read(K.mistakes);
  const now = Date.now();
  return Object.entries(m)
    .filter(([, r]) => !r.due || Date.parse(r.due) <= now)
    .map(([itemId, r]) => ({ itemId, ...r }));
}

export function exportAll() {
  return {
    app: "replay",
    version: 3,
    exportedAt: new Date().toISOString(),
    stats: read(K.stats),
    streak: read(K.streak),
    settings: read(K.settings),
    mistakes: read(K.mistakes),
  };
}

export function importAll(data) {
  if (!data || typeof data !== "object") throw new Error("ফাইলটা পড়া গেল না");
  if (data.stats) write(K.stats, data.stats);
  if (data.streak) write(K.streak, data.streak);
  if (data.settings) write(K.settings, data.settings);
  if (data.mistakes) write(K.mistakes, data.mistakes);
}

export function resetAll() {
  Object.values(K).forEach((k) => localStorage.removeItem(k));
}
