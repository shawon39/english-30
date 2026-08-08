# জিভ — Tongue Gym (v3 redesign proposal)

> Status: **proposal only.** No existing file has been changed. Awaiting three decisions (bottom).

Replaces the "30-day grammar course" framing of [PLAN.md](PLAN.md) with a personalized
fluency gym built from the user's own VoiceInk transcripts.

---

## 1. Diagnosis — measured, not assumed

Source: `VoiceInk-transcription.csv` — 466 recordings, 20,127 words, ~195 minutes
(30 Jul – 6 Aug 2026).

**Textbook grammar errors the current content drills, and how often they actually occur:**

| Drilled in `day-29.json` | Actual occurrences |
|---|---|
| `didn't went` | 0 |
| `he/she don't` | 0 |
| `since two years` | 0 |
| `I am knowing` (stative) | 0 |
| `said me` / `could able to` | 0 |

The grammar is not the problem. **Delivery is.**

**What actually degrades the speech:**

| Pattern | Count | Rate |
|---|---|---|
| `so` | 462 | 1 per 44 words |
| `okay` | 270 | |
| `like` | 215 | |
| `just` | 171 | |
| `maybe` | 134 | |
| `thing` / `things` | 130 | |
| `give me` | 86 | |
| `you know` | 74 | |
| `everything` | 65 | |
| `something` | 59 | |
| **All fillers** | ~1,374 | **1 per 15 words** |
| Restart / repair loops | 148 lines | |
| Immediate word repeats | 90 | |

Representative restart loop, verbatim:

> "Even he doesn't know the— even though he doesn't know the— even though he doesn't
> know the even though he doesn't have the permission…"

This is a timing problem, not a knowledge problem. Timing is fixed by reps, not rules.

---

## 2. What changes

| Now | v3 |
|---|---|
| Day 1 … Day 38, locked | Today's **set**. No locks, no syllabus |
| Theme: "Second Conditional" | Station: "Filler Hunt", "One Breath" |
| `rule_en` grammar header | Removed entirely |
| `explain_en` grammar note | `coach_bn` — why the sharp version is stronger |
| Tap to answer | **Speak first**; tap is backup |
| Correct / Wrong | Fluency score: fillers dropped, seconds taken |
| Invented textbook sentences | **The user's own recorded lines** |
| `34 / 100 sessions` | Gym log: `1,240 reps` |

The core switch: sentences come from his own mouth, not from a generator.

---

## 3. The card pattern — কাঁচা → পাকা → রেপ (raw → sharp → rep)

Six layers, always the same order:

| Layer | Content |
|---|---|
| **কাঁচা** (raw) | His actual line, verbatim, date-stamped. Fillers highlighted red |
| **ড্যামেজ** | Filler counts and restart count, as a scoreboard |
| **পাকা** (sharp) | Same meaning, sharp English. Large type — this is the target |
| **অর্থ** | Bangla meaning |
| **কোচ** | One Banglish line: why the sharp version has more power |
| **রেপ** | Say it 3× against a timer. Three pips fill, card done |

### Worked example

- **RAW** (6 Aug): "So can you just give me an audit and tell me your result about it?"
- **DAMAGE**: `So ×1`, `just ×1`, `give me ×1` — "give me" appears 86× overall
- **SHARP**: "Run an audit and walk me through what you find."
- **BN**: একটা অডিট চালাও, আর কী পেলে সেটা আমাকে ধরে ধরে বুঝিয়ে বলো।
- **COACH**: "give me" = ভিক্ষা। "run / walk me through" = ownership. একই রিকোয়েস্ট, কিন্তু দ্বিতীয়টায় তুমি লিড করছো।
- **REP**: 3 reps, target 4s

No grammar terminology appears anywhere on the card.

---

## 4. Six stations (one set ≈ 5–7 min)

| Station | Trains | Targets |
|---|---|---|
| 🔥 **জিভ গরম** — tongue twister | articulation, 30s warm-up | `v/b`, `th`, `z`, `s/sh`, `r/l`, `sp-st-sk` clusters, built from his own domain words |
| 🎯 **ফিলার শিকার** — filler hunt | tap every filler dead against a timer, then say it clean | so 462, okay 270, like 215, just 171 |
| 💎 **ধোঁয়াশা → ধারালো** — vague → sharp | pick the real noun instead of "thing" | thing 130, everything 65, something 59 |
| ⚡ **give me → ?** — verb upgrade | `run` / `walk me through` / `pull up` / `draft` / `flag` | give me 86 |
| 🫁 **এক দমে** — one breath | full sentence, one breath, no restart; sentences lengthen | 148 restart loops |
| 🎤 **তোমার লাইন, লাইভ** — boss round | deliver the sharp version of a real 40-word ramble under countdown | everything |

