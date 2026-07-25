// app.js — hash routing, view switching, home dashboard, settings/backup.

import { CURRICULUM, getDay, TOTAL_SESSIONS, pad, PILLAR_LABEL, GROUPS } from "./curriculum.js";
import * as store from "./storage.js";
import * as srs from "./srs.js";
import { fetchDay, probeAvailableDays, playSession, buildReviewSession, interleavedItems } from "./engine.js";
import { h, shuffle } from "./render.js";

const app = document.getElementById("app");
let available = new Set();
let probed = false;
let mediaBound = false;

async function init() {
  router();
  try { available = await probeAvailableDays(); } catch {}
  probed = true;
  if (route().name === "home") renderHome();
}

function resolveTheme(t) {
  t = t || "light";
  if (t === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return t;
}
function applySettings() {
  const s = store.getSettings();
  const theme = resolveTheme(s.theme);
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("reduce-motion", !!s.reduceMotion);
  document.documentElement.dataset.lang = s.lang;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#F4EDDF" : "#14110E");
  if (!mediaBound) {
    mediaBound = true;
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if ((store.getSettings().theme || "light") === "system") { applySettings(); router(); }
    });
  }
}

const SUN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>';
const MOON_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
function themeToggleBtn() {
  const cur = resolveTheme(store.getSettings().theme);
  const btn = h("button", { class: "icon-btn theme-toggle", type: "button", title: "Toggle light / dark" });
  btn.innerHTML = cur === "light" ? MOON_ICON : SUN_ICON;
  btn.onclick = () => {
    const next = resolveTheme(store.getSettings().theme) === "light" ? "dark" : "light";
    store.setSettings({ theme: next });
    applySettings();
    renderHome();
  };
  return btn;
}

