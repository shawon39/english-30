#!/usr/bin/env python3
"""mine.py — turn a VoiceInk CSV export into drill briefs.

The deterministic half of the content pipeline. It reads the raw column of a
transcript export, keeps the lines worth drilling, works out which structure each
one is missing, and writes one brief per card. Language — the target sentence, the
Bangla, the coach line — is authored against those briefs (see tools/README.md).
Nothing here invents English; it only measures, selects and classifies.

    python3 tools/mine.py tools/sample-transcript.csv -o tools/briefs.json

Why briefs describe what a line should BECOME, not what it is
-------------------------------------------------------------
Measured over the 466-recording sample: 240 lines are a drillable length, but only
52 contain any past-tense token at all, and 72 open with a bare imperative. The
corpus is overwhelmingly instructions issued to an assistant, not stories told to a
person. That is the same fact as the zero past-perfect count — he does not narrate
in English, so there is little narration to lift.

So a brief carries the *situation* (a real bug, deploy, or decision, with its date
and vocabulary) and the world it should be retold in. One situation becomes several
cards: narrate it, stretch it, sequence it, run the counterfactual, ask about it in
a meeting. Retelling one real event five ways beats five invented sentences.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

csv.field_size_limit(10 ** 9)

FILLERS = {
    "so": r"\bso\b", "okay": r"\bokay\b", "like": r"\blike\b", "just": r"\bjust\b",
    "maybe": r"\bmaybe\b", "you know": r"\byou know\b", "kind of": r"\bkind of\b",
    "some kind of": r"\bsome kind of\b", "actually": r"\bactually\b",
    "thing": r"\bthings?\b", "something": r"\bsomething\b", "everything": r"\beverything\b",
    "I mean": r"\bi mean\b", "give me": r"\bgive me\b",
}

# Structures absent from the sample. A line that reached for one is worth drilling.
GAPS = {
    "past-perfect": r"\b(before that|already|by then|earlier|previously|at first|first then|in the beginning|used to)\b",
    "conditional-3": r"\b(otherwise|instead|should have|guard|prevent|avoid|caused|because of|would be|wouldn't)\b",
    "conditional-2": r"\b(if we|if you|suppose|assume|what if|we can|we could|option|maybe we)\b",
    "contrast": r"\b(but|even though|although|however|still|anyway|even he|even if)\b",
    "purpose": r"\b(so that|in order|the reason|that is why|that's why)\b",
}

PRESENT_PAST = {
    "is": "was", "are": "were", "am": "was", "has": "had", "have": "had",
    "do": "did", "does": "did", "go": "went", "goes": "went", "come": "came",
    "comes": "came", "get": "got", "gets": "got", "give": "gave", "gives": "gave",
    "make": "made", "makes": "made", "take": "took", "takes": "took", "see": "saw",
    "sees": "saw", "say": "said", "says": "said", "tell": "told", "tells": "told",
    "know": "knew", "knows": "knew", "think": "thought", "thinks": "thought",
    "find": "found", "finds": "found", "run": "ran", "runs": "ran", "send": "sent",
    "sends": "sent", "keep": "kept", "keeps": "kept", "build": "built",
    "builds": "built", "break": "broke", "breaks": "broke", "select": "selected",
    "create": "created", "creates": "created", "show": "showed", "shows": "showed",
    "start": "started", "starts": "started", "add": "added", "adds": "added",
    "check": "checked", "checks": "checked", "use": "used", "uses": "used",
    "work": "worked", "works": "worked", "try": "tried", "tries": "tried",
    "need": "needed", "needs": "needed", "want": "wanted", "wants": "wanted",
    "happen": "happened", "happens": "happened", "deploy": "deployed",
    "merge": "merged", "merges": "merged", "move": "moved", "moves": "moved",
    "fix": "fixed", "fixes": "fixed", "ask": "asked", "asks": "asked",
    "call": "called", "calls": "called", "look": "looked", "looks": "looked",
}

PAST_MARKERS = r"\b(yesterday|last week|last month|last night|ago|previously|earlier|before|already|then|when i|after we|after i|used to|was|were)\b"
PROBLEM = r"\b(issue|issues|bug|error|fail|failed|failing|wrong|broke|broken|problem|not working|blocked|missing|null|weird|conflict|duplicate|crash)\b"
PROPOSAL = r"\b(we can|we could|we should|option|approach|instead|plan|idea|thinking|introduce|build our own|flexible|benefit|recommend)\b"
REQUEST = r"\b(can you|could you|please|i want|i need|give me|let me know|tell me|make sure|do an?)\b"
QUESTION = r"\?|\b(what is|why is|how can|how do|which one|should i|should we|is it|does it|do we)\b"

TOPICS = {
    "record-type": r"\b(record type|pipelaunch|linkedin|permission)\b",
    "deployment": r"\b(deploy|deployment|sandbox|uat|production|partial copy|merge|branch|pull request)\b",
    "billing": r"\b(pro-rated|prorated|contract|renewal|billing|month|quarter|formula field|calculation)\b",
    "data-model": r"\b(object|field|picklist|validation|soql|schema|custom object|bookmark)\b",
    "ai-tooling": r"\b(mcp|prompt|transcript|model|agent|claude|chatgpt|token|credits)\b",
    "product": r"\b(rocketphone|rocketcell|rocketvideo|softphone|customer|client|competitor)\b",
    "design": r"\b(font|ui|layout|responsive|mobile|visual|design|icon|page|animation|colour|color)\b",
    "reporting": r"\b(report|dashboard|audit|analysis|metric|score)\b",
}

DOMAIN = "|".join(p.strip("\\b()") for p in TOPICS.values())

WORLDS = {
    "standup-replay": ("স্ট্যান্ডআপ রিপ্লে", ["time-machine", "ladder", "frame"]),
    "timeline":       ("টাইমলাইন", ["backward", "ladder", "time-machine"]),
    "postmortem":     ("পোস্টমর্টেম", ["if-machine", "backward", "time-machine"]),
    "proposal":       ("প্রপোজাল", ["if-machine", "frame", "ladder"]),
    "meeting":        ("মিটিং বস", ["frame", "ladder", "if-machine"]),
}


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def count_fillers(text: str) -> dict[str, int]:
    low = text.lower()
    return {k: n for k, p in FILLERS.items() if (n := len(re.findall(p, low)))}


def count_restarts(text: str) -> int:
    """Immediate word or short-phrase repeats — the audible stumble."""
    words = re.findall(r"[a-z']+", text.lower())
    n = sum(1 for a, b in zip(words, words[1:]) if a == b)
    n += len(re.findall(r"\b(\w+ \w+ \w+)\b[ ,]+\1\b", text.lower()))
    n += text.count("—")
    return n


def present_verbs(text: str) -> list[dict]:
    """Present-tense verbs available to flip, in order of appearance."""
    out, seen = [], set()
    for m in re.finditer(r"\b([a-z']+)\b", text.lower()):
        w = m.group(1)
        if w in PRESENT_PAST and PRESENT_PAST[w] != w and w not in seen:
            seen.add(w)
            out.append({"word": w, "past": PRESENT_PAST[w]})
    return out


def topics_of(text: str) -> list[str]:
    low = text.lower()
    return [t for t, p in TOPICS.items() if re.search(p, low)]


def speech_act(text: str) -> str:
    low = text.lower()
    if re.search(PROBLEM, low):
        return "problem"
    if re.search(PROPOSAL, low):
        return "proposal"
    if re.search(PAST_MARKERS, low):
        return "narration"
    if re.search(QUESTION, low):
        return "question"
    if re.search(REQUEST, low):
        return "request"
    return "other"


# What a line SHOULD become, given what it is. A bug report becomes a postmortem;
# a request becomes the meeting question he never asks in full sentences.
RETELL = {
    "problem":   ["postmortem", "timeline", "standup-replay"],
    "narration": ["standup-replay", "timeline", "postmortem"],
    "proposal":  ["proposal", "meeting", "postmortem"],
    "question":  ["meeting", "proposal", "standup-replay"],
    "request":   ["meeting", "standup-replay", "proposal"],
    "other":     ["standup-replay", "meeting", "timeline"],
}


def score(text: str, fillers: dict, restarts: int, flips: list, topics: list) -> float:
    words = len(text.split())
    s = 0.0
    s += min(sum(fillers.values()), 10) * 1.2
    s += min(restarts, 6) * 2.0
    s += min(len(flips), 6) * 1.5
    s += len(topics) * 2.5
    s += 4 if 14 <= words <= 34 else 0
    return round(s, 1)


def mine(rows: list[dict], min_score: float, limit: int | None) -> list[dict]:
    seen: set[str] = set()
    cand = []
    for r in rows:
        raw = clean(r.get("Original Transcript"))
        if not raw:
            continue
        words = raw.split()
        if not (8 <= len(words) <= 45):
            continue
        key = " ".join(w.lower() for w in words[:8])
        if key in seen:                       # VoiceInk keeps near-duplicate retakes
            continue
        seen.add(key)

        fillers = count_fillers(raw)
        restarts = count_restarts(raw)
        flips = present_verbs(raw)
        topics = topics_of(raw)
        sc = score(raw, fillers, restarts, flips, topics)
        if sc < min_score:
            continue
        cand.append({
            "raw": raw,
            "date": (r.get("Timestamp") or "")[:10],
            "words": len(words),
            "act": speech_act(raw),
            "topics": topics,
            "gaps": [g for g, p in GAPS.items() if re.search(p, raw.lower())],
            "fillers": fillers,
            "filler_total": sum(fillers.values()),
            "restarts": restarts,
            "flips": flips[:4],
            "score": sc,
        })

    cand.sort(key=lambda b: -b["score"])

    # Spread across worlds so no set is starved. Each line goes to its best-fit
    # world unless that world is already the fullest, in which case it falls to
    # its second choice.
    load: Counter[str] = Counter()
    for b in cand:
        choices = RETELL[b["act"]]
        target = min(choices, key=lambda w: (load[w], choices.index(w)))
        b["world"] = target
        b["world_bn"] = WORLDS[target][0]
        stations = WORLDS[target][1]
        b["station"] = stations[0] if b["flips"] or b["restarts"] else stations[1]
        load[target] += 1

    return cand[:limit] if limit else cand


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", type=Path, help="VoiceInk CSV export")
    ap.add_argument("-o", "--out", type=Path, default=Path("tools/briefs.json"))
    ap.add_argument("-n", "--limit", type=int, default=None)
    ap.add_argument("--min-score", type=float, default=8.0)
    args = ap.parse_args()

    if not args.csv.exists():
        print(f"no such file: {args.csv}", file=sys.stderr)
        return 1
    with args.csv.open(encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))

    briefs = mine(rows, args.min_score, args.limit)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(briefs, ensure_ascii=False, indent=1), encoding="utf-8")

    by_world = Counter(b["world"] for b in briefs)
    by_act = Counter(b["act"] for b in briefs)
    by_topic = Counter(t for b in briefs for t in b["topics"])
    print(f"read {len(rows)} rows -> {len(briefs)} briefs -> {args.out}")
    print("  speech act: " + ", ".join(f"{k} {v}" for k, v in by_act.most_common()))
    print("  retold as:  " + ", ".join(f"{k} {v}" for k, v in by_world.most_common()))
    print("  topics:     " + ", ".join(f"{k} {v}" for k, v in by_topic.most_common(6)))
    print(f"  enough for ~{len(briefs) // 6} sets at 6 situations each")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
