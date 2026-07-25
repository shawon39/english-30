// render.js — one renderer per tap type. Each returns a DOM element and calls
// onResult(isCorrect, skipped?) exactly once when the item is resolved.

import { getSettings } from "./storage.js";

// Tiny DOM helper. Shared across modules.
export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k === "dataset") Object.assign(e.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return e;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showBn() {
  const l = getSettings().lang;
  return l === "bn" || l === "both";
}

function explainBlock(item) {
  const wrap = h("div", { class: "explain" });
  if (item.explain_en) wrap.append(h("p", { class: "explain-en" }, item.explain_en));
  if (showBn() && item.explain_bn) wrap.append(h("p", { class: "explain-bn" }, item.explain_bn));
  return wrap;
}

// --- audio cue (gated by settings.sound) ---
let actx;
export function beep(ok) {
  try {
    if (!getSettings().sound) return;
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.connect(g); g.connect(actx.destination);
    o.type = "sine";
    o.frequency.value = ok ? 660 : 180;
    g.gain.value = 0.05;
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.18);
    o.stop(actx.currentTime + 0.2);
  } catch {}
}

// --- dispatch on the ITEM type (so `mixed` sessions work too) ---
export function renderItem(item, onResult) {
  switch (item.type) {
    case "error-find": return renderErrorFind(item, onResult);
    case "mcq":        return renderMCQ(item, onResult);
    case "fill-bank":  return renderFillBank(item, onResult);
    case "build":      return renderBuild(item, onResult);
    case "speak":      return renderSpeak(item, onResult);
    default:           return renderUnsupported(item, onResult);
  }
}

function markCorrectOption(container, answer) {
  [...container.children].forEach((c) => {
    if (c.textContent === answer) c.classList.add("correct");
  });
}

function renderMCQ(item, onResult) {
  const card = h("div", { class: "item item-mcq" });
  card.append(h("p", { class: "prompt" }, item.prompt_en));
  const opts = h("div", { class: "options" });
  let done = false;
  shuffle(item.options || []).forEach((opt) => {
    const b = h("button", { class: "opt", type: "button", onClick: () => {
      if (done) return; done = true;
      const ok = opt === item.answer;
      b.classList.add(ok ? "correct" : "wrong");
      if (!ok) markCorrectOption(opts, item.answer);
      opts.classList.add("locked");
      card.append(explainBlock(item));
      onResult(ok);
    } }, opt);
    opts.append(b);
  });
  card.append(opts);
  return card;
}

function renderFillBank(item, onResult) {
  const card = h("div", { class: "item item-fill" });
  const parts = (item.prompt_en || "").split("___");
  const slot = h("span", { class: "slot" }, "_____");
  const p = h("p", { class: "prompt" });
  p.append(parts[0] || "", slot, parts[1] || "");
  card.append(p);
  const chips = h("div", { class: "chips" });
  let done = false;
  shuffle(item.options || []).forEach((opt) => {
    const c = h("button", { class: "chip", type: "button", onClick: () => {
      if (done) return; done = true;
      const ok = opt === item.answer;
      slot.textContent = opt;
      slot.classList.add(ok ? "correct" : "wrong");
      c.classList.add(ok ? "correct" : "wrong");
      if (!ok) markCorrectOption(chips, item.answer);
      chips.classList.add("locked");
      card.append(explainBlock(item));
      onResult(ok);
    } }, opt);
    chips.append(c);
  });
  card.append(chips);
  return card;
}

function renderErrorFind(item, onResult) {
  const card = h("div", { class: "item item-error" });
  const hint = h("p", { class: "subhint" }, "Tap the word that is wrong.");
  card.append(hint);
  const sent = h("div", { class: "tokens" });
  let phase = 1, done = false;
  (item.tokens || []).forEach((tok, idx) => {
    const t = h("button", { class: "token", type: "button", onClick: () => {
      if (phase !== 1) return;
      if (idx === item.error_index) {
        t.classList.add("found");
        phase = 2;
        hint.textContent = "Now tap the correct fix.";
        showFixes();
      } else {
        t.classList.add("miss");
        setTimeout(() => t.classList.remove("miss"), 420);
      }
    } }, tok);
    sent.append(t);
  });
  card.append(sent);
  const fixWrap = h("div", { class: "options" });
  card.append(fixWrap);

  function showFixes() {
    shuffle(item.options || []).forEach((opt) => {
      const b = h("button", { class: "opt", type: "button", onClick: () => {
        if (done) return; done = true;
        const ok = opt === item.answer;
        b.classList.add(ok ? "correct" : "wrong");
        if (!ok) markCorrectOption(fixWrap, item.answer);
        fixWrap.classList.add("locked");
        card.append(explainBlock(item));
        onResult(ok);
      } }, opt);
      fixWrap.append(b);
    });
  }
  return card;
}

