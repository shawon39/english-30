// stations.js — one renderer per drill type.
// Every renderer builds a card, runs its own challenge, then hands the learner the
// same ending: hear the target, see the Bangla, say it N times against a clock.

import * as audio from "./audio.js";
import { getSettings } from "./store.js";

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  kids.flat().forEach((c) => { if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return el;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const STATION_META = {
  "time-machine": { ic: "⏪", name: "টাইম মেশিন" },
  ladder:         { ic: "🪜", name: "সিঁড়ি" },
  backward:       { ic: "🧵", name: "উল্টো গাঁথা" },
  frame:          { ic: "🧩", name: "ছাঁচ" },
  "if-machine":   { ic: "🌀", name: "যদি-মেশিন" },
  boss:           { ic: "🎤", name: "বস রাউন্ড" },
};

function haptic(ms = 12) {
  if (getSettings().sound && navigator.vibrate) { try { navigator.vibrate(ms); } catch { /* unsupported */ } }
}

/* ------------------------------------------------------------------ shell */

function cardShell(item) {
  const meta = STATION_META[item.station] || { ic: "•", name: item.station };
  const head = h("div", { class: "head" },
    h("span", { class: "ic" }, meta.ic),
    h("span", { class: "cheat mono" }, item.cheat || meta.name),
    item.source_date ? h("span", { class: "stamp" }, item.source_date) : null
  );
  const card = h("div", { class: "card" }, head);
  return {
    card,
    layer(tag, ...kids) {
      const l = h("div", { class: "layer" }, tag ? h("span", { class: "ltag" }, tag) : null, ...kids);
      card.append(l);
      return l;
    },
  };
}

/** His own words, with the weak spots marked by **double asterisks** in the content. */
function rawLine(text) {
  const html = text.replace(/\*\*(.+?)\*\*/g, "<mark>$1</mark>");
  return h("p", { class: "rawline", html });
}

/* ------------------------------------------------------- audio + karaoke */

/** Splits into word spans so the playing word can light up as the engine reports it. */
function karaokeSentence(text, cls = "sharp") {
  const p = h("p", { class: cls });
  const spans = [];
  let i = 0;
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) { p.append(part); i += part.length; continue; }
    const s = h("span", {}, part);
    s.dataset.start = String(i);
    s.dataset.end = String(i + part.length);
    spans.push(s);
    p.append(s);
    i += part.length;
  }
  return {
    node: p,
    lightAt(charIndex) {
      spans.forEach((s) => {
        const on = charIndex >= +s.dataset.start && charIndex < +s.dataset.end;
        s.classList.toggle("lit", on);
      });
    },
    clear() { spans.forEach((s) => s.classList.remove("lit")); },
  };
}

function audioRow(text, karaoke) {
  if (!audio.supported) return h("p", { class: "repmeta" }, "এই ব্রাউজারে অডিও নেই");

  const rates = [0.75, 1, 1.25];
  let rate = getSettings().rate || 1;

  const btn = h("button", { class: "playbtn", type: "button", "aria-label": "টার্গেট বাক্যটি শোনো" },
    h("span", { class: "tri" }, "▶"), h("span", {}, "শোনো"));

  const rateBtns = rates.map((r) =>
    h("button", {
      class: "rate", type: "button", "aria-pressed": String(r === rate),
      onclick: () => { rate = r; rateBtns.forEach((b, i) => b.setAttribute("aria-pressed", String(rates[i] === r))); },
    }, r === 0.75 ? "🐢 0.75×" : r === 1 ? "1×" : "⚡ 1.25×")
  );

  let stop = null;
  btn.addEventListener("click", () => {
    if (btn.dataset.playing === "1") { stop?.(); reset(); return; }
    btn.dataset.playing = "1";
    stop = audio.speak(text, {
      rate,
      onBoundary: (ci) => karaoke?.lightAt(ci),
      onEnd: reset,
    });
  });
  function reset() { btn.dataset.playing = "0"; karaoke?.clear(); }

  return h("div", { class: "audio" }, btn, h("div", { class: "rates" }, ...rateBtns));
}

/* ----------------------------------------------------------- bangla veil */

function bnBlock(text) {
  if (!text) return null;
  if (getSettings().bnMode !== "challenge") return h("p", { class: "bnline" }, text);

  const wrap = h("div", {});
  const veil = h("button", { class: "bnveil", type: "button" }, "🇧🇩", h("span", {}, "বাংলা দেখতে ট্যাপ করো"));
  veil.addEventListener("click", () => { wrap.replaceChildren(h("p", { class: "bnline" }, text)); });
  wrap.append(veil);
  return wrap;
}