// --- routing ---
function route() {
  const p = location.hash.replace(/^#/, "") || "/";
  if (p === "/review") return { name: "review" };
  const play = p.match(/^\/play\/(d\d{2}s\d)/);
  if (play) return { name: "play", id: play[1] };
  const day = p.match(/^\/day\/(\d+)/);
  if (day) return { name: "day", day: +day[1] };
  return { name: "home" };
}
function router() {
  const r = route();
  if (r.name === "day") renderDay(r.day);
  else if (r.name === "play") renderPlay(r.id);
  else if (r.name === "review") renderReview();
  else renderHome();
  window.scrollTo(0, 0);
}
function navigate(hash) {
  if (location.hash === hash) router();
  else location.hash = hash;
}

// --- day state model ---
function computeDayStates() {
  const progress = store.getProgress();
  let currentAssigned = false;
  return CURRICULUM.map((day) => {
    const ids = day.sessions.map((s) => s.id);
    const doneN = ids.filter((id) => progress[id] && progress[id].done).length;
    const allDone = doneN === ids.length;
    const avail = available.has(day.day);
    let state;
    if (!avail) state = "locked";
    else if (allDone) state = "done";
    else if (!currentAssigned) { state = "current"; currentAssigned = true; }
    else state = "open";
    return { ...day, doneN, total: ids.length, state };
  });
}

// --- HOME ---
function renderHome() {
  const streak = store.getStreak();
  const points = store.getPoints();
  const progress = store.getProgress();
  const doneCount = Object.values(progress).filter((p) => p.done).length;
  const states = computeDayStates();
  const current = states.find((d) => d.state === "current");

  const root = h("div", { class: "home" });
  root.append(h("header", { class: "home-head" },
    h("div", { class: "head-row" },
      h("h1", { class: "brand" }, "English 30"),
      themeToggleBtn()
    ),
    h("p", { class: "tagline" }, "Fix fast-speech grammar — tenses, conditionals, modals. One tap at a time.")
  ));

  root.append(h("section", { class: "stats" },
    streakRing(streak),
    focusBar(doneCount),
    masteryCard(points.total)
  ));

  root.append(reviewCta(srs.countDue()));

  if (!probed) root.append(h("div", { class: "muted-note" }, "Checking which days are unlocked…"));
  const note = missedNote(streak, current);
  if (note) root.append(note);

  root.append(h("h2", { class: "section-title" }, "Your 30 days"));
  root.append(mapView(states));
  root.append(actionsBar());

  app.replaceChildren(root);
}

function streakRing(streak) {
  const current = streak.current || 0;
  const goal = 7;
  const pct = current === 0 ? 0 : (((current - 1) % goal) + 1) / goal;
  const r = 52, c = 2 * Math.PI * r, off = c * (1 - pct);
  const hot = streak.lastActiveISO === store.todayISO();
  const wrap = h("div", { class: `stat ring-stat${hot ? " hot" : ""}` });
  wrap.innerHTML = `
    <svg viewBox="0 0 120 120" class="ring">
      <circle cx="60" cy="60" r="${r}" class="ring-track"/>
      <circle cx="60" cy="60" r="${r}" class="ring-val" style="--c:${c};--off:${off}"/>
    </svg>
    <div class="ring-center">
      ${hot ? '<span class="ring-flame">🔥</span>' : ""}
      <span class="ring-num">${current}</span>
      <span class="ring-label">day streak</span>
    </div>`;
  wrap.append(h("span", { class: "stat-cap" }, "Don't break the chain"));
  return wrap;
}

function focusBar(doneCount) {
  const pct = Math.round((doneCount / TOTAL_SESSIONS) * 100);
  const wrap = h("div", { class: "stat focus-stat" });
  wrap.append(h("div", { class: "focus-top" },
    h("span", { class: "focus-label" }, "Progress"),
    h("span", { class: "focus-count mono" }, `${doneCount} / ${TOTAL_SESSIONS}`)
  ));
  const bar = h("div", { class: "focus-bar" });
  bar.append(h("div", { class: "focus-fill", style: `width:${pct}%` }));
  wrap.append(bar);
  wrap.append(h("span", { class: "stat-cap" }, `${pct}% of sessions`));
  return wrap;
}

// Leads with patterns mastered rather than XP — "23 errors retired" is evidence you
// actually got better; a points total is not.
function masteryCard(totalXp) {
  const m = srs.masteryStats();
  const wrap = h("div", { class: "stat points-stat" });
  wrap.append(h("span", { class: "points-num mono" }, String(m.retired)));
  wrap.append(h("span", { class: "points-label" }, m.retired === 1 ? "error mastered" : "errors mastered"));
  wrap.append(h("span", { class: "stat-cap" },
    m.tracked ? `${m.active} still active · ${totalXp} XP` : `${totalXp} XP · mistakes you fix show up here`));
  return wrap;
}

function reviewCta(dueCount) {
  if (dueCount === 0) {
    return h("div", { class: "review-cta muted-note" }, "No reviews due — clear more sessions to build your mistake bank.");
  }
  return h("a", { class: "btn primary review-cta", href: "#/review" }, `Quick Review — ${dueCount} due →`);
}

function missedNote(streak, current) {
  if (!streak.lastActiveISO) return null;
  const gap = store.diffDays(streak.lastActiveISO, store.todayISO());
  if (gap <= 1) return null;
  const where = current ? `Pick up at Day ${pad(current.day)}.` : "";
  return h("div", { class: "missed-note" }, `You missed ${gap - 1} day${gap - 1 === 1 ? "" : "s"}. ${where} No worries — just keep going.`);
}

function mapView(states) {
  const wrap = h("div", { class: "map" });
  if (available.size === 0 && probed) {
    wrap.append(h("div", { class: "empty-hint" },
      h("strong", {}, "No content yet. "),
      "Drop ", h("code", {}, "content/day-01.json"), " into the repo to unlock Day 1."
    ));
  }
  GROUPS.forEach((g) => {
    const days = states.filter((d) => g.pillars.includes(d.pillar));
    if (!days.length) return;
    wrap.append(h("h3", { class: "group-label" }, g.label, h("span", { class: "group-range mono" }, `${pad(days[0].day)}–${pad(days[days.length - 1].day)}`)));
    const grid = h("div", { class: "grid" });
    days.forEach((d, i) => grid.append(dayCell(d, i)));
    wrap.append(grid);
  });
  return wrap;
}

function lockSvg() { return '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm-3 8V6a3 3 0 0 1 6 0v3H9z"/></svg>'; }

function dayCell(d, i) {
  const tag = d.state === "locked" ? "div" : "a";
  const props = { class: `day-cell ${d.state}`, style: `--i:${i}` };
  if (d.state !== "locked") props.href = `#/day/${d.day}`;
  const cell = h(tag, props);
  cell.append(h("span", { class: "day-num mono" }, pad(d.day)));
  cell.append(h("span", { class: "day-theme" }, d.theme));
  const tags = h("span", { class: "day-tags" });
  if (d.star) tags.append(h("span", { class: "tag star" }, "★"));
  if (d.heavy) tags.append(h("span", { class: "tag heavy mono" }, "4"));
  cell.append(tags);
  const badge = h("span", { class: "day-badge" });
  if (d.state === "done") badge.textContent = "✓";
  else if (d.state === "current") badge.textContent = "▶";
  else if (d.state === "locked") badge.innerHTML = lockSvg();
  else badge.textContent = `${d.doneN}/${d.total}`;
  cell.append(badge);
  if (d.state === "locked") cell.addEventListener("click", () => toast(`Day ${pad(d.day)} is locked — add content/day-${pad(d.day)}.json`));
  return cell;
}

// --- DAY VIEW ---
function renderDay(dayNum) {
  const day = getDay(dayNum);
  if (!day) return navigate("#/");
  const progress = store.getProgress();
  const root = h("div", { class: "dayview" });
  root.append(backHeader(`Day ${pad(dayNum)}`, "#/"));
  root.append(h("span", { class: "pillar-chip" }, PILLAR_LABEL[day.pillar]));
  root.append(h("h1", { class: "dayview-theme" }, day.theme));
  if (day.star) root.append(h("span", { class: "tag star big" }, "★ fast-speech focus"));

  if (!available.has(dayNum)) {
    root.append(h("div", { class: "locked-panel" },
      h("div", { class: "lock-ico", html: lockSvg() }),
      h("p", {}, "This day isn't unlocked yet."),
      h("p", { class: "muted-note" }, `Add content/day-${pad(dayNum)}.json and refresh.`)
    ));
    app.replaceChildren(root);
    return;
  }

  const list = h("div", { class: "session-list" });
  day.sessions.forEach((s, i) => {
    const p = progress[s.id];
    const done = p && p.done;
    const card = h("a", { class: `session-card ${done ? "done" : ""}`, href: `#/play/${s.id}`, style: `--i:${i}` });
    card.append(h("span", { class: "s-id mono" }, `S${s.n}`));
    card.append(h("span", { class: "s-body" },
      h("span", { class: "s-title" }, s.title),
      h("span", { class: "s-blurb" }, s.blurb)
    ));
    card.append(h("span", { class: "s-badge mono" }, done ? `${p.best}/${p.total} ✓` : "▶"));
    list.append(card);
  });
  root.append(list);
  app.replaceChildren(root);
}

// --- PLAY VIEW ---
async function renderPlay(id) {
  const dayNum = parseInt(id.slice(1, 3), 10);
  const sn = parseInt(id.slice(4), 10);
  const dayMeta = getDay(dayNum);
  if (!dayMeta) return navigate("#/");
  app.replaceChildren(h("div", { class: "loading" }, "Loading…"));

  let content;
  try { content = await fetchDay(dayNum); }
  catch {
    app.replaceChildren(h("div", { class: "dayview" },
      backHeader(`Day ${pad(dayNum)}`, "#/"),
      h("div", { class: "locked-panel" }, h("p", {}, "Content for this day isn't available yet."))
    ));
    return;
  }

  const c = (content.sessions || []).find((s) => s.id === id) || (content.sessions || [])[sn - 1];
  if (!c) { toast("Session not found in content"); return navigate(`#/day/${dayNum}`); }
  const meta = dayMeta.sessions.find((s) => s.id === id) || {};

  // Sessions 1–2 stay blocked on the new rule (you're still learning it).
  // Sessions 3–4 are consolidation, so mix in earlier days to force discrimination.
  const consolidation = sn >= 3;
  const extra = consolidation ? await interleavedItems(dayNum, available, 3) : [];
  const items = shuffle([...(c.items || []), ...extra]);

  const session = {
    id,
    title: c.title || meta.title,
    type: c.type || meta.type,
    items,
    rule: content.rule_en || "",
    rule_bn: content.rule_bn || "",
  };

  await playSession({
    mount: app,
    day: dayMeta,
    session,
    sessionIdsOfDay: dayMeta.sessions.map((s) => s.id),
    onExit: () => navigate(`#/day/${dayNum}`),
    onNavigate: navigate,
  });
}

// --- REVIEW VIEW (Quick Review, spaced-repetition mistake bank) ---
// Review comes in different shapes, picked at random — not knowing whether you're
// about to get a 60-second sprint or a 3-strikes run is most of what keeps it alive.
const REVIEW_SHAPES = [
  { title: "Quick Review", size: 10, blurb: "10 items, no pressure." },
  { title: "Speed Round",  size: 16, limitMs: 60000, blurb: "60 seconds. Go." },
  { title: "Survival",     size: 16, maxMistakes: 3, blurb: "Three mistakes and it's over." },
  { title: "Micro Drill",  size: 5,  blurb: "Five items. That's it." },
];

async function renderReview() {
  app.replaceChildren(h("div", { class: "loading" }, "Loading…"));

  const shape = REVIEW_SHAPES[Math.floor(Math.random() * REVIEW_SHAPES.length)];
  const session = await buildReviewSession(shape.size);
  if (session) {
    session.title = shape.title;
    if (shape.limitMs) session.limitMs = shape.limitMs;
    if (shape.maxMistakes) session.maxMistakes = shape.maxMistakes;
  }
  if (!session) {
    app.replaceChildren(h("div", { class: "dayview" },
      backHeader("Quick Review", "#/"),
      h("div", { class: "locked-panel" },
        h("p", {}, "Nothing due for review right now."),
        h("p", { class: "muted-note" }, "Missed items resurface here after a session.")
      )
    ));
    return;
  }

  await playSession({
    mount: app,
    day: { day: 0, sessions: [] },
    session,
    sessionIdsOfDay: [],
    onExit: () => navigate("#/"),
    onNavigate: navigate,
  });
}

// --- shared UI ---
function backHeader(label, hash) {
  return h("div", { class: "back-header" },
    h("a", { class: "icon-btn", href: hash, html: "&larr;" }),
    h("span", { class: "back-label mono" }, label)
  );
}

function actionsBar() {
  const bar = h("div", { class: "actions" });
  bar.append(h("button", { class: "btn ghost", type: "button", onClick: openSettings }, "⚙ Settings"));
  bar.append(h("button", { class: "btn ghost", type: "button", onClick: doExport }, "↓ Export"));
  bar.append(h("button", { class: "btn ghost", type: "button", onClick: doImport }, "↑ Import"));
  bar.append(h("button", { class: "btn ghost danger", type: "button", onClick: confirmReset }, "Reset"));
  return bar;
}

function doExport() {
  const data = store.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: "progress.json" });
  document.body.append(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast("Progress exported to progress.json");
}

