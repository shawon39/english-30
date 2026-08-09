// player.js — plays one set: card after card, tracking reps, combo, HP and points.

import { h, renderCard, shuffle } from "./stations.js";
import { ico } from "./icons.js";
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

/** The manifest carries everything the home screen shows, in one request. */
export async function fetchIndex() {
  const res = await fetch("content/index.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("no manifest");
  const json = await res.json();
  if (!Array.isArray(json.sets) || !json.sets.length) throw new Error("empty manifest");
  return json.sets;
}

/**
 * Fallback for a content directory built by hand, with no manifest. Sets are
 * numbered without gaps, so walking until the first miss costs one wasted request
 * rather than spraying 404s for every slot that does not exist yet.
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

// Easiest station first, hardest last. Which cards appear is random; the shape of
// the climb is not.
const GRADIENT = ["time-machine", "frame", "if-machine", "ladder", "backward", "boss"];
const byGradient = (items) =>
  [...items].sort((a, b) => GRADIENT.indexOf(a.station) - GRADIENT.indexOf(b.station));

/** The cards you fumbled, pulled back out of the sets they came from. */
export async function buildReview(limit = 12) {
  const due = store.dueMistakes();
  if (!due.length) return null;

  const bySet = new Map();
  due.forEach((d) => {
    if (!bySet.has(d.setId)) bySet.set(d.setId, []);
    bySet.get(d.setId).push(d);
  });

  const items = [];
  for (const [setId, recs] of bySet) {
    let content;
    try {
      content = await fetchSet(setId);
    } catch {
      recs.forEach((r) => store.clearMiss(r.itemId)); // its set is gone
      continue;
    }
    const all = (content.stations || []).flatMap((st) =>
      (st.items || []).map((it) => ({ ...it, station: it.station || st.station })));
    recs.forEach((r) => {
      const hit = all.find((it) => it.id === r.itemId);
      if (hit) items.push({ ...hit, _set: setId });
      else store.clearMiss(r.itemId); // the card no longer exists
    });
  }
  if (!items.length) return null;

  return {
    set: "review",
    title_bn: "রিভিউ",
    finish_bn: "রিভিউ শেষ",
    stations: [{ station: "mixed", items: byGradient(items).slice(0, limit) }],
  };
}

/** A fresh combination every time, drawn from every set already played. */
export async function buildMixed(ids, limit = 12) {
  const loaded = (await Promise.all(ids.map((id) =>
    fetchSet(id).then((set) => ({ id, set })).catch(() => null)
  ))).filter(Boolean);

  const byStation = new Map();
  loaded.forEach(({ id, set }) => {
    (set.stations || []).forEach((st) => {
      (st.items || []).forEach((it) => {
        const station = it.station || st.station;
        if (station === "boss") return; // three timed rounds does not belong in a sampler
        if (!byStation.has(station)) byStation.set(station, []);
        byStation.get(station).push({ ...it, station, _set: id });
      });
    });
  });
  if (!byStation.size) return null;

  // Round-robin across stations so a drill is never four frames in a row.
  const groups = [...byStation.values()].map(shuffle);
  const picked = [];
  for (let i = 0; picked.length < limit && groups.some((g) => g.length); i++) {
    const g = groups[i % groups.length];
    if (g.length) picked.push(g.pop());
  }
  if (picked.length < 4) return null;

  return {
    set: "mixed",
    title_bn: "মিক্সড ড্রিল",
    finish_bn: "মিক্সড ড্রিল শেষ",
    stations: [{ station: "mixed", items: byGradient(picked) }],
  };
}

/** One resume slot per playable thing: every set keeps its own, as do review and mixed. */
export function sessionKey(setId) {
  return typeof setId === "number" ? `set:${String(setId).padStart(3, "0")}` : String(setId);
}

/**
 * Turns a saved checkpoint back into a playable set. The deck is rebuilt from the
 * card ids that were actually dealt, in the order they were dealt, so resuming
 * lands on the card you left rather than on a freshly shuffled stranger. It comes
 * back as one pre-ordered "mixed" station, which playSet leaves untouched.
 * Returns null if the content moved on under the save — then it is honest to restart.
 */
export async function rebuildSession(saved) {
  if (!saved || !Array.isArray(saved.order) || !saved.order.length) return null;

  const byId = new Map();
  for (const sourceId of new Set(saved.order.map(([, s]) => s))) {
    let content;
    try { content = await fetchSet(sourceId); } catch { return null; }
    (content.stations || []).forEach((st) => (st.items || []).forEach((it) => {
      byId.set(it.id, { ...it, station: it.station || st.station, _set: sourceId });
    }));
  }

  const items = saved.order.map(([id]) => byId.get(id));
  if (items.some((it) => !it)) return null;   // a card was rewritten or dropped

  return {
    set: saved.setId,
    title_bn: saved.title_bn || "",
    finish_bn: saved.finish_bn || "",
    stations: [{ station: "mixed", items }],
  };
}

export function playSet(mount, set, { onExit, onFinish, resume = null }) {
  // Cards are shuffled inside their own station but never across stations: the
  // warm-up gradient — tap a verb first, talk for sixty seconds last — is the
  // reason a set is playable at all. A review or mixed session arrives as one
  // "mixed" group that byGradient already ordered, so it is left alone.
  const cards = (set.stations || []).flatMap((st) => {
    const items = st.station === "mixed" ? (st.items || []) : shuffle(st.items || []);
    return items.map((it) => ({ ...it, station: it.station || st.station }));
  });
  const key = sessionKey(set.set);

  let idx = 0, points = 0, reps = 0, hp = MAX_HP, combo = 0, bestCombo = 0, misses = 0;

  // Picking up where you stopped. A card is checkpointed only once it is finished,
  // so the worst a crash mid-card can cost is that one card's reps.
  let resumedAt = 0;
  if (resume && resume.idx > 0 && resume.idx <= cards.length) {
    idx = resumedAt = resume.idx;
    points = resume.points || 0;
    reps = resume.reps || 0;
    hp = Number.isFinite(resume.hp) ? resume.hp : MAX_HP;
    combo = resume.combo || 0;
    bestCombo = resume.bestCombo || 0;
    misses = resume.misses || 0;
  }

  function checkpoint(nextIdx) {
    if (nextIdx <= 0) return;
    store.saveProgress(key, {
      setId: set.set,
      title_bn: set.title_bn || "",
      finish_bn: set.finish_bn || "",
      order: cards.map((c) => [c.id, c._set ?? set.set]),
      total: cards.length,
      idx: nextIdx,
      points, reps, hp, combo, bestCombo, misses,
    });
  }

  function restart() {
    store.clearProgress(key);
    idx = 0; points = 0; reps = 0; hp = MAX_HP; combo = 0; bestCombo = 0; misses = 0;
    resumedAt = 0;
    show();
  }

  const dots = h("div", { class: "progressdots" },
    ...cards.map(() => h("span", { class: "pdot" })));
  const hpFill = h("i", {});
  const hpBar = h("div", { class: "hpbar", title: "ফ্লুয়েন্সি মিটার" }, hpFill);
  const comboEl = h("span", { class: "combo" }, "");
  const back = h("button", { class: "iconbtn", type: "button", "aria-label": "হোমে ফেরো", onclick: () => { audio.stop(); onExit(); } }, ico("left", 19));

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
      store.logMiss(itemId, cards.find((c) => c.id === itemId)?._set ?? set.set);
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
      // The card is banked before the tap that leaves it, so walking away here
      // and coming back tomorrow opens on the next card, not on this one again.
      checkpoint(idx + 1);
      const next = h("button", { class: "btn", type: "button", onclick: () => { idx += 1; show(); } },
        idx === cards.length - 1 ? "ফলাফল দেখো" : "পরের কার্ড", ico("right", 16));
      stage.append(h("div", { style: "display:flex;justify-content:center;padding:8px 0 32px" }, next));
      next.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    const note = idx === resumedAt && resumedAt > 0
      ? h("div", { class: "resumenote" },
          ico("repeat", 15, "ic"),
          h("span", { class: "bn" }, `আগের জায়গা থেকে — কার্ড ${idx + 1} / ${cards.length}`),
          h("button", { class: "restart bn", type: "button", onclick: restart }, "শুরু থেকে"))
      : null;
    stage.replaceChildren(...(note ? [note, node] : [node]));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function finish() {
    store.clearProgress(key);
    const accuracy = cards.length ? Math.round((1 - misses / (cards.length + misses)) * 100) : 100;
    const bonus = Math.round(hp / 4);
    points += bonus;
    const { stats, streak } = store.recordSet(String(set.set).padStart(3, "0"), { reps, points, accuracy });

    stage.replaceChildren(h("div", { class: "finish" },
      h("div", { class: "big mono" }, `+${points}`),
      h("h2", { class: "bn" }, set.finish_bn || "সেট শেষ"),
      h("p", {}, `${reps} রেপ · ফ্লুয়েন্সি বোনাস +${bonus}`),
      h("div", { class: "grid" },
        h("div", { class: "cell" }, h("div", { class: "n mono" }, String(stats.reps)), h("div", { class: "k" }, "মোট রেপ")),
        h("div", { class: "cell" }, h("div", { class: "n mono" }, `×${bestCombo >= 5 ? 3 : bestCombo >= 3 ? 2 : 1}`), h("div", { class: "k" }, "সেরা কম্বো")),
        h("div", { class: "cell" }, h("div", { class: "n mono" }, `${streak.current}`), h("div", { class: "k" }, "দিনের স্ট্রিক"))
      ),
      misses ? h("p", { class: "note bn" }, `${misses}টা কার্ডে হোঁচট খেয়েছো — ওগুলো দুই দিন পর আবার ফিরে আসবে।`) : null,
      h("div", { style: "display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px" },
        h("button", { class: "btn", type: "button", onclick: () => { audio.stop(); onFinish(); } }, "হোমে ফেরো"),
        h("button", { class: "btn ghost", type: "button", onclick: restart }, "আবার খেলো")
      )
    ));
    [...dots.children].forEach((d) => { d.classList.add("done"); d.classList.remove("now"); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  show();
}
