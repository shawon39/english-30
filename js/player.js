// player.js — plays one set: card after card, tracking reps, combo, HP and points.

import { h, renderCard } from "./stations.js";
import * as store from "./store.js";
import * as audio from "./audio.js";

const MAX_HP = 100;

export function setURL(id) { return `content/set-${String(id).padStart(3, "0")}.json`; }

const cache = new Map();
export async function fetchSet(id) {
  if (cache.has(id)) return cache.get(id);
  const res = await fetch(setURL(id), { cache: "no-cache" });
  if (!res.ok) throw new Error("set not found");
  const json = await res.json();
  cache.set(id, json);
  return json;
}

/**
 * Which sets exist, without a manifest to keep in sync. Sets are numbered without
 * gaps, so walking until the first miss keeps this to one wasted request instead of
 * spraying 404s for every slot that has not been generated yet.
 */
export async function probeSets(max = 200) {
  const found = [];
  for (let i = 0; i <= max; i++) {
    let ok = false;
    try { ok = (await fetch(setURL(i), { method: "HEAD" })).ok; } catch { ok = false; }
    if (!ok) break;
    found.push(i);
  }
  return found;
}

export function playSet(mount, set, { onExit, onFinish }) {
  const cards = (set.stations || []).flatMap((st) =>
    (st.items || []).map((it) => ({ ...it, station: it.station || st.station }))
  );

  let idx = 0, points = 0, reps = 0, hp = MAX_HP, combo = 0, bestCombo = 0, misses = 0;

  const dots = h("div", { class: "progressdots" },
    ...cards.map(() => h("span", { class: "pdot" })));
  const hpFill = h("i", {});
  const hpBar = h("div", { class: "hpbar", title: "ফ্লুয়েন্সি মিটার" }, hpFill);
  const comboEl = h("span", { class: "combo" }, "");
  const back = h("button", { class: "iconbtn", type: "button", "aria-label": "হোমে ফেরো", onclick: () => { audio.stop(); onExit(); } }, "←");

  const bar = h("div", { class: "playerbar" }, back, dots, hpBar, comboEl);
  const stage = h("div", {});
  mount.replaceChildren(bar, stage);

  function paintMeters() {
    hpFill.style.width = `${Math.max(0, hp)}%`;
    hpBar.classList.toggle("low", hp <= 35);
    // ×1 is not a bonus, so the meter stays quiet until the combo actually pays.
    const mult = multiplier();
    comboEl.textContent = mult > 1 ? `×${mult}` : "";
    if (mult > 1) { comboEl.classList.remove("flare"); void comboEl.offsetWidth; comboEl.classList.add("flare"); }
    [...dots.children].forEach((d, i) => {
      d.classList.toggle("done", i < idx);
      d.classList.toggle("now", i === idx);
    });
  }

  const multiplier = () => (combo >= 5 ? 3 : combo >= 3 ? 2 : 1);

  const ctx = {
    onScore(base) {
      points += base * multiplier();
      combo += 1;
      bestCombo = Math.max(bestCombo, combo);
      paintMeters();
    },
    onDamage(n) {
      hp = Math.max(0, hp - n);
      combo = 0;
      paintMeters();
    },
    onMiss(itemId) {
      misses += 1;
      store.logMiss(itemId, set.set);
    },
    onRep() { reps += 1; },
  };

  function show() {
    audio.stop();
    paintMeters();
    if (idx >= cards.length) return finish();

    const item = cards[idx];
    let advanced = false;
    const node = renderCard(item, ctx, () => {
      if (advanced) return;
      advanced = true;
      store.clearMiss(item.id);
      const next = h("button", { class: "btn", type: "button", onclick: () => { idx += 1; show(); } },
        idx === cards.length - 1 ? "ফলাফল দেখো →" : "পরের কার্ড →");
      stage.append(h("div", { style: "display:flex;justify-content:center;padding:8px 0 32px" }, next));
      next.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    stage.replaceChildren(node);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function finish() {
    const accuracy = cards.length ? Math.round((1 - misses / (cards.length + misses)) * 100) : 100;
    const bonus = Math.round(hp / 4);
    points += bonus;
    const { stats, streak } = store.recordSet(String(set.set).padStart(3, "0"), { reps, points, accuracy });

    stage.replaceChildren(h("div", { class: "finish" },
      h("div", { class: "big mono" }, `+${points}`),
      h("h2", { class: "bn" }, "সেট শেষ"),
      h("p", {}, `${reps} রেপ · ফ্লুয়েন্সি বোনাস +${bonus}`),
      h("div", { class: "grid" },
        h("div", { class: "cell" }, h("div", { class: "n mono" }, String(stats.reps)), h("div", { class: "k" }, "মোট রেপ")),
        h("div", { class: "cell" }, h("div", { class: "n mono" }, `×${bestCombo >= 5 ? 3 : bestCombo >= 3 ? 2 : 1}`), h("div", { class: "k" }, "সেরা কম্বো")),
        h("div", { class: "cell" }, h("div", { class: "n mono" }, `${streak.current}`), h("div", { class: "k" }, "দিনের স্ট্রিক"))
      ),
      misses ? h("p", { class: "note bn" }, `${misses}টা কার্ডে হোঁচট খেয়েছো — ওগুলো দুই দিন পর আবার ফিরে আসবে।`) : null,
      h("div", { style: "display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px" },
        h("button", { class: "btn", type: "button", onclick: () => { audio.stop(); onFinish(); } }, "হোমে ফেরো"),
        h("button", { class: "btn ghost", type: "button", onclick: () => { idx = 0; points = 0; reps = 0; hp = MAX_HP; combo = 0; misses = 0; show(); } }, "আবার খেলো")
      )
    ));
    [...dots.children].forEach((d) => { d.classList.add("done"); d.classList.remove("now"); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  show();
}