function renderBuild(item, onResult) {
  const card = h("div", { class: "item item-build" });
  card.append(h("p", { class: "subhint" }, "Tap the tiles in the right order."));
  const answer = h("div", { class: "build-answer" });
  const bank = h("div", { class: "build-bank" });
  let done = false;

  function makeTile(word, where) {
    return h("button", { class: "tile", type: "button", onClick: (e) => {
      if (done) return;
      const btn = e.currentTarget;
      btn.remove();
      if (where === "bank") answer.append(makeTile(word, "answer"));
      else bank.append(makeTile(word, "bank"));
      updateCheck();
    } }, word);
  }

  shuffle(item.tiles || []).forEach((w) => bank.append(makeTile(w, "bank")));

  const check = h("button", { class: "btn check", type: "button", disabled: true, onClick: () => {
    if (done) return; done = true;
    const guess = [...answer.children].map((c) => c.textContent).join(" ");
    const ok = guess === item.answer;
    answer.classList.add(ok ? "correct" : "wrong");
    if (!ok) card.append(h("div", { class: "correct-line" }, "Correct: " + item.answer));
    card.append(explainBlock(item));
    check.remove();
    onResult(ok);
  } }, "Check");

  function updateCheck() { check.disabled = bank.children.length !== 0; }

  card.append(answer, bank, check);
  return card;
}

function normalizeForCheck(s) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.!?,;:]+$/g, "")
    .replace(/\s+/g, " ");
}

