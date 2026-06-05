// engine.js — content loading + session player (scoring, combo, streak, persist).

import { pad } from "./curriculum.js";
import { renderItem, h, beep } from "./render.js";
import * as store from "./storage.js";

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

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// Drives one full session inside `mount`.
export async function playSession({ mount, day, session, sessionIdsOfDay, onExit, onNavigate }) {
  const items = session.items || [];
  const n = items.length;
  const timed = session.type === "mixed";
  let i = 0, correct = 0, combo = 0, maxCombo = 0, points = 0;
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
  if (timed) timer = setInterval(() => { timerEl.textContent = fmtTime(performance.now() - startTs); }, 200);

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
        if (ok) {
          combo += 1;
          maxCombo = Math.max(maxCombo, combo);
          const gain = 10 + Math.min(combo - 1, 9) * 5;
          points += gain;
          correct += 1;
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
      const last = i === n - 1;
      const next = h("button", { class: "btn primary", type: "button", onClick: advance }, last ? "Finish" : "Next");
      nav.append(next);
      next.focus();
    });

    stage.append(el);
    if (!reduce) requestAnimationFrame(() => el.classList.add("in"));
  }

  function advance() { if (i < n - 1) { i += 1; showItem(); } else finish(); }

  function finish() {
    if (timer) clearInterval(timer);
    fill.style.width = "100%";
    const timeMs = timed ? Math.round(performance.now() - startTs) : null;
    store.setSessionResult(session.id, { correct, total: n, timeMs });
    store.addPoints(day.day, points);
    store.markActiveToday();
    store.markDayDoneIfComplete(day.day, sessionIdsOfDay);
    celebrate({ mount, day, session, correct, n, points, maxCombo, timeMs, onNavigate, reduce });
  }

  showItem();
}

function celebrate({ mount, day, session, correct, n, points, maxCombo, timeMs, onNavigate, reduce }) {
  const root = h("div", { class: "celebrate" });
  root.append(h("div", { class: "cele-check" }, "✓"));
  root.append(h("h2", { class: "cele-title" }, correct === n ? "Flawless!" : "Session complete"));
  root.append(h("div", { class: "cele-score mono" }, `${correct} / ${n}`));
  const pts = h("div", { class: "cele-points mono" }, "+0");
  root.append(pts);
  const subBits = [`best combo ×${maxCombo || 1}`];
  if (timeMs != null) subBits.push(fmtTime(timeMs));
  root.append(h("div", { class: "cele-sub" }, subBits.join("  ·  ")));

  const acts = h("div", { class: "cele-acts" });
  const idx = day.sessions.findIndex((s) => s.id === session.id);
  const nextSession = day.sessions[idx + 1];
  if (nextSession) acts.append(h("button", { class: "btn primary", type: "button", onClick: () => onNavigate(`#/play/${nextSession.id}`) }, "Next session →"));
  acts.append(h("button", { class: "btn", type: "button", onClick: () => onNavigate(`#/day/${day.day}`) }, "Day map"));
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
