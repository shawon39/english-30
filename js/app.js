// app.js — routing, home screen, settings.

import { h } from "./stations.js";
import { ico } from "./icons.js";
import * as store from "./store.js";
import * as audio from "./audio.js";
import { fetchSet, fetchIndex, probeSets, playSet, buildReview, buildMixed } from "./player.js";

const mount = document.getElementById("app");
let available = [];

/* ------------------------------------------------------------- theme */

function applyTheme() {
  const s = store.getSettings();
  const t = s.theme === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : s.theme;
  document.documentElement.dataset.theme = t;
  document.documentElement.dataset.motion = s.motion === "off" ? "off" : "on";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dark" ? "#0C0D10" : "#FFFFFF");
}

function toast(msg) {
  const t = h("div", { class: "toast" }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

/* ------------------------------------------------------------- chrome */

function topbar() {
  return h("div", { class: "topbar" },
    h("div", { class: "brand" }, ico("rewind", 22, "glyph"), h("span", {}, "রিপ্লে")),
    h("div", { class: "spacer" }),
    h("button", { class: "iconbtn", type: "button", "aria-label": "সেটিংস", onclick: openSettings }, ico("sliders", 19))
  );
}

const WORLD_ICON = {
  "standup-replay": "rewind",
  timeline: "contract",
  postmortem: "fork",
  proposal: "expand",
  meeting: "mic",
};

const setKey = (id) => String(id).padStart(3, "0");

/** A compact strip beats a hero: at zero it says the same thing in a fifth of the height. */
function statStrip(stats, streak) {
  const cell = (n, label, hot) =>
    h("div", { class: `stat3${hot ? " hot" : ""}` },
      h("div", { class: "n mono" }, n),
      h("div", { class: "k bn" }, label));
  return h("div", { class: "stats3" },
    cell(String(streak.current), "দিনের স্ট্রিক", streak.current > 0),
    cell(stats.reps.toLocaleString("en-US"), "মোট রেপ", stats.reps > 0),
    cell(stats.points.toLocaleString("en-US"), "পয়েন্ট", stats.points > 0));
}

function actionTile(icon, title, sub, hash) {
  return h("button", { class: "actiontile", type: "button", onclick: () => { location.hash = hash; } },
    ico(icon, 20, "ic"),
    h("span", {}, h("span", { class: "t" }, title), h("span", { class: "s" }, sub)),
    ico("right", 17, "chev"));
}

/** The next set to play: the first unplayed one, else whichever was played longest ago. */
function nextSetId(stats, ids) {
  const fresh = ids.find((id) => !stats.sets[setKey(id)]);
  if (fresh !== undefined) return fresh;
  return [...ids].sort((a, b) =>
    Date.parse(stats.sets[setKey(a)].at || 0) - Date.parse(stats.sets[setKey(b)].at || 0))[0];
}

/* --------------------------------------------------------------- home */

async function renderHome() {
  const stats = store.getStats();
  const streak = store.getStreak();
  const due = store.dueMistakes().length;
  const donePlaying = store.playedToday();

  const wrap = h("div", {}, topbar(), statStrip(stats, streak));

  if (!available.length) {
    try {
      available = await fetchIndex();
    } catch {
      // No manifest: fall back to probing and read each set file directly.
      const ids = await probeSets();
      available = (await Promise.all(ids.map((id) =>
        fetchSet(id).then((s) => ({ ...s, set: id })).catch(() => null)
      ))).filter(Boolean);
    }
  }

  if (!available.length) {
    wrap.append(h("div", { class: "note bn" }, "কোনো সেট পাওয়া গেল না। content/index.json আছে কি না দেখো।"));
    mount.replaceChildren(wrap);
    return;
  }

  const byId = new Map(available.map((s) => [s.set, s]));
  const ids = available.map((s) => s.set);
  const nextId = nextSetId(stats, ids);
  const next = byId.get(nextId);

  wrap.append(h("div", { class: "sectionlabel" },
    donePlaying ? ico("check", 14) : null,
    donePlaying ? "আজ শেষ — আরেকটা?" : "আজকের সেট"));

  if (next) {
    const rec = stats.sets[setKey(nextId)];
    const cards = next.cards ?? (next.stations || []).reduce((n, st) => n + (st.items?.length || 0), 0);
    wrap.append(
      h("button", { class: "setcard hero", type: "button", onclick: () => { location.hash = `#/set/${nextId}`; } },
        h("div", { class: "top" },
          ico(WORLD_ICON[next.world] || "frame", 16, "ic"),
          h("span", { class: "world mono" }, `সেট ${setKey(nextId)} · ${next.world_bn || next.world || ""}`),
          h("span", { class: `badge mono${rec ? " done" : ""}` }, rec ? `সেরা ${rec.best}` : "নতুন")
        ),
        h("div", { class: "body" },
          h("h2", {}, next.title_bn || `সেট ${setKey(nextId)}`),
          h("p", { class: "desc" }, next.desc_bn || ""),
          h("div", { class: "meta" },
            h("span", { class: "tag" }, `${cards} কার্ড`),
            h("span", { class: "tag" }, `~${next.minutes || 7} মিনিট`),
            ...(next.cheats || []).slice(0, 2).map((c) => h("span", { class: "tag accent" }, c))
          )
        ),
        h("div", { class: "go" }, h("span", { class: "bn" }, "শুরু করো"), ico("right", 17))
      )
    );
  }

  const playedIds = ids.filter((id) => stats.sets[setKey(id)]);
  const actions = h("div", { class: "actions" });
  if (due) {
    actions.append(actionTile("repeat", "রিভিউ", `${due}টা কার্ডে হোঁচট খেয়েছিলে`, "#/review"));
  }
  if (playedIds.length >= 2) {
    actions.append(actionTile("shuffle", "মিক্সড ড্রিল", `${playedIds.length}টা সেট থেকে ১২ কার্ড`, "#/mixed"));
  }
  if (actions.children.length) {
    wrap.append(h("div", { class: "sectionlabel" }, "আরও অনুশীলন"), actions);
  }

  // Twenty full-size cards is a scroll, not a screen. The rest live as a map.
  wrap.append(h("div", { class: "sectionlabel" }, `সব সেট`, h("span", { class: "count mono" }, `${ids.length}`)));
  const grid = h("div", { class: "setgrid" });
  ids.forEach((id) => {
    const set = byId.get(id);
    const rec = stats.sets[setKey(id)];
    const cls = `settile${rec ? " done" : ""}${id === nextId ? " now" : ""}`;
    grid.append(h("button", {
      class: cls, type: "button",
      title: `${set.title_bn || ""} · ${set.world_bn || ""}`,
      "aria-label": `সেট ${setKey(id)} — ${set.title_bn || ""}`,
      onclick: () => { location.hash = `#/set/${id}`; },
    }, ico(WORLD_ICON[set.world] || "frame", 17), h("span", { class: "n" }, setKey(id))));
  });
  wrap.append(grid);

  wrap.append(
    h("div", { class: "sectionlabel" }, "আরও"),
    h("div", { class: "rowlinks" },
      h("a", { class: "rowlink", href: "archive/" },
        ico("archive", 20, "ic"),
        h("span", { class: "t bn" }, "গ্রামার আর্কাইভ", h("small", {}, "পুরনো ৩৮ দিনের কোর্স — অক্ষত, প্রগ্রেসসহ")),
        ico("right", 18, "chev")
      ),
      h("button", { class: "rowlink", type: "button", onclick: doExport },
        ico("download", 20, "ic"),
        h("span", { class: "t bn" }, "প্রগ্রেস ব্যাকআপ", h("small", {}, "replay-progress.json নামিয়ে রাখো")),
        ico("right", 18, "chev")
      ),
      h("button", { class: "rowlink", type: "button", onclick: doImport },
        ico("upload", 20, "ic"),
        h("span", { class: "t bn" }, "ব্যাকআপ ফেরাও", h("small", {}, "অন্য ডিভাইস থেকে আনো")),
        ico("right", 18, "chev")
      )
    ),
    h("footer", { class: "foot" }, "প্রতিটা বাক্য তোমার নিজের VoiceInk ট্রান্সক্রিপ্ট থেকে নেওয়া।")
  );

  mount.replaceChildren(wrap);
}

/* -------------------------------------------------------------- set view */

async function renderSet(id) {
  mount.replaceChildren(h("div", { class: "loading bn" }, "সেট লোড হচ্ছে…"));
  let set;
  try {
    set = await fetchSet(id);
  } catch {
    mount.replaceChildren(topbar(), h("div", { class: "note bn" }, "এই সেটটা পাওয়া গেল না।"),
      h("button", { class: "btn", type: "button", onclick: () => { location.hash = "#/"; } }, "হোমে ফেরো"));
    return;
  }
  const host = h("div", {});
  mount.replaceChildren(host);
  playSet(host, set, {
    onExit: () => { location.hash = "#/"; },
    onFinish: () => { location.hash = "#/"; },
  });
}

/** Review and mixed drill are assembled on the fly rather than loaded from a file. */
async function renderSession(kind) {
  mount.replaceChildren(h("div", { class: "loading bn" }, "তৈরি হচ্ছে…"));
  let session = null;
  try {
    if (kind === "review") {
      session = await buildReview();
    } else {
      if (!available.length) {
        try { available = await fetchIndex(); } catch { available = []; }
      }
      const stats = store.getStats();
      const played = available.map((s) => s.set).filter((id) => stats.sets[setKey(id)]);
      session = await buildMixed(played);
    }
  } catch {
    session = null;
  }

  if (!session) {
    mount.replaceChildren(topbar(),
      h("div", { class: "note bn" }, kind === "review"
        ? "রিভিউ করার মতো কিছু নেই — কোথাও হোঁচট খাওনি।"
        : "মিক্সড ড্রিলের জন্য আগে অন্তত দুইটা সেট খেলো।"),
      h("button", { class: "btn", type: "button", onclick: () => { location.hash = "#/"; } }, "হোমে ফেরো"));
    return;
  }

  const host = h("div", {});
  mount.replaceChildren(host);
  playSet(host, session, {
    onExit: () => { location.hash = "#/"; },
    onFinish: () => { location.hash = "#/"; },
  });
}

/* ------------------------------------------------------------- settings */

function openSettings() {
  const s = store.getSettings();
  const scrim = h("div", { class: "scrim", onclick: close });

  const voiceSel = h("select", { "aria-label": "ভয়েস" });
  const rebuildVoices = () => {
    const ranked = audio.rankedVoices();
    voiceSel.replaceChildren(
      h("option", { value: "" }, ranked.length ? `সেরাটা নিজে বাছো (${ranked[0].name})` : "কোনো ইংরেজি ভয়েস নেই"),
      ...ranked.map((v) => h("option", { value: v.voiceURI, selected: v.voiceURI === s.voiceURI }, `${v.name} · ${v.lang}`))
    );
  };
  rebuildVoices();
  voiceSel.addEventListener("change", () => {
    audio.setVoice(voiceSel.value);
    audio.speak("If we had caught it earlier, the deploy would have been clean.", { rate: store.getSettings().rate });
  });

  const seg = (opts, val, onPick) => {
    const btns = opts.map(([v, label]) =>
      h("button", { type: "button", "aria-pressed": String(v === val) }, label));
    btns.forEach((b, i) => b.addEventListener("click", () => {
      btns.forEach((x, j) => x.setAttribute("aria-pressed", String(i === j)));
      onPick(opts[i][0]);
    }));
    return h("div", { class: "seg" }, ...btns);
  };

  const sheet = h("div", { class: "sheet", role: "dialog", "aria-label": "সেটিংস" },
    h("h3", { class: "bn" }, "সেটিংস"),

    h("div", { class: "field" },
      h("div", { class: "lbl bn" }, "থিম"),
      h("div", { class: "ctl" }, seg([["light", "লাইট"], ["dark", "ডার্ক"], ["system", "সিস্টেম"]], s.theme,
        (v) => { store.patchSettings({ theme: v }); applyTheme(); }))),

    h("div", { class: "field" },
      h("div", { class: "lbl bn" }, "বাংলা", h("small", {}, "চ্যালেঞ্জ মোডে অর্থ লুকানো থাকে")),
      h("div", { class: "ctl" }, seg([["always", "সবসময়"], ["challenge", "চ্যালেঞ্জ"]], s.bnMode,
        (v) => store.patchSettings({ bnMode: v })))),

    h("div", { class: "field" },
      h("div", { class: "lbl bn" }, "অডিও গতি"),
      h("div", { class: "ctl" }, seg([[0.75, "0.75×"], [1, "1×"], [1.25, "1.25×"]], s.rate,
        (v) => store.patchSettings({ rate: v })))),

    audio.supported ? h("div", { class: "field" },
      h("div", { class: "lbl bn" }, "ভয়েস", h("small", {}, "বদলালেই একটা নমুনা বাক্য বাজবে")),
      h("div", { class: "ctl" }, voiceSel)) : h("div", { class: "note bn" }, "এই ব্রাউজারে স্পিচ ইঞ্জিন নেই — অডিও বোতাম কাজ করবে না।"),

    h("div", { class: "field" },
      h("div", { class: "lbl bn" }, "ভাইব্রেশন"),
      h("div", { class: "ctl" }, seg([[true, "চালু"], [false, "বন্ধ"]], s.sound,
        (v) => store.patchSettings({ sound: v })))),

    h("div", { class: "field" },
      h("div", { class: "lbl bn" }, "অ্যানিমেশন"),
      h("div", { class: "ctl" }, seg([["on", "চালু"], ["off", "কম"]], s.motion,
        (v) => { store.patchSettings({ motion: v }); applyTheme(); }))),

    h("div", { style: "display:flex;gap:10px;margin-top:20px;flex-wrap:wrap" },
      h("button", { class: "btn", type: "button", onclick: close }, "ঠিক আছে"),
      h("button", {
        class: "btn ghost", type: "button",
        onclick: () => {
          if (!confirm("রিপ্লে-র সব প্রগ্রেস মুছে যাবে। আর্কাইভের পুরনো প্রগ্রেস অক্ষত থাকবে। চালিয়ে যাবে?")) return;
          store.resetAll(); close(); applyTheme(); renderHome(); toast("রিসেট হয়ে গেছে");
        }
      }, "রিসেট")
    )
  );

  function close() { scrim.remove(); sheet.remove(); document.removeEventListener("keydown", onKey); }
  function onKey(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onKey);
  document.body.append(scrim, sheet);
  audio.loadVoices().then(rebuildVoices);
}

/* --------------------------------------------------------- export/import */

function doExport() {
  const blob = new Blob([JSON.stringify(store.exportAll(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: "replay-progress.json" });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("ব্যাকআপ নামানো হলো");
}

function doImport() {
  const input = h("input", { type: "file", accept: "application/json,.json", style: "display:none" });
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      store.importAll(JSON.parse(await file.text()));
      applyTheme(); renderHome(); toast("ব্যাকআপ ফেরানো হলো");
    } catch (err) {
      toast(`ফেরানো গেল না — ${err.message}`);
    } finally { input.remove(); }
  });
  document.body.append(input); input.click();
}

/* --------------------------------------------------------------- router */

function route() {
  audio.stop();
  if (location.hash.startsWith("#/review")) return renderSession("review");
  if (location.hash.startsWith("#/mixed")) return renderSession("mixed");
  const m = location.hash.match(/^#\/set\/(\d+)/);
  if (m) return renderSet(Number(m[1]));
  return renderHome();
}

applyTheme();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (store.getSettings().theme === "system") applyTheme();
});
audio.loadVoices();
addEventListener("hashchange", route);
route();