function doImport() {
  const inp = h("input", { type: "file", accept: "application/json" });
  inp.style.display = "none";
  inp.addEventListener("change", () => {
    const f = inp.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { store.importAll(JSON.parse(r.result)); applySettings(); router(); toast("Progress restored"); }
      catch { toast("Could not read that file"); }
    };
    r.readAsText(f);
    inp.remove();
  });
  document.body.append(inp); inp.click();
}

function confirmReset() {
  const box = h("div", {},
    h("h3", { class: "modal-title" }, "Reset everything?"),
    h("p", { class: "modal-text" }, "This wipes your streak, points, and all session progress on this device. Export first if you want a backup."),
    h("div", { class: "modal-acts" })
  );
  const m = modal(box);
  const acts = box.querySelector(".modal-acts");
  acts.append(h("button", { class: "btn ghost", type: "button", onClick: () => m.close() }, "Cancel"));
  acts.append(h("button", { class: "btn danger-solid", type: "button", onClick: () => { store.resetAll(); applySettings(); m.close(); router(); toast("Progress reset"); } }, "Reset"));
}

function openSettings() {
  const s = store.getSettings();
  const box = h("div", {});
  box.append(h("h3", { class: "modal-title" }, "Settings"));

  const themeRow = h("div", { class: "set-row" }, h("span", {}, "Theme"));
  const themeSel = h("select", { class: "select" });
  [["light", "Light"], ["dark", "Dark"], ["system", "System"]].forEach(([v, t]) => {
    const o = h("option", { value: v }, t);
    if ((s.theme || "light") === v) o.selected = true;
    themeSel.append(o);
  });
  themeSel.onchange = () => { store.setSettings({ theme: themeSel.value }); applySettings(); renderHome(); };
  themeRow.append(themeSel);
  box.append(themeRow);

  const langRow = h("div", { class: "set-row" }, h("span", {}, "Language of notes"));
  const langSel = h("select", { class: "select" });
  [["en", "English only"], ["both", "English + বাংলা"], ["bn", "বাংলা"]].forEach(([v, t]) => {
    const o = h("option", { value: v }, t);
    if (s.lang === v) o.selected = true;
    langSel.append(o);
  });
  langSel.onchange = () => { store.setSettings({ lang: langSel.value }); applySettings(); };
  langRow.append(langSel);
  box.append(langRow);

  box.append(toggleRow("Sound effects", s.sound, (v) => store.setSettings({ sound: v })));
  box.append(toggleRow("Reduce motion", s.reduceMotion, (v) => { store.setSettings({ reduceMotion: v }); applySettings(); }));

  const acts = h("div", { class: "modal-acts" });
  const m = modal(box);
  acts.append(h("button", { class: "btn", type: "button", onClick: () => m.close() }, "Done"));
  box.append(acts);
}

function toggleRow(label, on, cb) {
  const row = h("div", { class: "set-row" }, h("span", {}, label));
  const btn = h("button", { class: `toggle ${on ? "on" : ""}`, type: "button" });
  btn.append(h("span", { class: "knob" }));
  btn.onclick = () => { on = !on; btn.classList.toggle("on", on); cb(on); };
  row.append(btn);
  return row;
}

function modal(node) {
  const ov = h("div", { class: "overlay", onClick: (e) => { if (e.target === ov) close(); } });
  ov.append(h("div", { class: "modal" }, node));
  document.body.append(ov);
  requestAnimationFrame(() => ov.classList.add("in"));
  function close() { ov.classList.remove("in"); setTimeout(() => ov.remove(), 200); }
  return { close };
}

let toastTimer;
function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = h("div", { class: "toast" }); document.body.append(t); }
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add("in"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("in"), 2600);
}

// --- bootstrap (after all declarations so consts are initialized) ---
applySettings();
window.addEventListener("hashchange", router);
init();
