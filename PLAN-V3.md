# রিপ্লে / Replay (v3 redesign proposal — revision 2)

> Status: **proposal only.** No app code has been changed. Supersedes revision 1 of this
> document (which proposed a filler/tongue-twister-first "Tongue Gym").

Focus, per the user's direction: **narrating past events, hypothetical scenarios, and
long complex sentences** — daily English + business English — built as repetition-based
muscle-memory training from the user's own VoiceInk transcripts. Grammar rules stay,
recast as one-line "cheat codes" attached to personalized examples.

---

## 1. Diagnosis v2 — absence, not error

Source: `VoiceInk-transcription.csv` — 466 recordings, 20,127 words, ~195 min.

**Real slips exist** (conceded — speed-pressure class, not textbook class):
`is seems` ×2, `more easier` ×3, `those kind of issue` ×3, `more looking good` ×2,
`a end user`, `multiple language`, `discuss about`.

**The structures the user wants to master are almost entirely absent:**

| Structure | Count in 20,127 words |
|---|---|
| `had` (past perfect) | **0** |
| `would have` / `could have` | **0** |
| `if + had` (third conditional) | **0** |
| `by the time` / `had already` | **0** |
| `wish` | **0** |
| `although` | **0** |
| `was` | 43 — rank **#71** in his own frequency list (top-20 word in spoken English) |

