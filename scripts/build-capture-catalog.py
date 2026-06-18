#!/usr/bin/env python3
"""
GP-200 Capture Catalog Builder
==============================
Walks every USB-MIDI capture (``scripts/*.pcap`` + ``caps/*.pcap``), runs each
through the canonical SysEx analyzer (``analyze-sysex.py`` — reused, not copied)
and writes a human-readable knowledge-base catalog to ``docs/capture-catalog.md``.

The catalog categorises every capture by SysEx content (toggle, param/effect
change, preset write/read, preset change, drum, IR/NAM upload, state dump, …)
and lists every still-undecoded sub-command as a "protocol fingerprint" so the
open protocol gaps are easy to find.

Usage:
  python scripts/build-capture-catalog.py            # full run, all captures
  python scripts/build-capture-catalog.py --quick    # skip captures > 25 MB (fast preview)

Note: the .pcap binaries themselves are NOT in git (see .gitignore). This script
regenerates the catalog from whatever captures are present locally.
"""

from __future__ import annotations

import importlib.util
import os
import re
import sys
from collections import Counter, defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
CATALOG_MD = os.path.join(REPO_ROOT, "docs", "capture-catalog.md")

# ---- Reuse the canonical analyzer (filename has a hyphen → load by path) -----

def _load_analyzer():
    path = os.path.join(SCRIPT_DIR, "analyze-sysex.py")
    spec = importlib.util.spec_from_file_location("analyze_sysex", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

AZX = _load_analyzer()

# Friendly labels for the cmd/sub combos the analyzer leaves as "unknown_*".
# These are the still-undecoded (or only partly decoded) parts of the protocol.
UNKNOWN_HINTS = {
    "cmd12_sub14": "param/effect-change or controller assignment (sub=0x14, 54B raw)",
    "cmd12_sub1C": "IR/NAM multi-chunk upload (sub=0x1C)",
    "cmd11_sub14": "effect-change request (sub=0x14)",
    "cmd12_sub4E": "state-dump chunk (sub=0x4E)",
    "cmd11_sub08": "preset-change request (sub=0x08)",
}

FNAME_RE = re.compile(r"gp200-capture-(\d{8})-(\d{6})\.pcap$")


def human_size(num_bytes: int) -> str:
    mb = num_bytes / 1048576
    if mb >= 1:
        return f"{mb:.1f} MB"
    return f"{num_bytes / 1024:.0f} KB"


def summarize(path: str) -> dict:
    """Run the analyzer over one capture and produce a compact summary dict."""
    messages = AZX.parse_messages(path)

    type_counts: Counter = Counter()
    dirs: Counter = Counter()
    toggle_blocks: set = set()
    preset_nums: set = set()
    unknown: dict = defaultdict(lambda: {"count": 0, "dirs": set(), "lens": set()})

    for m in messages:
        t = m.get("type", "?")
        type_counts[t] += 1
        dirs[m.get("direction", "?")] += 1
        if t in ("toggle_fx", "fx_state_resp", "req_fx_state"):
            bn = m.get("block_name")
            st = m.get("state")
            if bn:
                toggle_blocks.add(f"{bn}{'+' if st else '-'}" if st is not None else bn)
        if t in ("change_preset", "req_patch", "req_patch_name") and "preset_num" in m:
            preset_nums.add(m["preset_num"])
        if t.startswith("unknown_"):
            key = t.replace("unknown_", "")
            u = unknown[key]
            u["count"] += 1
            u["dirs"].add("H" if m.get("direction") == "host->dev" else "D")
            u["lens"].add(len(m.get("payload", b"")))

    # Preset write reconstruction (sub=0x20 chunks → names)
    write_slots: set = set()
    write_names: list = []
    try:
        for slot, data in AZX.reconstruct_preset(messages).items():
            write_slots.add(slot)
            name = data[36:68].split(b"\x00")[0].decode("ascii", "replace").strip()
            if name:
                write_names.append(name)
    except Exception:
        pass

    # Preset read groups (sub=0x18 chunks)
    read_groups = 0
    read_names: list = []
    try:
        rp = AZX.decode_all_read_presets(messages)
        read_groups = len(rp)
        for _, data in list(rp.items())[:3]:
            nm = data[28:60].split(b"\x00")[0].decode("ascii", "replace").strip()
            if nm:
                read_names.append(nm)
    except Exception:
        pass

    return {
        "path": path,
        "size": os.path.getsize(path),
        "n_msgs": len(messages),
        "types": type_counts,
        "dirs": dirs,
        "toggle_blocks": toggle_blocks,
        "preset_nums": preset_nums,
        "write_slots": write_slots,
        "write_names": write_names,
        "read_groups": read_groups,
        "read_names": read_names,
        "unknown": dict(unknown),
    }


def categorize(s: dict) -> str:
    """Derive a short human category label from a summary dict."""
    if s["n_msgs"] == 0:
        return "leer / kein GP-200 SysEx"

    parts: list[str] = []
    t = s["types"]

    if s["write_slots"]:
        name = f" '{s['write_names'][0]}'" if s["write_names"] else ""
        parts.append(f"Preset-Write → Slot {sorted(s['write_slots'])}{name}")
    if s["read_groups"]:
        parts.append(f"Preset-Read/State-Dump ({s['read_groups']} Presets)")
    if t.get("change_preset"):
        nums = sorted(s["preset_nums"])
        parts.append(f"Preset-Change ({t['change_preset']}×{', #' + str(nums) if nums else ''})")
    if t.get("toggle_fx"):
        blocks = ",".join(sorted(s["toggle_blocks"])) or "?"
        parts.append(f"Toggle [{blocks}]")

    # Undecoded streams (the interesting research material)
    for key, info in sorted(s["unknown"].items(), key=lambda kv: -kv[1]["count"]):
        hint = UNKNOWN_HINTS.get(key, key.replace("cmd", "CMD ").replace("_sub", " sub "))
        parts.append(f"{hint} ×{info['count']}")

    if not parts:
        # Only requests / capabilities / handshake traffic
        if t.get("capabilities") or t.get("req_fx_state") or t.get("req_patch"):
            parts.append("Handshake / Requests")
        else:
            parts.append(", ".join(f"{k}×{v}" for k, v in t.most_common(3)))

    return "; ".join(parts)


def main() -> None:
    quick = "--quick" in sys.argv

    files = []
    for d in ("scripts", "caps"):
        dd = os.path.join(REPO_ROOT, d)
        if not os.path.isdir(dd):
            continue
        for fn in os.listdir(dd):
            if fn.endswith(".pcap"):
                files.append(os.path.join(dd, fn))
    files.sort()

    summaries = []
    for i, path in enumerate(files, 1):
        size = os.path.getsize(path)
        if quick and size > 25 * 1048576:
            print(f"[{i}/{len(files)}] SKIP (quick, {human_size(size)}): {os.path.basename(path)}")
            continue
        print(f"[{i}/{len(files)}] {os.path.basename(path)} ({human_size(size)}) ...", flush=True)
        try:
            summaries.append(summarize(path))
        except Exception as e:  # noqa: BLE001 — one bad capture must not abort the run
            print(f"    FEHLER: {e}", file=sys.stderr)

    write_markdown(summaries, quick)
    print(f"\nKatalog geschrieben: {CATALOG_MD}  ({len(summaries)} Captures)")


def _table(rows: list[dict]) -> list[str]:
    out = ["| Datei | Größe | Msgs | Kategorie |", "|-------|-------|-----:|-----------|"]
    for s in rows:
        out.append(
            f"| `{os.path.basename(s['path'])}` | {human_size(s['size'])} "
            f"| {s['n_msgs']} | {categorize(s)} |"
        )
    return out


def write_markdown(summaries: list[dict], quick: bool) -> None:
    caps = [s for s in summaries if os.path.sep + "caps" + os.path.sep in s["path"]]
    scripts = [s for s in summaries if s not in caps]

    total_size = sum(s["size"] for s in summaries)
    total_msgs = sum(s["n_msgs"] for s in summaries)

    # Aggregate undecoded sub-commands across all captures
    fingerprint: dict = defaultdict(lambda: {"count": 0, "files": [], "dirs": set(), "lens": set()})
    for s in summaries:
        for key, info in s["unknown"].items():
            fp = fingerprint[key]
            fp["count"] += info["count"]
            fp["files"].append(os.path.basename(s["path"]))
            fp["dirs"] |= info["dirs"]
            fp["lens"] |= info["lens"]

    lines: list[str] = []
    lines.append("# GP-200 Capture Catalog")
    lines.append("")
    lines.append(
        "Auto-generierter Katalog aller lokalen USB-MIDI Captures. "
        "Erzeugt mit `python scripts/build-capture-catalog.py` (nutzt `analyze-sysex.py`)."
    )
    lines.append("")
    lines.append(
        "> ⚠️ Die `.pcap`-Rohdaten sind **nicht** im Git-Repo (`scripts/*.pcap` untracked, "
        "`caps/` in `.gitignore`). Dieser Katalog ist die durchsuchbare Übersicht; die Binärdaten "
        "liegen nur lokal / im Backup."
    )
    lines.append("")
    lines.append(f"- **Captures:** {len(summaries)}" + ("  _(--quick: große Dateien übersprungen)_" if quick else ""))
    lines.append(f"- **Gesamtgröße:** {human_size(total_size)}")
    lines.append(f"- **SysEx-Nachrichten gesamt:** {total_msgs}")
    lines.append("")
    lines.append("Analyse einer einzelnen Datei: `python scripts/analyze-sysex.py <capture.pcap>`")
    lines.append("")

    if caps:
        lines.append("## Benannte Captures (`caps/`)")
        lines.append("")
        lines += _table(sorted(caps, key=lambda s: s["path"]))
        lines.append("")

    if scripts:
        lines.append("## Zeitstempel-Captures (`scripts/`)")
        lines.append("")
        # group by capture date parsed from filename
        by_date: dict = defaultdict(list)
        for s in scripts:
            m = FNAME_RE.search(s["path"])
            day = m.group(1) if m else "????????"
            by_date[day].append(s)
        for day in sorted(by_date):
            pretty = f"{day[0:4]}-{day[4:6]}-{day[6:8]}" if day != "????????" else "unbekannt"
            lines.append(f"### {pretty}")
            lines.append("")
            lines += _table(sorted(by_date[day], key=lambda s: s["path"]))
            lines.append("")

    lines.append("## Protokoll-Fingerprint: noch nicht (voll) dekodierte Sub-Commands")
    lines.append("")
    if fingerprint:
        lines.append("| Sub-Command | Hinweis | Vorkommen | Richtung | Payload-Längen | # Captures |")
        lines.append("|-------------|---------|----------:|----------|----------------|-----------:|")
        for key, fp in sorted(fingerprint.items(), key=lambda kv: -kv[1]["count"]):
            hint = UNKNOWN_HINTS.get(key, "—")
            dirs = "+".join(sorted(fp["dirs"])) or "?"
            lens = ",".join(str(x) for x in sorted(fp["lens"])[:8])
            lines.append(
                f"| `{key}` | {hint} | {fp['count']} | {dirs} | {lens} | {len(fp['files'])} |"
            )
        lines.append("")
        lines.append("Richtung: `H` = Host→Device, `D` = Device→Host.")
    else:
        lines.append("_Keine undekodierten Sub-Commands gefunden._")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("Verwandt: [`sysex-protocol.md`](sysex-protocol.md) · [`capture-todo.md`](capture-todo.md)")
    lines.append("")

    os.makedirs(os.path.dirname(CATALOG_MD), exist_ok=True)
    with open(CATALOG_MD, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    main()
