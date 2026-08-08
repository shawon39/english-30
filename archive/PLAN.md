# English 30 — Planning File

A **30-day, 100-session** grammar drilling game. Fixes fast-speech mistakes in **tenses, conditionals, modals**. **English-first**, Bangla only when a point needs it. Static site on **GitHub Pages**. **Tap-first, almost no typing.** Feels like a game, not homework.

---

## Quick facts

| Item | Value |
|---|---|
| Duration | **30 days** |
| Themes | **30** (one per day) |
| Sessions | **100** |
| Sessions / normal day | **3** |
| Sessions / heavy day | **4** (10 such days) |
| Items / session | **~10** |
| Generation | **10 shots**, each a 3-day block = **10 sessions** |
| Level | **B1+ to B2** |
| Language | English primary. Bangla = optional clarifier. |
| Typing | Minimal. Tap to answer. |
| Host | GitHub Pages (static) |
| Stack | Vanilla HTML + CSS + ES modules. No build. |

Math: `20 days × 3` + `10 days × 4` = **100**.

---

## Where data lives (read this)

| Data | Stored where | Safe? | Who updates it |
|---|---|---|---|
| **Content** (1000 items) | JSON files in repo `/content` | Yes, versioned | You, via commits |
| **Progress / streak / points** | Browser **localStorage** | Survives refresh, not a browser wipe | The app, automatically |
| **Backup of progress** | `progress.json` you **export** | Yes, you keep the file | You, on demand |

**GitHub Pages cannot save your progress.** It only serves files. Progress is browser-side. The **Export / Import** button is your safety net: download `progress.json`, re-import to restore or move to another device. No backend anywhere.

---

## Generation: your 10 shots

Each shot is a **3-day block** producing exactly **10 sessions**. Run shot, drop 3 files into `/content`, commit, push. Pages reflects it. The app shows future days as **locked** until their file exists, so adding content incrementally just works.

| Shot | Days | 4-session day in block | Sessions |
|---|---|---|---|
| 1 | 1-3 | Day 2 ★ | 10 |
| 2 | 4-6 | Day 6 | 10 |
| 3 | 7-9 | Day 9 ★ | 10 |
| 4 | 10-12 | Day 10 | 10 |
| 5 | 13-15 | Day 13 ★ | 10 |
| 6 | 16-18 | Day 17 | 10 |
| 7 | 19-21 | Day 21 | 10 |
| 8 | 22-24 | Day 23 ★ | 10 |
| 9 | 25-27 | Day 27 | 10 |
| 10 | 28-30 | Day 30 | 10 |

**Your loop:** `Shot 1` → commit "add days 1-3" → `Shot 2` → commit "add days 4-6" → ... → `Shot 10`. Append only. Nothing to wire up between commits.

---

## Curriculum (30 themes)

★ = your fast-speech weak spots. **(4)** = heavy day, 4 sessions.

### Tenses (Days 1-10)
| Day | Theme |
|---|---|
| 1 | Present Simple vs Present Continuous |
| 2 ★ **(4)** | Past Simple vs Present Perfect |
| 3 | Present Perfect vs Present Perfect Continuous |
| 4 | Past Simple vs Past Continuous |
| 5 | Past Perfect (sequencing) |
| 6 **(4)** | Future: will / going to / present continuous |
| 7 | Future Perfect & Continuous |
| 8 | used to / would |
| 9 ★ **(4)** | Reported speech (backshift) |
| 10 **(4)** | Tense review (timed) |

### Conditionals (Days 11-17)
| Day | Theme |
|---|---|
| 11 | Zero & First conditional |
| 12 | Second conditional |
| 13 ★ **(4)** | Third conditional |
| 14 | Mixed conditionals |
| 15 | wish / if only |
| 16 | unless / as long as / provided that |
| 17 **(4)** | Conditionals review |

