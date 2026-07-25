// srs.js — mistake bank scheduling (Leitner-style) + weak-pattern weighting.
// Pure logic: depends only on curriculum.js + storage.js (no engine.js, to avoid a cycle).

import { getDay } from "./curriculum.js";
import * as store from "./storage.js";

export const INTERVALS_DAYS = [1, 3, 7, 16]; // box 0..3 → days until due after a correct review
export const MAX_BOX = INTERVALS_DAYS.length; // box >= MAX_BOX → retired (stops resurfacing)
const REVIEW_SIZE = 10;

function dayFromItemId(id) {
  const m = /^d(\d{2})s/.exec(id);
  return m ? Number(m[1]) : null;
}

// Called from engine.js after every answered (non-skipped) item, in any session type.
export function recordItemResult(item, ok) {
  const day = item._day ?? dayFromItemId(item.id);
  const meta = getDay(day);
  const existing = store.getMistakes()[item.id];

  if (!ok) {
    store.upsertMistake(item.id, {
      itemId: item.id,
      day,
      pillar: meta?.pillar,
      theme: meta?.theme,
      itemType: item.type,
      box: 0,
      dueISO: store.addDays(store.todayISO(), 1),
      missCount: (existing?.missCount || 0) + 1,
      reviewCount: existing?.reviewCount || 0,
      lastResult: "wrong",
      lastAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
      retired: false,
    });
    return;
  }

  if (existing) {
    const nextBox = (existing.box ?? 0) + 1;
    const retired = nextBox >= MAX_BOX;
    store.upsertMistake(item.id, {
      box: nextBox,
      dueISO: retired ? null : store.addDays(store.todayISO(), INTERVALS_DAYS[nextBox]),
      reviewCount: (existing.reviewCount || 0) + 1,
      lastResult: "correct",
      lastAt: new Date().toISOString(),
      retired,
    });
  }
  // ok && !existing → item was never missed → not mistake-bank material, no-op.
}

export function dueMistakes() {
  const today = store.todayISO();
  return Object.values(store.getMistakes()).filter(
    (m) => !m.retired && m.dueISO && m.dueISO <= today
  );
}

export function countDue() {
  return dueMistakes().length;
}

// All-time miss frequency per origin day, used to weight review selection toward
// the patterns the user actually struggles with (not just what's overdue).
export function patternWeights() {
  const weights = {};
  Object.values(store.getMistakes()).forEach((m) => {
    weights[m.day] = (weights[m.day] || 0) + (m.missCount || 1);
  });
  return weights;
}

// Per-day weakness score, used to bias interleaved practice toward the patterns
// still costing you errors. Retired (mastered) items barely count — that is the
// adaptive part: what you've proven you know stops eating practice time.
export function dayWeights() {
  const w = {};
  Object.values(store.getMistakes()).forEach((m) => {
    const inc = m.retired ? 0.25 : (m.missCount || 1) * 2;
    w[m.day] = (w[m.day] || 0) + inc;
  });
  return w;
}

// How many patterns you've fully mastered — real evidence of progress, unlike XP.
export function masteryStats() {
  const all = Object.values(store.getMistakes());
  return {
    retired: all.filter((m) => m.retired).length,
    active: all.filter((m) => !m.retired).length,
    tracked: all.length,
  };
}

// Weighted pick without replacement.
export function weightedPick(candidates, count, weightOf) {
  const pool = candidates.slice();
  const out = [];
  while (pool.length && out.length < count) {
    const weights = pool.map(weightOf);
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    let idx = weights.findIndex((w) => (r -= w) <= 0);
    if (idx < 0) idx = pool.length - 1;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export function pickReviewCandidates(limit = REVIEW_SIZE) {
  const due = dueMistakes();
  if (!due.length) return [];
  const weights = patternWeights();
  const today = store.todayISO();
  return due
    .map((m) => ({
      m,
      score:
        Math.max(0, store.diffDays(m.dueISO, today)) * 3 + // overdue-ness
        (weights[m.day] || 1) * 2 + // pattern weakness
        Math.random() * 1.5, // jitter so the set varies between reviews
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.m);
}