Tongue twisters carry real meaning + Bangla gloss + which muscle they train, e.g.:

> "Six specific Salesforce specs — sprint by sprint, spec by spec."
> ছয়টা নির্দিষ্ট Salesforce স্পেক — স্প্রিন্ট ধরে ধরে, স্পেক ধরে ধরে।
> Bangla has no word-initial `sp/st/sk` cluster, so the mouth defaults to "ইস্প্রিন্ট".

---

## 5. Game mechanics

- **HP penalises slowness, not wrongness.** 100 HP per set; wrong answers cost nothing,
  timeouts cost HP. He knows the answer — he needs speed.
- **Rep counter** as the primary home-screen number (`1,240 reps`), not `34 / 100 sessions`.
- **Weekly report card**, computed from his *newest CSV export* — measures real-life
  improvement, not in-app score. This is the retention loop.
- Kept: combo multiplier, streak ring, mistake bank (`srs.js`), export/import.
- Dropped: locked days, rule headers, "theme" and "pillar".

---

## 6. Content engine — never runs dry

```
VoiceInk CSV export
      │
      ▼
tools/mine.py                    ← new
      ├─ select filler-dense lines (3+ fillers, 12–40 words)
      ├─ compute damage report
      ├─ generate sharp rewrite + Bangla (one prompt)
      └─ top-100 domain words → tongue twisters
      │
      ▼
content/set-001.json … set-NNN.json
```

The current CSV alone yields roughly 40 sets. Each new monthly export refills the gym
with that month's speech. Because the input is his real work vocabulary (Salesforce,
record type, permission, deploy, merge, client), practice transfers directly to the
next day's calls.

---

## 7. Schema 3.0

```json
{
  "schemaVersion": "3.0",
  "set": 7,
  "stations": [
    {
      "station": "filler-hunt",
      "items": [{
        "id": "s07-fh-2",
        "raw": "So can you just give me an audit and tell me your result about it?",
        "source_date": "2026-08-06",
        "kill": [0, 3, 4],
        "sharp": "Run an audit and walk me through what you find.",
        "sharp_bn": "একটা অডিট চালাও, আর কী পেলে ধরে ধরে বলো।",
        "coach_bn": "'give me' = ভিক্ষা। 'run / walk me through' = ownership.",
        "target_sec": 4,
        "reps": 3
      }]
    }
  ]
}
```

Every item type carries the same four fields — `sharp`, `sharp_bn`, `coach_bn`, `reps` —
so one renderer covers all stations no matter how many are added.

---

## 8. Existing content

The 38 day files (~1,000 grammar items) move to `content/legacy/` behind a small
"grammar archive" link. Nothing is deleted.

- **Kept as-is:** `storage.js`, `srs.js`, the whole `tokens.css` design system,
  streak logic, export/import.
- **Rewritten:** `curriculum.js` (30 themes → station list), `render.js` (new card),
  the home screen.

---

## 9. Roadmap

1. **Set 0 — hand-built sample.** One full set (6 stations, ~20 items) from his real
   transcript, playable on his phone. If it doesn't feel right, stop here — before
   anything large is broken.
2. **Shell.** New home (rep counter, streak, weekly filler report), new card renderer,
   station player. Old grammar view archived.
3. **Miner.** `tools/mine.py` + generation prompt. Run over the 466-row CSV → ~40 sets.
   Bangla lines spot-checked.
4. **Polish.** Sound, haptics, combo flare, reduce-motion, weekly report card. Push to Pages.

---

## 10. Open decisions

1. **Name** — keep "জিভ / Tongue Gym", or something else? (Repo can stay `english-30`.)
2. **Mic** — self-marked reps (simple, always works) or browser `SpeechRecognition`
   for real verification (strict, good in Chrome, occasionally misreads accent)?
3. **Bangla level** — always visible on the card, or behind a toggle so challenge mode
   can hide it?
