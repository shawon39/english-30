// curriculum.js — all 30 themes + derived session metadata.
// Renders the home map with ZERO fetches. Content (items) is fetched only on open.

export function pad(n) { return String(n).padStart(2, "0"); }
export function sessionId(day, n) { return `d${pad(day)}s${n}`; }

// Session shape per day. Normal day = 3 sessions, heavy day = +1 mixed drill.
export const SESSION_BLUEPRINT = {
  normal: [
    { n: 1, title: "Spot the Error", type: "error-find", blurb: "Tap the wrong word, tap the fix." },
    { n: 2, title: "Choose & Fill",  type: "choose",     blurb: "Pick the right form." },
    { n: 3, title: "Build It",       type: "build",      blurb: "Assemble the sentence." },
  ],
  heavyExtra: [
    { n: 4, title: "Mixed Drill",    type: "mixed",      blurb: "All types, shuffled & timed." },
  ],
};

// [day, theme, pillar, star, heavy]
const DAYS = [
  [1,  "Present Simple vs Present Continuous",            "tense",       false, false],
  [2,  "Past Simple vs Present Perfect",                  "tense",       true,  true ],
  [3,  "Present Perfect vs Present Perfect Continuous",   "tense",       false, false],
  [4,  "Past Simple vs Past Continuous",                 "tense",       false, false],
  [5,  "Past Perfect (sequencing)",                      "tense",       false, false],
  [6,  "Future: will / going to / present continuous",   "tense",       false, true ],
  [7,  "Future Perfect & Continuous",                    "tense",       false, false],
  [8,  "used to / would",                                "tense",       false, false],
  [9,  "Reported speech (backshift)",                    "tense",       true,  true ],
  [10, "Tense review (timed)",                           "tense",       false, true ],
  [11, "Zero & First conditional",                       "conditional", false, false],
  [12, "Second conditional",                             "conditional", false, false],
  [13, "Third conditional",                              "conditional", true,  true ],
  [14, "Mixed conditionals",                             "conditional", false, false],
  [15, "wish / if only",                                 "conditional", false, false],
  [16, "unless / as long as / provided that",            "conditional", false, false],
  [17, "Conditionals review",                            "conditional", false, true ],
  [18, "can / could / be able to",                       "modal",       false, false],
  [19, "must / have to / need to",                       "modal",       false, false],
  [20, "should / ought to / had better",                 "modal",       false, false],
  [21, "may / might / could (possibility)",              "modal",       false, true ],
  [22, "Deduction present (must be / can't be)",         "modal",       false, false],
  [23, "Deduction past (it could have happened)",        "modal",       true,  true ],
  [24, "would (habit, polite, hypothetical)",            "modal",       false, false],
  [25, "Permission & requests",                          "modal",       false, false],
  [26, "Semi-modals (be supposed to, be going to)",      "modal",       false, false],
  [27, "Modals review",                                  "modal",       false, true ],
  [28, "Work English: standups, code reviews, Jira",     "applied",     false, false],
  [29, "Your fast-speech error patterns (targeted)",     "applied",     true,  false],
  [30, "Final boss: mixed timed exam",                   "mastery",     false, true ],
];

export const CURRICULUM = DAYS.map(([day, theme, pillar, star, heavy]) => {
  const plan = SESSION_BLUEPRINT.normal.concat(heavy ? SESSION_BLUEPRINT.heavyExtra : []);
  const sessions = plan.map((s) => ({ id: sessionId(day, s.n), ...s }));
  return { day, theme, pillar, star, heavy, sessions };
});

export const TOTAL_SESSIONS = CURRICULUM.reduce((a, d) => a + d.sessions.length, 0); // 100

export const PILLAR_LABEL = {
  tense: "Tenses",
  conditional: "Conditionals",
  modal: "Modals",
  applied: "Applied",
  mastery: "Mastery",
};

// Map groups for the home screen (label + day range).
export const GROUPS = [
  { label: "Tenses",            pillars: ["tense"] },
  { label: "Conditionals",      pillars: ["conditional"] },
  { label: "Modals",            pillars: ["modal"] },
  { label: "Applied & Mastery", pillars: ["applied", "mastery"] },
];

export function getDay(day) { return CURRICULUM.find((d) => d.day === day); }