// Contractions expanded so "hadn't" and "had not" both count as the same answer.
function canonical(s) {
  return normalizeForCheck(s)
    .replace(/\bcan't\b/g, "can not")
    .replace(/\bwon't\b/g, "will not")
    .replace(/\bshan't\b/g, "shall not")
    .replace(/n't\b/g, " not")
    .replace(/'d better\b/g, "had better")
    .replace(/'m\b/g, " am")
    .replace(/'re\b/g, " are")
    .replace(/'ve\b/g, " have")
    .replace(/'ll\b/g, " will")
    .replace(/\s+/g, " ")
    .trim();
}
const sameAnswer = (a, b) => canonical(a) === canonical(b);

// Splits model_en into text/blank alternating parts for the given spans.
function clozeParts(model, spans) {
  const parts = [];
  let rest = model;
  for (const sp of spans) {
    const i = rest.indexOf(sp);
    if (i < 0) return null;
    parts.push({ text: rest.slice(0, i) }, { blank: sp });
    rest = rest.slice(i + sp.length);
  }
  parts.push({ text: rest });
  return parts;
}

// Cloze production: type only the span that carries the grammar.
function renderCloze(item, onResult, parts) {
  const card = h("div", { class: "item item-speak" });
  card.append(h("p", { class: "subhint" }, item.prompt_en));

  const sent = h("p", { class: "cloze-sentence" });
  const inputs = [];
  parts.forEach((p) => {
    if (p.text != null) { sent.append(document.createTextNode(p.text)); return; }
    const inp = h("input", {
      class: "cloze-blank", type: "text", autocapitalize: "none", autocomplete: "off",
      spellcheck: "false", "aria-label": "missing words",
    });
    inp.style.width = `${Math.max(5, p.blank.length + 1)}ch`;
    inp.dataset.answer = p.blank;
    inputs.push(inp);
    sent.append(inp);
  });
  card.append(sent);

  const submit = h("button", { class: "btn", type: "button", disabled: true }, "Check");
  const skip = h("button", { class: "btn ghost", type: "button" }, "Skip");
  card.append(h("div", { class: "speak-acts" }, submit, skip));

  let done = false;
  const filled = () => inputs.every((i) => i.value.trim());
  inputs.forEach((i) => i.addEventListener("input", () => { submit.disabled = !filled(); }));
  inputs.forEach((i, n) => i.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (n < inputs.length - 1) inputs[n + 1].focus();
    else if (filled()) submit.click();
  }));

  skip.onclick = () => { if (done) return; done = true; onResult(true, true); };

  submit.onclick = () => {
    if (done || !filled()) return;
    submit.remove(); skip.remove();
    let allOk = true;
    inputs.forEach((inp) => {
      const ok = sameAnswer(inp.value, inp.dataset.answer);
      if (!ok) allOk = false;
      inp.disabled = true;
      inp.classList.add(ok ? "correct" : "wrong");
      if (!ok) inp.style.width = `${Math.max(5, inp.value.trim().length + 1)}ch`;
    });

    const result = h("div", { class: "speak-result" },
      h("p", { class: "model" }, h("span", { class: "tag" }, "Full sentence "), item.model_en || "")
    );
    const mark = h("div", { class: "self-mark" });
    const good = h("button", { class: `opt${allOk ? " suggested" : ""}`, type: "button" }, "Correct ✓");
    const bad = h("button", { class: `opt${!allOk ? " suggested" : ""}`, type: "button" }, "Not quite");
    good.onclick = () => { if (done) return; done = true; card.append(explainBlock(item)); onResult(true); };
    bad.onclick = () => { if (done) return; done = true; card.append(explainBlock(item)); onResult(false); };
    mark.append(good, bad);
    result.append(mark);
    card.append(result);
    (allOk ? good : bad).focus();
  };

  return card;
}

function renderSpeak(item, onResult) {
  // Prefer cloze production — typing only the load-bearing span beats retyping
  // the whole sentence. Falls back to full-sentence typing if spans are missing.
  if (Array.isArray(item.cloze) && item.cloze.length) {
    const parts = clozeParts(item.model_en || "", item.cloze);
    if (parts) return renderCloze(item, onResult, parts);
  }

  const card = h("div", { class: "item item-speak" });
  card.append(h("p", { class: "prompt" }, item.prompt_en));

  const input = h("textarea", { class: "speak-input", rows: 2, placeholder: "Type the sentence you'd say…" });
  const submit = h("button", { class: "btn", type: "button", disabled: true }, "Check");
  const skip = h("button", { class: "btn ghost", type: "button" }, "Skip");
  input.addEventListener("input", () => { submit.disabled = !input.value.trim(); });
  card.append(input, h("div", { class: "speak-acts" }, submit, skip));

  let done = false;
  skip.onclick = () => { if (done) return; done = true; onResult(true, true); };

  submit.onclick = () => {
    if (done) return;
    const typed = input.value.trim();
    if (!typed) return;
    input.disabled = true;
    submit.remove();
    skip.remove();

    const auto = sameAnswer(typed, item.model_en || "");
    const result = h(
      "div",
      { class: "speak-result" },
      h("p", { class: "you-said" }, h("span", { class: "tag" }, "You said "), typed),
      h("p", { class: "model" }, h("span", { class: "tag" }, "Model "), item.model_en || "")
    );
    const mark = h("div", { class: "self-mark" });
    const good = h("button", { class: `opt${auto ? " suggested" : ""}`, type: "button" }, "Correct ✓");
    const bad = h("button", { class: `opt${!auto ? " suggested" : ""}`, type: "button" }, "Not quite");
    good.onclick = () => { if (done) return; done = true; onResult(true); };
    bad.onclick = () => { if (done) return; done = true; onResult(false); };
    mark.append(good, bad);
    result.append(mark);
    card.append(result);
  };

  return card;
}

function renderUnsupported(item, onResult) {
  const card = h("div", { class: "item" });
  card.append(h("p", { class: "prompt" }, item.prompt_en || "(unsupported item)"));
  card.append(h("button", { class: "btn", type: "button", onClick: () => onResult(true, true) }, "Skip"));
  return card;
}
