#!/usr/bin/env python3
"""validate.py — check every content/set-*.json against schema 3.1.

Run before committing content. Catches the failures that only show up mid-drill:
a flip index pointing at the wrong token, a tile list that cannot rebuild its own
sentence, a ladder rung that does not extend the one before it.

    python3 tools/validate.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

STATIONS = {"time-machine", "ladder", "backward", "frame", "if-machine", "boss"}
COMMON = ("id", "station", "cheat", "coach_bn")


def check_item(it: dict, where: str, errs: list[str]) -> None:
    add = lambda m: errs.append(f"{where}: {m}")
    for f in COMMON:
        if not it.get(f):
            add(f"missing {f}")
    st = it.get("station")
    if st not in STATIONS:
        add(f"unknown station {st!r}")
        return

    if st == "boss":
        for f in ("prompt_bn", "checklist", "model_en", "rounds"):
            if not it.get(f):
                add(f"boss missing {f}")
        return

    if not it.get("sharp"):
        add("missing sharp")
    if st != "frame" and not it.get("sharp_bn"):
        add("missing sharp_bn")
    if not it.get("reps"):
        add("missing reps")
    if not it.get("target_sec"):
        add("missing target_sec")

    if st == "time-machine":
        tokens, slots = it.get("tokens") or [], it.get("slots") or []
        if not slots:
            add("no slots")
        seen = set()
        for s in slots:
            i = s.get("index")
            if not isinstance(i, int) or not (0 <= i < len(tokens)):
                add(f"slot index {i} out of range")
                continue
            if i in seen:
                add(f"duplicate slot index {i}")
            seen.add(i)
            if s["answer"] not in s["options"]:
                add(f"answer {s['answer']!r} not among options")
            if s["options"][0] != s["answer"]:
                add("answer must be options[0] so the builder stays the source of truth")
            # the flipped word must actually change the sentence
            if tokens[i].strip(".,!?;:").lower() == s["answer"].lower():
                add(f"slot {i} flips {tokens[i]!r} to itself")

    if st == "ladder":
        rungs = it.get("rungs") or []
        if len(rungs) < 2:
            add("ladder needs at least 2 rungs")
        for a, b in zip(rungs, rungs[1:]):
            core = re.sub(r"[.,;:!?]+$", "", a)
            if not b.startswith(core):
                add(f"rung does not extend the previous one: {b[:48]!r}")
        if rungs and it["sharp"] != rungs[-1]:
            add("sharp must equal the final rung")

    if st == "backward":
        chunks = it.get("chunks") or []
        if len(chunks) < 2:
            add("backward build needs at least 2 chunks")
        if chunks and it["sharp"] != " ".join(chunks):
            add("sharp must equal the joined chunks")

    if st == "frame":
        fills = it.get("fills") or []
        if len(fills) < 3:
            add("frame needs at least 3 fills")
        for f in fills:
            if not f.get("sharp") or not f.get("sharp_bn"):
                add("fill missing sharp/sharp_bn")
            if f.get("scene") not in ("office", "daily"):
                add(f"fill scene {f.get('scene')!r} must be office or daily")
        if not any(f.get("scene") == "daily" for f in fills):
            add("frame has no daily-life fill")
        if it.get("reps") != len(fills):
            add("frame reps must equal the number of fills")

    if st == "if-machine":
        tiles = it.get("tiles") or []
        if len(tiles) < 3:
            add("if-machine needs at least 3 tiles")
        if " ".join(tiles) != it.get("sharp"):
            add("tiles do not rebuild sharp")


def main() -> int:
    files = sorted(Path("content").glob("set-*.json"))
    if not files:
        print("no content/set-*.json found", file=sys.stderr)
        return 1

    errs: list[str] = []
    ids: dict[str, str] = {}
    total_cards = total_reps = 0

    for path in files:
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errs.append(f"{path.name}: invalid JSON — {e}")
            continue
        if doc.get("schemaVersion") != "3.1":
            errs.append(f"{path.name}: schemaVersion must be '3.1'")
        for f in ("set", "world", "world_bn", "title_bn", "desc_bn", "cheats"):
            if doc.get(f) in (None, "", []):
                errs.append(f"{path.name}: missing {f}")
        if doc.get("set") != int(path.stem.split("-")[1]):
            errs.append(f"{path.name}: set number does not match filename")

        cards = 0
        for g in doc.get("stations", []):
            for it in g.get("items", []):
                cards += 1
                where = f"{path.name}:{it.get('id', '?')}"
                if it.get("id") in ids:
                    errs.append(f"{where}: duplicate id (also in {ids[it['id']]})")
                ids[it.get("id", "")] = path.name
                if it.get("station") != g.get("station"):
                    errs.append(f"{where}: item station differs from its group")
                check_item(it, where, errs)
                total_reps += (it.get("reps", 3) + len(it.get("rungs", []))
                               + len(it.get("chunks", [])) + len(it.get("rounds", [])))
        total_cards += cards
        if cards < 6:
            errs.append(f"{path.name}: only {cards} cards, expected at least 6")

    # numbering must have no gaps: the app stops probing at the first miss
    nums = sorted(int(p.stem.split("-")[1]) for p in files)
    if nums != list(range(len(nums))):
        errs.append(f"set numbering has a gap: {nums}")

    print(f"{len(files)} sets · {total_cards} cards · ~{total_reps} reps")
    if errs:
        print(f"\n{len(errs)} problem(s):", file=sys.stderr)
        for e in errs:
            print("  " + e, file=sys.stderr)
        return 1
    print("all valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
