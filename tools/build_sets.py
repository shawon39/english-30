#!/usr/bin/env python3
"""build_sets.py — expand authored content into schema 3.1 set files.

Authoring a set by hand means writing the same ids, station wrappers, rep counts and
timings over and over. This keeps the authored source down to the part only a human
can write — the English, the Bangla, the coach line — and derives the rest.

    python3 tools/build_sets.py tools/authored.json -o content/

Compact card shapes (`st`):
  tm   time-machine  tokens + flip{word: [options]}   -> tokens[] / slots[]
  ld   ladder        rungs[]
  bw   backward      chunks[]
  fr   frame         frame + fills[[en, bn, scene]]
  if   if-machine    tiles[]
  boss boss          prompt_bn + checklist[] + model
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

STATIONS = {"tm": "time-machine", "ld": "ladder", "bw": "backward",
            "fr": "frame", "if": "if-machine", "boss": "boss"}

WORLD_BN = {
    "standup-replay": "স্ট্যান্ডআপ রিপ্লে",
    "timeline": "টাইমলাইন",
    "postmortem": "পোস্টমর্টেম",
    "proposal": "প্রপোজাল",
    "meeting": "মিটিং বস",
}


def pace(sentence: str) -> int:
    """Seconds to say it once, with a little headroom. ~2 words a second."""
    words = len(sentence.split())
    return max(4, min(14, round(words / 2.0) + 2))


def slots_from(tokens: list[str], flip: dict[str, list[str]]) -> list[dict]:
    """Map each flip word to the first matching token index not already claimed."""
    used: set[int] = set()
    slots = []
    for word, options in flip.items():
        idx = next((i for i, t in enumerate(tokens)
                    if i not in used and t.strip(".,!?;:").lower() == word.lower()), None)
        if idx is None:
            raise ValueError(f"flip word {word!r} not found in tokens: {' '.join(tokens)}")
        used.add(idx)
        slots.append({"index": idx, "options": options, "answer": options[0]})
    return sorted(slots, key=lambda s: s["index"])


def build_card(card: dict, sid: str, seq: int) -> dict:
    st = STATIONS[card["st"]]
    item: dict = {
        "id": f"{sid}-{card['st']}-{seq}",
        "station": st,
        "cheat": card["cheat"],
    }
    if card.get("date"):
        item["source_date"] = card["date"]
    if card.get("raw"):
        item["raw"] = card["raw"]

    if card["st"] == "tm":
        tokens = card["tokens"].split()
        item["tokens"] = tokens
        item["slots"] = slots_from(tokens, card["flip"])
        item["sharp"] = card["sharp"]

    elif card["st"] in ("ld", "bw"):
        key = "rungs" if card["st"] == "ld" else "chunks"
        item[key] = card[key]
        item["sharp"] = card["rungs"][-1] if card["st"] == "ld" else " ".join(card["chunks"])

    elif card["st"] == "fr":
        item["frame"] = card["frame"]
        item["fills"] = [{"scene": scene, "sharp": en, "sharp_bn": bn}
                         for en, bn, scene in card["fills"]]
        item["sharp"] = card["fills"][0][0]
        item["reps"] = len(card["fills"])

    elif card["st"] == "if":
        item["tiles"] = card["tiles"]
        item["sharp"] = " ".join(card["tiles"])

    elif card["st"] == "boss":
        item["prompt_bn"] = card["prompt_bn"]
        item["checklist"] = card["checklist"]
        item["rounds"] = card.get("rounds", [60, 45, 30])
        item["model_en"] = card["model"]
        item["coach_bn"] = card["coach"]
        return item

    if card.get("bn"):
        item["sharp_bn"] = card["bn"]
    item["coach_bn"] = card["coach"]
    item.setdefault("reps", 3)
    item["target_sec"] = card.get("sec", pace(item["sharp"]))
    return item


def build_set(spec: dict) -> dict:
    n = spec["n"]
    sid = f"s{n:03d}"
    world = spec["world"]

    groups: list[dict] = []
    counters: dict[str, int] = {}
    for card in spec["cards"]:
        st = STATIONS[card["st"]]
        counters[card["st"]] = counters.get(card["st"], 0) + 1
        item = build_card(card, sid, counters[card["st"]])
        if groups and groups[-1]["station"] == st:
            groups[-1]["items"].append(item)
        else:
            groups.append({"station": st, "items": [item]})

    reps = sum(i.get("reps", 3) + len(i.get("rungs", [])) + len(i.get("chunks", []))
               + len(i.get("rounds", [])) for g in groups for i in g["items"])
    return {
        "schemaVersion": "3.1",
        "set": n,
        "world": world,
        "world_bn": WORLD_BN[world],
        "title_bn": spec["title_bn"],
        "desc_bn": spec["desc_bn"],
        "minutes": max(5, round(reps * 7 / 60) + 1),
        "cheats": spec["cheats"],
        "stations": groups,
    }


def write_index(out: Path) -> int:
    """A manifest of everything the home screen needs.

    Without it the app discovers sets by probing set-000, set-001 ... until one
    is missing, then downloads every set file just to render a title. That is
    forty-one requests before the first tap on a phone. This makes it one.
    """
    sets = []
    for path in sorted(out.glob("set-*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        sets.append({
            "set": doc["set"],
            "world": doc.get("world", ""),
            "world_bn": doc.get("world_bn", ""),
            "title_bn": doc.get("title_bn", ""),
            "desc_bn": doc.get("desc_bn", ""),
            "minutes": doc.get("minutes", 7),
            "cheats": doc.get("cheats", []),
            "cards": sum(len(g.get("items", [])) for g in doc.get("stations", [])),
        })
    sets.sort(key=lambda s: s["set"])
    (out / "index.json").write_text(
        json.dumps({"schemaVersion": "3.1", "sets": sets}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")
    return len(sets)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("authored", type=Path)
    ap.add_argument("-o", "--out", type=Path, default=Path("content"))
    args = ap.parse_args()

    src = json.loads(args.authored.read_text(encoding="utf-8"))
    args.out.mkdir(parents=True, exist_ok=True)

    for spec in src["sets"]:
        try:
            built = build_set(spec)
        except (KeyError, ValueError) as err:
            print(f"set {spec.get('n')}: {err}", file=sys.stderr)
            return 1
        path = args.out / f"set-{spec['n']:03d}.json"
        path.write_text(json.dumps(built, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        cards = sum(len(g["items"]) for g in built["stations"])
        print(f"  set-{spec['n']:03d}  {built['world']:15s} {cards:2d} cards  ~{built['minutes']} min")
    total = write_index(args.out)
    print(f"built {len(src['sets'])} sets -> {args.out}/  ·  index.json lists {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
