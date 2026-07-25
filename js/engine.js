// engine.js — content loading + session player (scoring, combo, streak, persist).

import { pad } from "./curriculum.js";
import { renderItem, h, beep, shuffle } from "./render.js";
import * as store from "./storage.js";
import * as srs from "./srs.js";

const cache = new Map();

export function contentURL(day) { return `content/day-${pad(day)}.json`; }

export async function fetchDay(day) {
  if (cache.has(day)) return cache.get(day);
  const res = await fetch(contentURL(day), { cache: "no-cache" });
  if (!res.ok) throw new Error("not found");
  const json = await res.json();
  cache.set(day, json);
  return json;
}

// Probe which day files exist (no manifest). Append-only content "just works".
export async function probeAvailableDays() {
  const checks = [];
  for (let d = 1; d <= 30; d++) {
    checks.push(
      fetch(contentURL(d), { method: "HEAD" }).then((r) => (r.ok ? d : null)).catch(() => null)
    );
  }
  const res = await Promise.all(checks);
  return new Set(res.filter(Boolean));
}

// Assembles a "Quick Review" session from due mistake-bank items, pulling the live
// item content from its source day JSON (via the same fetchDay cache) rather than
// duplicating content into the mistake record.
export async function buildReviewSession(limit = 10) {
  const candidates = srs.pickReviewCandidates(limit);
  if (!candidates.length) return null;

  const byDay = new Map();
  candidates.forEach((c) => {
    if (!byDay.has(c.day)) byDay.set(c.day, []);
    byDay.get(c.day).push(c);
  });

  const items = [];
  for (const [day, recs] of byDay) {
    let content;
    try {
      content = await fetchDay(day);
    } catch {
      continue; // day file unreachable — skip, don't abort the whole review
    }
    const allItems = (content.sessions || []).flatMap((s) => s.items || []);
    recs.forEach((rec) => {
      const found = allItems.find((it) => it.id === rec.itemId);
      if (found) items.push({ ...found, _day: day });
      else store.deleteMistake(rec.itemId); // stale record — item no longer exists in content
    });
  }
  if (!items.length) return null;

  return { id: "review", title: "Quick Review", type: "mixed", isReview: true, items: shuffle(items) };
}