- **70% of clips (321/455) contain no past-tense verb at all** — past events are narrated
  in present tense (e.g. "After we give the new record type and previously there was a
  custom record type there, it wouldn't create any issue before. So what is the issue?").
- Length is built by chaining `so`(462)/`and`(634) — coordination outruns subordination
  (`which` 33, `because` 49, `even though` 6, `although` 0) by ~8:1. Attempts at real
  subordination collapse into **148 restart loops**.
- The AI enhancer silently does the missing work: 6× `can you` → `could you`,
  `-ed` density 18 → 23.7 per 1k. Goal of the app: make the enhancer unnecessary.

---

## 2. Method — how muscle memory is actually built

Three proven drill techniques (FSI / fluency research), gamified:

1. **Expansion ladder (সিঁড়ি)** — sentence grows one clause per rung, 4 → 24 words;
   removes the fear of long sentences.
2. **Backward build (উল্টো গাঁথা)** — memorize the tail first, attach the front;
   the interpreter-training fix for restart loops.
3. **Frame swap (ছাঁচ)** — one pattern, five personalized fillings (work + daily life);
   by the fifth the pattern is automatic.

Plus **4/3/2 timed retelling** (Paul Nation) for the boss round, and the existing
`srs.js` spaced-repetition mistake bank.

---

## 3. Cheat codes → worlds

Grammar rules stay, as one-line cheat codes on each card:

| Pack | Cheat code | Unlocks |
|---|---|---|
| A · গল্পের ইঞ্জিন | `was doing + when / while` | past narration |
| B · তার আগেই | `had already ___ / by the time ___` | sequencing |
| C · যদি জানতাম | `If + had V3 → would have V3` | postmortems, regret |
| D · ধরো যদি | `If we moved ___ → would/could ___` | proposals, pitching ideas |
| E · জোড়ার শব্দ | `which / even though / so that / while` | replaces 462 "so"s |
| F · মিটিং ম্যাজিক | `Could you walk me through… / What I'd suggest is…` | meeting questions, polite distance |

Five worlds, each mixing business + daily scenes:
1. স্ট্যান্ডআপ রিপ্লে (A+E) · 2. টাইমলাইন (B) · 3. পোস্টমর্টেম (C) ·
4. প্রপোজাল (D) · 5. মিটিং বস (F + all).

---

## 4. Card pattern

`চিট কোড → কাঁচা (his raw line, date-stamped) → রিপ্লে (target sentence, 🔊 audio)
→ অর্থ (Bangla) → কোচ (one Banglish line) → রেপ (3× against timer, pips fill)`

Worked example (world 3):
- CHEAT: `if + had V3 → would have V3`
- RAW (6 Aug): "Is it like a pipeline randomly just select one record type, there was no guard or something like that."
- REPLAY: "If PipeLaunch had respected the profile defaults, the task would have been created with the right record type."
- BN: PipeLaunch যদি profile default মানতো, task-টা সঠিক record type নিয়েই তৈরি হতো।
- COACH: RCA মিটিংয়ের সবচেয়ে দামি বাক্য — তোমার ট্রান্সক্রিপ্টে ০ বার।

## 5. Stations (one set = 6 stations, 6–8 min)

| Station | Drill | Targets |
|---|---|---|
| ⏪ টাইম মেশিন | tap present verbs → flip to past, then say it | 70% clips with zero past verbs |
| 🪜 সিঁড়ি | expansion ladder, final rung 3× in one breath | long complex sentences |
| 🧵 উল্টো গাঁথা | backward build from the tail | 148 restart loops |
| 🧩 ছাঁচ | frame swap ×5 (work + daily) | by the time / even though / which |
| 🌀 যদি-মেশিন | real event → conditional flip | would have: 0 occurrences |
| 🎤 বস: স্ট্যান্ডআপ রিপ্লে | 60s story with required cheat codes, then 45s, then 30s (4/3/2) | fillers + restarts scored |

## 6. Audio

- Web Speech API `speechSynthesis`: free, no key, works on GitHub Pages.
- Auto-picks the most natural English voice per device; changeable in settings.
- Rate control 0.75× / 1× / 1.25×; karaoke word highlight via boundary events;
  shadow mode (speak along, counts as a rep).
- Upgrade path: pre-generated neural-TTS MP3s per set via the miner if device voices
  disappoint. Decide after Set 0 on the user's phone.

## 7. Archive (per user's spec)

- The **entire current app** (`index.html`, `css/`, `js/`, `content/`) moves to
  `/archive/` in one commit — zero edits; all paths are relative so it keeps working.
- New home screen gets a **📚 আর্কাইভ** button → `/archive/`.
- localStorage progress survives (same origin). `PLAN.md` remains as the archive's doc.

## 8. Game systems

- HP drains on **timeout**, not on wrong answers.
- Lifetime **rep counter** as the home screen's headline number.
- Combo (3× = 2 pts, 5× = 3 pts), existing streak ring, `srs.js` mistake bank.
- **Monthly rematch:** drop a new VoiceInk CSV → the app scores real-life change
  (`had` 0 → ?, `would have` 0 → ?, `was` rank #71 → ?, `so`/1k 23 → ?) and mines the
  next month's sets from it. Content never goes stale.

## 9. Schema 3.1

```json
{
  "schemaVersion": "3.1",
  "set": 3,
  "world": "postmortem",
  "stations": [{
    "station": "if-machine",
    "items": [{
      "id": "s03-if-2",
      "cheat": "if + had V3 → would have V3",
      "raw": "randomly just select one record type, there was no guard",
      "source_date": "2026-08-06",
      "sharp": "If PipeLaunch had respected the profile defaults, the task would have been created with the right record type.",
      "sharp_bn": "PipeLaunch যদি profile default মানতো, task-টা সঠিক record type নিয়েই তৈরি হতো।",
      "coach_bn": "RCA মিটিংয়ের সবচেয়ে দামি বাক্য — তোমার ট্রান্সক্রিপ্টে ০ বার।",
      "audio": { "tts": "sharp", "rate": [0.75, 1, 1.25] },
      "target_sec": 7,
      "reps": 3
    }]
  }]
}
```

Ladder items add `rungs[]`; frame items add `frame` + `fills[]`. The four common fields
(`sharp`, `sharp_bn`, `coach_bn`, `reps`) are identical across stations → one renderer.

## 10. Roadmap

1. **Archive + new shell** — move current app to `/archive/`, new home with rep counter
   and archive button. Zero risk.
2. **Set 0, hand-built** — one full set (~22 cards) from the real transcript + card
   renderer + audio. Feel test on the user's phone; pivot here if it doesn't land.
3. **Miner** — `tools/mine.py`: 466-row CSV → ~35 sets tagged by world, business + daily
   mixed. Bangla spot-checked by the user.
4. **Polish + rematch** — combo flare, sound, reduce-motion, monthly rematch report.

Decisions taken (vetoable): name **রিপ্লে (Replay)**; reps counted by tap first
(mic verification experiment after Set 0); Bangla always visible with a
"challenge mode" toggle to hide it.