/* -------------------------------------------------------------- rep bar */

/**
 * The core loop: tap to start, speak out loud, tap again before the bar drains.
 * Beating the clock scores full; running over still counts the rep but costs HP —
 * the penalty is for hesitation, never for being wrong.
 */
function repRow({ reps = 3, seconds = 6, label = "বলো", ctx, onDone }) {
  let done = 0;
  let running = false;
  let timeoutId = null;

  const pips = h("div", { class: "pips" }, ...Array.from({ length: reps }, () => h("span", { class: "pip" })));
  const btn = h("button", { class: "speak", type: "button" }, "🎙 ", label);
  const meta = h("span", { class: "repmeta" }, `${reps} রেপ · টার্গেট ${seconds}s`);
  const bar = h("i", {});
  const timer = h("div", { class: "timer" }, bar);

  function paint() {
    [...pips.children].forEach((p, i) => p.classList.toggle("on", i < done));
    meta.textContent = done >= reps ? "শেষ ✓" : `${reps - done} রেপ বাকি · ${seconds}s`;
  }

  function startRep() {
    running = true;
    btn.classList.add("live");
    btn.replaceChildren(document.createTextNode("✓ বলেছি"));
    timer.classList.remove("over");
    bar.style.animation = "none";
    void bar.offsetWidth;                       // restart the CSS animation
    bar.style.animation = `drain ${seconds}s linear forwards`;
    timeoutId = setTimeout(() => { timer.classList.add("over"); }, seconds * 1000);
  }

  function endRep() {
    clearTimeout(timeoutId);
    const overtime = timer.classList.contains("over");
    running = false;
    done += 1;
    haptic(overtime ? 24 : 10);
    ctx?.onScore?.(overtime ? 2 : 5, overtime ? "slow" : "rep");
    if (overtime) ctx?.onDamage?.(4);
    ctx?.onRep?.();

    bar.style.animation = "none";
    btn.classList.remove("live");
    paint();

    if (done >= reps) {
      btn.disabled = true;
      btn.replaceChildren(document.createTextNode("✓ কার্ড শেষ"));
      onDone?.();
    } else {
      btn.replaceChildren(document.createTextNode("🎙 আবার"));
    }
  }

  btn.addEventListener("click", () => (running ? endRep() : startRep()));
  paint();

  return h("div", {},
    h("div", { class: "repbar" }, btn, meta, pips),
    timer
  );
}