// Pulls a few items from EARLIER days into a session. Interleaving is what forces
// real discrimination: without it you know the answer involves the day's rule
// before you read the sentence. Biased toward days you still get wrong.
export async function interleavedItems(dayNum, available, count = 3) {
  if (dayNum <= 1 || count <= 0) return [];
  // An empty set means the availability probe hasn't finished (e.g. deep-link or
  // refresh straight into a session) — fall back to "no filter" rather than
  // silently dropping every prior day. fetchDay below skips anything missing.
  const filter = available && available.size ? available : null;
  const prior = [];
  for (let d = 1; d < dayNum; d++) if (!filter || filter.has(d)) prior.push(d);
  if (!prior.length) return [];

  const weights = srs.dayWeights();
  const days = srs.weightedPick(prior, count, (d) => 1 + (weights[d] || 0));
  const seen = new Set();
  const out = [];
  for (const d of days) {
    let content;
    try { content = await fetchDay(d); } catch { continue; }
    const all = (content.sessions || []).flatMap((s) => s.items || []);
    const pick = shuffle(all).find((it) => it && it.id && !seen.has(it.id));
    if (!pick) continue;
    seen.add(pick.id);
    out.push({ ...pick, _day: d, _interleaved: true });
  }
  return out;
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// Drives one full session inside `mount`.
export async function playSession({ mount, day, session, sessionIdsOfDay, onExit, onNavigate }) {
  const items = session.items || [];
  const n = items.length;
  const limitMs = session.limitMs || null;        // speed round: countdown, ends at 0
  const maxMistakes = session.maxMistakes || null; // survival: N strikes and it's over
  const timed = session.type === "mixed" || !!limitMs;
  let i = 0, correct = 0, combo = 0, maxCombo = 0, points = 0;
  let attempted = 0, wrongs = 0, finished = false;
  const startTs = performance.now();
  const reduce = store.getSettings().reduceMotion;

  const root = h("div", { class: "play" });
  const back = h("button", { class: "icon-btn", type: "button", onClick: onExit, html: "&larr;" });
  const title = h("div", { class: "play-title" }, session.title);
  const prog = h("div", { class: "play-prog mono" });
  root.append(h("div", { class: "play-top" }, back, title, prog));

  const bar = h("div", { class: "play-bar" });
  const fill = h("div", { class: "play-bar-fill" });
  bar.append(fill);
  root.append(bar);

  const comboEl = h("span", { class: "combo mono" });
  const timerEl = h("span", { class: "timer mono" });
  root.append(h("div", { class: "play-meta" }, comboEl, timed ? timerEl : null));

  if (session.rule && !timed) {
    const lang = store.getSettings().lang;
    const wantBn = lang === "bn" || lang === "both";
    const ruleCard = h("div", { class: "rule-card" }, h("span", { class: "rule-tag" }, "Rule"), h("span", {}, session.rule));
    if (session.rule_bn && wantBn) ruleCard.append(h("span", { class: "rule-bn bn" }, session.rule_bn));
    root.append(ruleCard);
  }

  const stage = h("div", { class: "stage" });
  const nav = h("div", { class: "play-nav" });
  root.append(stage, nav);
  mount.replaceChildren(root);

  let timer;
  if (timed) {
    timer = setInterval(() => {
      const elapsed = performance.now() - startTs;
      if (!limitMs) { timerEl.textContent = fmtTime(elapsed); return; }
      const left = Math.max(0, limitMs - elapsed);
      timerEl.textContent = fmtTime(left);
      timerEl.classList.toggle("urgent", left <= 10000);
      if (left <= 0) finish("time");
    }, 200);
  }

  const livesEl = h("span", { class: "lives mono" });
  function setLives() {
    if (!maxMistakes) return;
    livesEl.textContent = "♥".repeat(Math.max(0, maxMistakes - wrongs));
  }
  if (maxMistakes) { root.querySelector(".play-meta").append(livesEl); setLives(); }

  function setCombo() {
    comboEl.textContent = combo > 1 ? `combo ×${combo}` : "";
    comboEl.classList.toggle("flare", combo > 1);
  }

  function flashGain(gain) {
    const g = h("div", { class: "gain mono" }, `+${gain}`);
    stage.append(g);
    setTimeout(() => g.remove(), 900);
  }

  function showItem() {
    prog.textContent = `${i + 1} / ${n}`;
    fill.style.width = `${(i / n) * 100}%`;
    stage.replaceChildren();
    nav.replaceChildren();
    setCombo();
    let answered = false;

    const el = renderItem(items[i], (ok, skipped) => {
      if (answered) return;
      answered = true;
      if (!skipped) {
        srs.recordItemResult(items[i], ok);
        attempted += 1;
        if (!ok) { wrongs += 1; setLives(); }
        if (ok) {
          combo += 1;
          maxCombo = Math.max(maxCombo, combo);
          const gain = 10 + Math.min(combo - 1, 9) * 5;
          points += gain;
          correct += 1;
          store.addPoints(items[i]._day ?? day.day, gain);
          stage.classList.add("good");
          flashGain(gain);
          beep(true);
        } else {
          combo = 0;
          stage.classList.add("bad");
          beep(false);
        }
        setCombo();
        setTimeout(() => stage.classList.remove("good", "bad"), 600);
      }
      if (maxMistakes && wrongs >= maxMistakes) {
        const out = h("button", { class: "btn primary", type: "button", onClick: () => finish("strikes") }, "See result");
        nav.append(out);
        out.focus();
        return;
      }
      const last = i === n - 1;
      const next = h("button", { class: "btn primary", type: "button", onClick: advance }, last ? "Finish" : "Next");
      nav.append(next);
      next.focus();
    });

    stage.append(el);
    if (!reduce) requestAnimationFrame(() => el.classList.add("in"));
  }

  function advance() { if (i < n - 1) { i += 1; showItem(); } else finish("done"); }

  function finish(reason = "done") {
    if (finished) return;
    finished = true;
    if (timer) clearInterval(timer);
    fill.style.width = "100%";
    const timeMs = timed ? Math.round(performance.now() - startTs) : null;
    // A session that ended early is scored on what was actually attempted.
    const total = reason === "done" ? n : Math.max(attempted, 1);
    store.setSessionResult(session.id, { correct, total, timeMs });
    store.markActiveToday();
    if (!session.isReview) store.markDayDoneIfComplete(day.day, sessionIdsOfDay);
    celebrate({ mount, day, session, correct, n: total, points, maxCombo, timeMs, onNavigate, reduce, reason });
  }

  showItem();
}

function celebrate({ mount, day, session, correct, n, points, maxCombo, timeMs, onNavigate, reduce, reason }) {
  const root = h("div", { class: "celebrate" });
  const TITLES = { time: "Time's up!", strikes: "Out of lives!" };
  root.append(h("div", { class: "cele-check" }, reason === "strikes" ? "✗" : "✓"));
  root.append(h("h2", { class: "cele-title" }, TITLES[reason] || (correct === n ? "Flawless!" : "Session complete")));
  root.append(h("div", { class: "cele-score mono" }, `${correct} / ${n}`));
  const pts = h("div", { class: "cele-points mono" }, "+0");
  root.append(pts);
  const subBits = [`best combo ×${maxCombo || 1}`];
  if (timeMs != null) subBits.push(fmtTime(timeMs));
  root.append(h("div", { class: "cele-sub" }, subBits.join("  ·  ")));

  const acts = h("div", { class: "cele-acts" });
  if (!session.isReview) {
    const idx = day.sessions.findIndex((s) => s.id === session.id);
    const nextSession = day.sessions[idx + 1];
    if (nextSession) acts.append(h("button", { class: "btn primary", type: "button", onClick: () => onNavigate(`#/play/${nextSession.id}`) }, "Next session →"));
    acts.append(h("button", { class: "btn", type: "button", onClick: () => onNavigate(`#/day/${day.day}`) }, "Day map"));
  }
  acts.append(h("button", { class: "btn ghost", type: "button", onClick: () => onNavigate("#/") }, "Home"));
  root.append(acts);

  mount.replaceChildren(root);
  if (!reduce) {
    requestAnimationFrame(() => root.classList.add("in"));
    confetti(root);
    countUp(pts, points);
  } else {
    pts.textContent = `+${points}`;
  }
}

function countUp(el, target) {
  const steps = 28;
  let k = 0;
  const tick = () => {
    k++;
    el.textContent = `+${Math.round((target * k) / steps)}`;
    if (k < steps) requestAnimationFrame(tick);
    else el.textContent = `+${target}`;
  };
  tick();
}

function confetti(root) {
  const layer = h("div", { class: "confetti" });
  const colors = ["#F59E0B", "#FBBF24", "#D97706", "#9CA3AF", "#52525B"];
  for (let i = 0; i < 36; i++) {
    const bit = h("i");
    bit.style.left = (Math.random() * 100) + "%";
    bit.style.background = colors[i % colors.length];
    bit.style.animationDelay = (Math.random() * 0.3) + "s";
    bit.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.append(bit);
  }
  root.append(layer);
  setTimeout(() => layer.remove(), 2200);
}
