// storage.js — localStorage state, export/import, reset, streak + points.
// All progress lives browser-side. The repo only serves content.

const NS = "eng30:v2:";
const K = {
  progress: NS + "progress",
  streak:   NS + "streak",
  points:   NS + "points",
  settings: NS + "settings",
  mistakes: NS + "mistakes",
};

const DEFAULTS = {
  [K.progress]: {},
  [K.streak]:   { current: 0, longest: 0, lastActiveISO: null, daysDone: [] },
  [K.points]:   { total: 0, byDay: {} },
  [K.settings]: { lang: "en", sound: true, reduceMotion: false, theme: "light", typeAnswers: false },
  [K.mistakes]: {},
};

function read(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : structuredClone(DEFAULTS[key]);
  } catch {
    return structuredClone(DEFAULTS[key]);
  }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  return val;
}

export const getProgress = () => read(K.progress);
export const getStreak   = () => read(K.streak);
export const getPoints   = () => read(K.points);
export const getSettings = () => read(K.settings);
export function setSettings(patch) {
  return write(K.settings, { ...read(K.settings), ...patch });
}

// --- dates (local) ---
export function todayISO(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
export function diffDays(aISO, bISO) {
  const a = new Date(aISO + "T00:00:00Z");
  const b = new Date(bISO + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}
export function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// --- session results ---
export function setSessionResult(id, { correct, total, timeMs = null }) {
  const p = read(K.progress);
  const prev = p[id] || { done: false, correct: 0, total: 0, best: 0, attempts: 0, lastAt: null, bestTimeMs: null };
  p[id] = {
    done: true,
    correct,
    total,
    best: Math.max(prev.best || 0, correct),
    attempts: (prev.attempts || 0) + 1,
    lastAt: new Date().toISOString(),
    bestTimeMs: timeMs != null ? (prev.bestTimeMs ? Math.min(prev.bestTimeMs, timeMs) : timeMs) : prev.bestTimeMs,
  };
  write(K.progress, p);
  return p[id];
}

// --- mistake bank (spaced review) ---
export const getMistakes = () => read(K.mistakes);
export function upsertMistake(itemId, patch) {
  const m = read(K.mistakes);
  m[itemId] = { ...(m[itemId] || {}), ...patch };
  write(K.mistakes, m);
  return m[itemId];
}
export function deleteMistake(itemId) {
  const m = read(K.mistakes);
  if (!(itemId in m)) return;
  delete m[itemId];
  write(K.mistakes, m);
}

export function addPoints(day, amount) {
  const pt = read(K.points);
  pt.total = (pt.total || 0) + amount;
  pt.byDay[day] = (pt.byDay[day] || 0) + amount;
  return write(K.points, pt);
}

export function markActiveToday() {
  const s = read(K.streak);
  const t = todayISO();
  if (s.lastActiveISO === t) return s;
  if (!s.lastActiveISO) {
    s.current = 1;
  } else {
    const d = diffDays(s.lastActiveISO, t);
    s.current = d === 1 ? (s.current || 0) + 1 : 1;
  }
  s.longest = Math.max(s.longest || 0, s.current);
  s.lastActiveISO = t;
  return write(K.streak, s);
}

export function markDayDoneIfComplete(day, sessionIdsOfDay) {
  const p = read(K.progress);
  const allDone = sessionIdsOfDay.every((id) => p[id] && p[id].done);
  if (!allDone) return read(K.streak);
  const s = read(K.streak);
  if (!s.daysDone.includes(day)) {
    s.daysDone.push(day);
    s.daysDone.sort((a, b) => a - b);
    write(K.streak, s);
  }
  return read(K.streak);
}

// --- backup ---
export function exportAll() {
  return {
    app: "english30",
    schema: "2.0",
    exportedAt: new Date().toISOString(),
    data: {
      progress: read(K.progress),
      streak: read(K.streak),
      points: read(K.points),
      settings: read(K.settings),
      mistakes: read(K.mistakes),
    },
  };
}
export function importAll(obj) {
  const d = obj && obj.data ? obj.data : obj;
  if (!d || typeof d !== "object") throw new Error("Invalid backup file");
  if (d.progress) write(K.progress, d.progress);
  if (d.streak)   write(K.streak, d.streak);
  if (d.points)   write(K.points, d.points);
  if (d.settings) write(K.settings, d.settings);
  if (d.mistakes) write(K.mistakes, d.mistakes);
}
export function resetAll() {
  Object.values(K).forEach((k) => localStorage.removeItem(k));
}