/** Target sentence + audio + Bangla + coach + reps. Every station ends here. */
function ending(shell, item, ctx, onDone) {
  const k = karaokeSentence(item.sharp);
  shell.layer("রিপ্লে — টার্গেট", k.node, audioRow(item.sharp, k)).classList.add("target");
  const bn = bnBlock(item.sharp_bn);
  if (bn) shell.layer("অর্থ", bn);
  if (item.coach_bn) shell.layer("কোচ", h("p", { class: "coachline", html: item.coach_bn.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") }));
  shell.layer(null, repRow({ reps: item.reps || 3, seconds: item.target_sec || 6, ctx, onDone }));
}

/* ==================================================== 1. time machine */

function timeMachine(item, ctx, done) {
  const shell = cardShell(item);
  if (item.raw) shell.layer("কাঁচা — তোমার লাইন", rawLine(item.raw));

  const slots = item.slots || [];
  let solved = 0;
  const row = h("div", { class: "tokens" });
  const choicesBox = h("div", { class: "choices" });

  const prompt = shell.layer("অতীতে ফেরাও — লাল শব্দগুলো ট্যাপ করো", row, choicesBox);

  item.tokens.forEach((tok, idx) => {
    const slot = slots.find((s) => s.index === idx);
    if (!slot) { row.append(h("span", { class: "tok" }, tok)); return; }

    const btn = h("button", { class: "slot", type: "button", "aria-expanded": "false" }, tok);
    btn.addEventListener("click", () => {
      if (btn.classList.contains("fixed")) return;
      openChoices(btn, slot);
    });
    row.append(btn);
  });

  function openChoices(btn, slot) {
    [...row.querySelectorAll(".slot")].forEach((b) => b.setAttribute("aria-expanded", "false"));
    btn.setAttribute("aria-expanded", "true");
    choicesBox.replaceChildren(
      ...shuffle(slot.options).map((opt) =>
        h("button", {
          class: "choice", type: "button",
          onclick: (e) => pick(e.currentTarget, btn, slot, opt),
        }, opt)
      )
    );
  }

  function pick(chip, btn, slot, opt) {
    if (opt === slot.answer) {
      chip.classList.add("ok");
      btn.textContent = opt;
      btn.classList.add("fixed");
      btn.setAttribute("aria-expanded", "false");
      haptic();
      ctx.onScore(10, "solve");
      solved += 1;
      setTimeout(() => choicesBox.replaceChildren(), 220);
      if (solved === slots.length) reveal();
    } else {
      chip.classList.add("no");
      btn.classList.add("shake");
      setTimeout(() => btn.classList.remove("shake"), 340);
      ctx.onDamage(8);
      ctx.onMiss(item.id);
    }
  }

  function reveal() {
    prompt.querySelector(".ltag").textContent = "অতীতে ফেরানো হলো ✓";
    ending(shell, item, ctx, done);
    shell.card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return shell.card;
}

/* ================================================ 2. ladder / 3. backward */

/**
 * Both grow one chunk at a time — the ladder forward from a 4-word core, the backward
 * build from the tail so the end of the sentence is always already in the mouth.
 */
function progressive(item, ctx, done, { reversed }) {
  const shell = cardShell(item);
  if (item.raw) shell.layer("কাঁচা — তোমার লাইন", rawLine(item.raw));

  const steps = reversed ? buildBackwardSteps(item.chunks) : item.rungs;
  const seconds = item.target_sec || 6;
  let at = 0;

  const list = h("div", { class: "rungs" });
  const rows = steps.map((text, i) => {
    const prev = i > 0 ? steps[i - 1] : "";
    const p = h("p", { html: markAddition(text, prev, reversed) });
    const row = h("div", { class: "rung hidden" }, h("span", { class: "rn mono" }, String(i + 1)), p);
    list.append(row);
    return row;
  });

  const label = reversed ? "লেজ থেকে গাঁথো — প্রতিটা এক দমে" : "সিঁড়ি বেয়ে ওঠো — প্রতিটা এক দমে";
  shell.layer(label, list).classList.add("target");

  const k = karaokeSentence(steps[steps.length - 1]);
  const audioLayer = shell.layer("শোনো", audioRow(steps[steps.length - 1], k));
  audioLayer.prepend(k.node);
  audioLayer.style.display = "none";

  const btn = h("button", { class: "speak", type: "button" }, "🎙 বলো");
  const meta = h("span", { class: "repmeta" }, `ধাপ ১ / ${steps.length}`);
  const foot = shell.layer(null, h("div", { class: "repbar" }, btn, meta));

  function show(i) {
    rows[i].classList.remove("hidden");
    rows[i].classList.add("shown");
    rows.forEach((r, j) => r.classList.toggle("top", j === i));
    if (i > 0) rows[i - 1].classList.remove("shown");
  }

  btn.addEventListener("click", () => {
    ctx.onScore(6, "rep");
    ctx.onRep();
    haptic();
    at += 1;
    if (at < steps.length) {
      show(at);
      meta.textContent = `ধাপ ${at + 1} / ${steps.length}`;
      if (at === steps.length - 1) btn.replaceChildren(document.createTextNode("🎙 পুরোটা বলো"));
    } else {
      foot.remove();
      audioLayer.style.display = "";
      ctx.onScore(10, "solve");
      shell.layer("অর্থ", bnBlock(item.sharp_bn) || h("span"));
      if (item.coach_bn) shell.layer("কোচ", h("p", { class: "coachline", html: item.coach_bn.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") }));
      shell.layer("শেষ ধাপ, তিনবার", repRow({ reps: 3, seconds, label: "শেষ ধাপ বলো", ctx, onDone: done }));
      shell.card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  show(0);
  return shell.card;
}

/** ["a","b","c"] → ["c", "b c", "a b c"] so the tail is learned first. */
function buildBackwardSteps(chunks) {
  return chunks.map((_, i) => chunks.slice(chunks.length - 1 - i).join(" "));
}

/**
 * Highlights only what this step added, so the eye lands on the one new clause.
 * A rung ends in a full stop that the next rung replaces with a comma, so the
 * previous text is matched without its trailing punctuation.
 */
function markAddition(text, prev, reversed) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  if (!prev) return esc(text);
  if (reversed && text.endsWith(prev)) {
    const add = text.slice(0, text.length - prev.length);
    return `<span class="add">${esc(add)}</span>${esc(prev)}`;
  }
  const core = prev.replace(/[.,;:!?]+$/, "");
  if (!reversed && core && text.startsWith(core)) {
    return `${esc(core)}<span class="add">${esc(text.slice(core.length))}</span>`;
  }
  return esc(text);
}

/* ========================================================= 4. frame swap */

function frameSwap(item, ctx, done) {
  const shell = cardShell(item);
  shell.layer("ছাঁচ", h("span", { class: "frame" }, item.frame));

  const fills = item.fills || [];
  let at = 0;

  const scene = h("span", { class: "scene" });
  const k = karaokeSentence(fills[0].sharp);
  const audioHost = h("div", {});
  const line = shell.layer(null, h("div", { class: "repbar" }, h("span", { class: "ltag", style: "margin:0" }, "ভরাট"), scene, h("span", { class: "fillcount mono" })), k.node, audioHost);
  line.classList.add("target");
  const counter = line.querySelector(".fillcount");

  const bnHost = shell.layer("অর্থ", h("div", {}));
  const btn = h("button", { class: "speak", type: "button" }, "🎙 বলো");
  const meta = h("span", { class: "repmeta" });
  shell.layer(null, h("div", { class: "repbar" }, btn, meta));

  let karaoke = k;
  function paint() {
    const f = fills[at];
    karaoke = karaokeSentence(f.sharp);
    line.replaceChild(karaoke.node, line.querySelector(".sharp"));
    audioHost.replaceChildren(audioRow(f.sharp, karaoke));
    scene.textContent = f.scene === "daily" ? "দৈনন্দিন" : "অফিস";
    scene.classList.toggle("daily", f.scene === "daily");
    counter.textContent = `${at + 1} / ${fills.length}`;
    bnHost.replaceChildren(h("span", { class: "ltag" }, "অর্থ"), bnBlock(f.sharp_bn) || h("span"));
    meta.textContent = at === fills.length - 1 ? "শেষ ভরাট" : `${fills.length - at - 1} টা বাকি`;
  }

  btn.addEventListener("click", () => {
    ctx.onScore(6, "rep");
    ctx.onRep();
    haptic();
    at += 1;
    if (at < fills.length) { paint(); }
    else {
      ctx.onScore(10, "solve");
      btn.disabled = true;
      btn.replaceChildren(document.createTextNode("✓ কার্ড শেষ"));
      if (item.coach_bn) shell.layer("কোচ", h("p", { class: "coachline", html: item.coach_bn.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") }));
      done();
    }
  });

  paint();
  return shell.card;
}

/* ========================================================== 5. if machine */

function ifMachine(item, ctx, done) {
  const shell = cardShell(item);
  if (item.raw) shell.layer("যা আসলে ঘটেছিল", rawLine(item.raw));

  const answer = item.tiles.join(" ");
  const picked = [];

  const line = h("div", { class: "slotline" }, h("span", { class: "ph" }, "টাইলগুলো সাজিয়ে হাইপোথেটিক্যাল বাক্যটা বানাও…"));
  const tray = h("div", { class: "tiles" });
  const zone = shell.layer("যদি-ভার্সন বানাও", line, tray);

  const tiles = shuffle(item.tiles).map((t) =>
    h("button", { class: "tile", type: "button", onclick: (e) => place(e.currentTarget, t) }, t)
  );
  tray.append(...tiles);

  function place(el, text) {
    el.classList.add("used");
    picked.push({ el, text });
    if (picked.length === 1) line.replaceChildren();
    const chip = h("button", { class: "tile placed", type: "button", onclick: () => undo(chip, el, text) }, text);
    line.append(chip);
    if (picked.length === item.tiles.length) check();
  }

  function undo(chip, el, text) {
    chip.remove();
    el.classList.remove("used");
    const i = picked.findIndex((p) => p.text === text && p.el === el);
    if (i >= 0) picked.splice(i, 1);
    line.classList.remove("no");
    if (!picked.length) line.append(h("span", { class: "ph" }, "টাইলগুলো সাজিয়ে হাইপোথেটিক্যাল বাক্যটা বানাও…"));
  }

  function check() {
    const built = picked.map((p) => p.text).join(" ");
    if (built === answer) {
      line.classList.add("ok");
      [...line.querySelectorAll(".tile")].forEach((b) => { b.disabled = true; });
      haptic();
      ctx.onScore(15, "solve");
      zone.querySelector(".ltag").textContent = "ঠিক আছে ✓";
      tray.remove();
      ending(shell, item, ctx, done);
      shell.card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      line.classList.add("no");
      ctx.onDamage(8);
      ctx.onMiss(item.id);
      setTimeout(() => line.classList.remove("no"), 400);
    }
  }

  return shell.card;
}

/* =============================================================== 6. boss */

/**
 * 4/3/2: tell the same story three times, each round shorter. Repetition under a
 * shrinking clock is what turns a rehearsed sentence into an automatic one.
 */
function boss(item, ctx, done) {
  const shell = cardShell(item);
  shell.layer("গল্পটা বলো", h("p", { class: "bossprompt" }, item.prompt_bn));

  const checks = (item.checklist || []).map((c) =>
    h("button", { class: "check", type: "button", "aria-pressed": "false" },
      h("span", { class: "box" }, "✓"), h("span", {}, c))
  );
  checks.forEach((b) => b.addEventListener("click", () => {
    const on = b.getAttribute("aria-pressed") === "true";
    b.setAttribute("aria-pressed", String(!on));
    if (!on) { ctx.onScore(8, "solve"); haptic(); }
  }));
  shell.layer("এগুলো ব্যবহার করতেই হবে — বলার সময় ট্যাপ করো", h("div", { class: "checklist" }, ...checks));

  const times = item.rounds || [60, 45, 30];
  let at = 0;
  const roundEls = times.map((s, i) =>
    h("div", { class: `round${i === 0 ? " now" : ""}` }, h("span", { class: "s mono" }, String(s)), "সেকেন্ড")
  );
  const bar = h("i", {});
  const timer = h("div", { class: "timer" }, bar);
  const btn = h("button", { class: "speak", type: "button" }, "🎙 রাউন্ড ১ শুরু");
  const meta = h("span", { class: "repmeta" }, "একই গল্প, প্রতিবার কম সময়ে");
  let running = false, tid = null;

  shell.layer("৪ / ৩ / ২", h("div", { class: "rounds" }, ...roundEls), timer,
    h("div", { class: "repbar", style: "margin-top:16px" }, btn, meta));

  btn.addEventListener("click", () => {
    if (!running) {
      running = true;
      timer.classList.remove("over");
      bar.style.animation = "none"; void bar.offsetWidth;
      bar.style.animation = `drain ${times[at]}s linear forwards`;
      tid = setTimeout(() => timer.classList.add("over"), times[at] * 1000);
      btn.classList.add("live");
      btn.replaceChildren(document.createTextNode("✓ বলা শেষ"));
      return;
    }
    clearTimeout(tid);
    const over = timer.classList.contains("over");
    running = false;
    bar.style.animation = "none";
    btn.classList.remove("live");
    roundEls[at].classList.remove("now");
    roundEls[at].classList.add("done");
    ctx.onScore(over ? 6 : 18, over ? "slow" : "rep");
    if (over) ctx.onDamage(6);
    ctx.onRep();
    haptic(over ? 24 : 12);
    at += 1;
    if (at < times.length) {
      roundEls[at].classList.add("now");
      btn.replaceChildren(document.createTextNode(`🎙 রাউন্ড ${at + 1} শুরু`));
      meta.textContent = `এবার ${times[at]} সেকেন্ডে`;
    } else {
      btn.disabled = true;
      btn.replaceChildren(document.createTextNode("✓ বস শেষ"));
      meta.textContent = "তিন রাউন্ড শেষ";
      if (item.model_en) {
        const k = karaokeSentence(item.model_en);
        shell.layer("মডেল উত্তর — মিলিয়ে নাও", k.node, audioRow(item.model_en, k)).classList.add("target");
      }
      if (item.coach_bn) shell.layer("কোচ", h("p", { class: "coachline", html: item.coach_bn.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") }));
      done();
    }
  });

  return shell.card;
}

/* ============================================================ dispatch */

export function renderCard(item, ctx, onDone) {
  switch (item.station) {
    case "time-machine": return timeMachine(item, ctx, onDone);
    case "ladder":       return progressive(item, ctx, onDone, { reversed: false });
    case "backward":     return progressive(item, ctx, onDone, { reversed: true });
    case "frame":        return frameSwap(item, ctx, onDone);
    case "if-machine":   return ifMachine(item, ctx, onDone);
    case "boss":         return boss(item, ctx, onDone);
    default:             return h("div", { class: "card" }, h("div", { class: "layer" }, `অজানা স্টেশন: ${item.station}`));
  }
}

export { STATION_META };