### Modals (Days 18-27)
| Day | Theme |
|---|---|
| 18 | can / could / be able to |
| 19 | must / have to / need to |
| 20 | should / ought to / had better |
| 21 **(4)** | may / might / could (possibility) |
| 22 | Deduction present (must be / can't be) |
| 23 ★ **(4)** | Deduction past ("it could have happened") |
| 24 | would (habit, polite, hypothetical) |
| 25 | Permission & requests |
| 26 | Semi-modals (be supposed to, be going to) |
| 27 **(4)** | Modals review |

### Applied + Mastery (Days 28-30)
| Day | Theme |
|---|---|
| 28 | Work English: standups, code reviews, Jira |
| 29 ★ | Your fast-speech error patterns (targeted) |
| 30 **(4)** | Final boss: mixed timed exam |

---

## Session model (tap-first)

| Session | What | Goal |
|---|---|---|
| **S1 — Spot the Error** | `error-find` ×10 | tap the wrong word, tap the fix |
| **S2 — Choose & Fill** | `mcq` + `fill-bank` ×10 | recognize the right form |
| **S3 — Build It** | `build` ×8 + `speak` ×2 (optional) | assemble correct sentences |
| **S4 — Mixed Drill** (heavy days) | all 4 types shuffled, timed | prove mastery |

Each item: short English prompt, instant correct/wrong feedback, one-line explanation. Bangla note shows only on hard items.

---

## Exercise types (no forced writing)

| Type | Learner action | Typing? | Checked |
|---|---|---|---|
| `mcq` | tap the correct option | none | exact |
| `error-find` | tap the wrong word, then tap the correct replacement | none | exact |
| `fill-bank` | tap a chip to fill the `___` | none | exact |
| `build` | tap word tiles in the right order | none | exact order |
| `speak` *(optional, skippable)* | say it out loud, reveal model answer, self-mark | none | self |

No exact-match-on-typed-text problem, because nothing is typed. `speak` is always skippable. Optional "type it" advanced mode can come later if you ever want it.

### Tiny examples
- `error-find`: **"She go to the office every day."** → tap `go` → choose `goes`.
- `fill-bank`: **"I ___ my code right now."** → chips: `test` / `am testing` / `tested` → tap `am testing`.
- `build`: tiles `If` `you` `had` `called` `me` `,` `I` `would` `have` `helped` `you` `.` → tap into order.

---

## Content schema (v2.0, tap-first)

One file per day: `content/day-01.json` ... `day-30.json`. **Pin `schemaVersion`.**

```json
{
  "schemaVersion": "2.0",
  "day": 1,
  "theme": "Present Simple vs Present Continuous",
  "pillar": "tense",
  "star": false,
  "rule_en": "Present simple = habits and facts. Present continuous = happening now.",
  "rule_bn": "",
  "sessions": [
    {
      "id": "d01s1",
      "title": "Spot the Error",
      "type": "error-find",
      "instruction_en": "Tap the wrong word, then choose the fix.",
      "items": [
        {
          "id": "d01s1i1",
          "type": "error-find",
          "prompt_en": "She go to the office every day.",
          "tokens": ["She","go","to","the","office","every","day"],
          "error_index": 1,
          "options": ["goes","is going","went"],
          "answer": "goes",
          "explain_en": "Habit takes present simple; add -s for he/she/it.",
          "explain_bn": ""
        }
      ]
    }
  ]
}
```

### Field reference

| Field | Level | Type | Notes |
|---|---|---|---|
| `schemaVersion` | day | string | freeze it: `"2.0"` |
| `day` | day | int | 1-30 |
| `theme` `pillar` `star` | day | — | from curriculum; pillar = `tense`/`conditional`/`modal`/`applied`/`mastery` |
| `rule_en` | day | string | one line, shown in S1 |
| `rule_bn` | day | string | optional, `""` if not needed |
| `session.type` | session | enum | `error-find` / `mcq` / `fill-bank` / `build` / `speak` / `mixed` |
| `item.type` | item | enum | same set (lets `mixed` shuffle types) |
| `prompt_en` | item | string | the sentence; `___` marks the blank |
| `options` | item | string[] | choices for `mcq`, `fill-bank`, and the fix list for `error-find` |
| `tokens` | item | string[] | words of the sentence (`error-find` only) |
| `error_index` | item | int | index in `tokens` of the wrong word (`error-find` only) |
| `tiles` | item | string[] | words to reorder (`build` only); engine shuffles them |
| `answer` | item | string | correct option, or correct word order (space-joined) for `build` |
| `model_en` | item | string | `speak` only; the sample sentence |
| `explain_en` | item | string | one line, required (except `speak`) |
| `explain_bn` | item | string | optional, `""` if not needed |

---

## AI generation prompt (frozen)

Paste into your script. Fill the block placeholders per shot. **English-first. Bangla only when truly needed.**

```
You generate JSON for a tap-first English grammar drilling game.
Learner: native Bangla, level B1+ to B2. Output is read by code, not a human.

OUTPUT RULES (strict):
- Return ONLY valid JSON, schemaVersion "2.0". No markdown, no backticks, no commentary.
- ENGLISH FIRST. Set explain_bn and rule_bn to "" UNLESS a point is genuinely hard for a Bangla speaker; only then add a short, natural Bengali-script note. Never transliterate.
- English examples tie to Salesforce engineering, career, or daily life.
- Level B1+ to B2: clear, useful, not childish, not academic.
- Each session has exactly 10 items. Keep prompts SHORT.
- NO typed-answer exercises. Use only these item types:
  - error-find: prompt_en has EXACTLY ONE error for {THEME}. Give tokens[] (the sentence split into words), error_index (the wrong word), options[] (3 fixes incl. correct), answer (correct fix).
  - mcq: prompt_en is a sentence with ___ or a short question. options[] has 4, answer is the correct option text exactly.
  - fill-bank: prompt_en has ___ ; options[] are 3 chips; answer is the correct chip.
  - build: tiles[] are the words (and punctuation) of one correct sentence in scrambled order; answer is the correct sentence as a space-joined string of those tiles.
  - speak (optional): prompt_en asks the learner to say a sentence; model_en is a sample; no answer.
- explain_en: ONE line. explain_bn: "" by default.

GLOSSARY (keep identical every shot, extend as you go):
- present simple / continuous / perfect → keep in English
- habit → অভ্যাস ; possibility → সম্ভাবনা ; obligation → বাধ্যবাধকতা ; deduction → অনুমান

GENERATE A 3-DAY BLOCK as a JSON array of 3 day objects:
{DAYS_AND_THEMES_FOR_THIS_SHOT}

Session plan per day:
- normal day (3 sessions): S1 error-find, S2 mcq+fill-bank, S3 build (+ up to 2 speak)
- heavy day (4 sessions): add S4 mixed (all 4 tap types shuffled, no rule shown)
```

### Workflow
1. For each shot, fill `{DAYS_AND_THEMES_FOR_THIS_SHOT}` from the shot table.
2. Save each day object to `content/day-NN.json`.
3. **Validate**: reject any file with missing fields or item count != 10.
4. **Spot-check** the few Bangla notes that appear. Keep the glossary identical across all 10 shots.
5. Commit, push, done.

---

## Tech & folder structure

Vanilla, no build step. `git push` deploys.

```
/
├── index.html
├── PLAN.md
├── css/
│   ├── tokens.css      # colors, fonts, spacing (design system)
│   └── app.css         # components, layout, motion
├── js/
│   ├── app.js          # hash routing, view switching
│   ├── curriculum.js   # all 30 themes + metadata (renders the map with zero fetches)
│   ├── engine.js       # session player, scoring, points, streak
│   ├── render.js       # one renderer per tap type
│   └── storage.js      # localStorage, export/import, reset
├── content/
│   └── day-01.json ...
└── assets/ (fonts, icons)
```

**Incremental loading:** all 30 themes live in `curriculum.js`, so the home map renders instantly. A day's content is fetched **only when you open it**. Missing file → that day shows **Locked / coming soon**. No manifest to maintain.

---

## What you see (dashboard / home)

The home page is the control center. Everything visible, everything short.

- **Streak ring** — current streak, "don't break the chain."
- **Focus bar** — overall progress, e.g. `34 / 100 sessions`.
- **Points / XP** — earned from correct answers; combo multiplier for answer streaks inside a session.
- **30-day map** — game-style level select. Each day: done ✓ / current / locked. Tap to enter.
- **Missed-days note** — if you skip days, a gentle line: "You missed 8 days. Pick up at Day 12." No punishment.
- **Reset button** — wipes progress, confirms first, lets you start the challenge clean.
- **Export / Import** — back up or restore `progress.json`.

**Session flow:** one item on screen → tap answer → instant feedback (green pulse or soft shake + one-line why) → next. Finish 10 → quick celebration (tasteful), points tally, streak updates. The "one more session" feeling is the point.

---

## Progress data model (localStorage)

| Key | Shape |
|---|---|
| `eng30:v2:progress` | `{ "d01s1": { done, correct, total, best, attempts, lastAt }, ... }` |
| `eng30:v2:streak` | `{ current, longest, lastActiveISO, daysDone: [1,2,...] }` |
| `eng30:v2:points` | `{ total, byDay: {...} }` |
| `eng30:v2:settings` | `{ lang: "en" \| "bn" \| "both", sound, reduceMotion }` |

**Reset** clears all `eng30:v2:*` keys. **Streak/missed** computed from `lastActiveISO` on load.

---

## UI design — "Ledger": calm but rewarding

Premium and focused, with satisfying micro-rewards. Not loud, not childish. Bold single accent, generous space, one item at a time.

### Type (distinctive on purpose — no Inter/Roboto/system)
| Role | Font |
|---|---|
| Display (titles, prompts) | **Fraunces** |
| Body (UI) | **Hanken Grotesk** |
| Mono (scores, day labels, tiles) | **JetBrains Mono** |
| Bangla (when shown) | **Hind Siliguri** |

### Color tokens (dark-first, tweak freely)
```css
:root{
  --ink:#14110E; --surface:#1E1A16; --cream:#F4EEE3;
  --muted:#A39B8C; --accent:#E8B04B;   /* streak, points, highlights */
  --correct:#7BC47F; --wrong:#E07A5F;   /* feedback only */
  --line:#2E2922;
}
```
Dominant warm ink + cream, **one** sharp accent (amber). Green/coral appear only at the feedback moment.

### Motion (CSS-only, light)
- Session load: cards reveal staggered (40ms apart).
- Correct: green pulse + small scale. Combo: accent flares.
- Wrong: short shake, then the explanation slides in.
- Session complete: brief confetti or a satisfying check, points count up.
- Streak ring fills. Keep it efficient; respect `reduceMotion`.

### Layout
- **Drill view:** centered column, max **640px**, one item at a time.
- **Home:** streak ring + focus bar + points up top, 30-day map below.
- Tap targets large. Built for phone and desktop.

---

## Roadmap

| Phase | Output |
|---|---|
| **0** | Repo + this plan + schema + design tokens (now) |
| **1** | Engine + UI shell + **Day 1 by hand** to validate schema and feel |
| **2** | Run shots 1-10, append day files, spot-check Bangla |
| **3** | Polish: points, combos, celebration, streak, export/import, reduce-motion |
| **4** | Deploy to GitHub Pages |

**Build Day 1 by hand first.** It proves the schema and the fun before you generate 1000 items.

---

## Definition of done (per session)

- 10 items, each with `answer` (or `model_en` for speak) and one-line `explain_en`.
- Renders for its type, scores, saves to localStorage.
- Any Bangla note is natural and correct (spot-checked).

---

## Decisions & risks

1. **Progress can't live in the repo.** Static site = no write-back. localStorage + export/import is the answer.
2. **Bangla quality is the main content risk.** Mitigated by English-first (less Bangla = less drift) + frozen prompt + glossary + spot-check.
3. **Schema drift across 10 shots.** Mitigated by pinned `schemaVersion "2.0"` + a validation gate.
4. **No forced typing.** All tap-based, so no false-reject problem; `speak` is skippable.
5. **No over-engineering.** Vanilla, no framework, no backend, one user.
