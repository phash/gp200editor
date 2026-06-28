# GP-200 Capture Catalog

Auto-generierter Katalog aller lokalen USB-MIDI Captures. Erzeugt mit `python scripts/build-capture-catalog.py` (nutzt `analyze-sysex.py`).

> ⚠️ Die `.pcap`-Rohdaten sind **nicht** im Git-Repo (`scripts/*.pcap` untracked, `caps/` in `.gitignore`). Dieser Katalog ist die durchsuchbare Übersicht; die Binärdaten liegen nur lokal / im Backup.

- **Captures:** 88
- **Gesamtgröße:** 488.8 MB
- **SysEx-Nachrichten gesamt:** 32675

Analyse einer einzelnen Datei: `python scripts/analyze-sysex.py <capture.pcap>`

## Benannte Captures (`caps/`)

| Datei | Größe | Msgs | Kategorie |
|-------|-------|-----:|-----------|
| `gp200-capture-20260318-231056.pcap` | 1.9 MB | 20 | Preset-Write → Slot [9] 'American Idiot'; Preset-Change (1×, #[10]); Toggle [EQ+,NR+,PRE-,WAH-]; CMD 12 sub 18 ×7 |
| `gp200-capture-20260318-232435.pcap` | 2.0 MB | 9 | Preset-Change (4×, #[7, 9, 10, 11]); Toggle [NR+,PRE-,VOL-] |
| `gp200-capture-20260318-232621.pcap` | 1.5 MB | 10 | Preset-Change (3×, #[9, 10, 11]); Toggle [NR+,PRE-]; CMD 12 sub 18 ×1 |
| `gp200-capture-20260318-235014.pcap` | 1.4 MB | 40 | Preset-Change (18×, #[0, 1, 2, 3, 4, 5, 6]) |
| `gp200-capture-20260318-235705.pcap` | 2.7 MB | 69 | IR/NAM multi-chunk upload (sub=0x1C) ×69 |
| `gp200-capture-20260318-235943.pcap` | 545 KB | 23 | IR/NAM multi-chunk upload (sub=0x1C) ×23 |
| `gp200-capture-20260319-072206.pcap` | 1.1 MB | 2173 | Preset-Read/State-Dump (257 Presets); CMD 11 sub 1C ×34; IR/NAM multi-chunk upload (sub=0x1C) ×30; CMD 11 sub 18 ×20; CMD 12 sub 18 ×20; state-dump chunk (sub=0x4E) ×5; CMD 11 sub 04 ×3; CMD 11 sub 12 ×1; CMD 11 sub 0A ×1; CMD 12 sub 0A ×1 |
| `gp200-capture-20260319-100548.pcap` | 9 KB | 14 | Preset-Change (1×, #[0]); Toggle [BOOST-,CAB+,DLY+,MOD+,PRE-,WAH-]; CMD 12 sub 18 ×1 |
| `gp200-capture-20260319-101538.pcap` | 15 KB | 43 | Preset-Change (1×, #[0]); Toggle [AMP+,CAB+,DLY+,PRE-,VOL+,VOL-,WAH-]; CMD 12 sub 18 ×23; param/effect-change or controller assignment (sub=0x14, 54B raw) ×3; CMD 12 sub 0C ×2; CMD 12 sub 08 ×2; CMD 12 sub 20 ×1 |
| `gp200-capture-20260319-101714.pcap` | 49 KB | 213 | Toggle [BOOST+,WAH-]; CMD 12 sub 18 ×203; param/effect-change or controller assignment (sub=0x14, 54B raw) ×3; CMD 12 sub 20 ×2; CMD 12 sub 0C ×1; CMD 12 sub 08 ×1 |
| `gp200-capture-20260319-102448.pcap` | 21.9 MB | 335 | CMD 12 sub 18 ×334 |
| `gp200-capture-20260319-102857.pcap` | 21.3 MB | 870 | CMD 12 sub 18 ×866; CMD 12 sub 0C ×2; param/effect-change or controller assignment (sub=0x14, 54B raw) ×1; CMD 12 sub 08 ×1 |
| `gp200-capture-20260319-103852.pcap` | 44.3 MB | 453 | Toggle [EQ-,PRE-,WAH-]; param/effect-change or controller assignment (sub=0x14, 54B raw) ×8 |
| `gp200-capture-20260319-104211.pcap` | 162.0 MB | 139 | Toggle [PRE+,PRE-]; param/effect-change or controller assignment (sub=0x14, 54B raw) ×64; CMD 12 sub 18 ×3 |
| `gp200-capture-20260319-104836.pcap` | 21.3 MB | 7 | Toggle [BOOST-]; CMD 12 sub 20 ×1; CMD 12 sub 18 ×1; CMD 12 sub 38 ×1 |
| `gp200-capture-20260319-105520.pcap` | 21.0 MB | 213 | fx_state_resp×213 |
| `gp200-capture-20260319-105713.pcap` | 27 KB | 23 | IR/NAM multi-chunk upload (sub=0x1C) ×23 |
| `gp200-capture-20260319-114423.pcap` | 7 KB | 6 | Toggle [PRE+]; CMD 12 sub 18 ×1 |
| `gp200-capture-20260319-114632.pcap` | 1.2 MB | 2211 | Preset-Read/State-Dump (259 Presets); CMD 11 sub 1C ×60; IR/NAM multi-chunk upload (sub=0x1C) ×54; state-dump chunk (sub=0x4E) ×10; CMD 11 sub 04 ×4; CMD 11 sub 12 ×2; CMD 11 sub 0A ×2; CMD 12 sub 0A ×2 |
| `gp200-capture-20260319-114725.pcap` | 34.4 MB | 2218 | Preset-Write → Slot [0] 'Pretender 3'; Preset-Read/State-Dump (258 Presets); Preset-Change (1×, #[0]); Toggle [?0B,?0C,?0D,?0E,?0F,AMP,BOOST,CAB,DLY,EQ,MOD,NR,PRE,PRE+,RVB,VOL,WAH,WAH-]; CMD 11 sub 1C ×60; IR/NAM multi-chunk upload (sub=0x1C) ×54; state-dump chunk (sub=0x4E) ×10; CMD 12 sub 18 ×6; CMD 11 sub 04 ×4; CMD 11 sub 12 ×2; CMD 11 sub 0A ×2; CMD 12 sub 0A ×2; CMD 12 sub 08 ×1 |
| `gp200-capture-20260319-221628.pcap` | 82.6 MB | 6 | Preset-Change (2×, #[0, 4]); Toggle [PRE-,VOL+] |
| `gp200-capture-20260319-222343.pcap` | 12 KB | 33 | Preset-Change (8×, #[0, 1, 2, 3, 4, 5, 6, 7]); Toggle [?0D+,CAB+,PRE-,VOL+,WAH+] |
| `gp200-capture-20260320-143029.pcap` | 13 KB | 14 | Preset-Change (1×, #[1]); Toggle [BOOST-,NR+,PRE-]; CMD 12 sub 20 ×1; CMD 12 sub 38 ×1; CMD 12 sub 18 ×1 |
| `gp200-capture-20260320-151140.pcap` | 1.1 MB | 2175 | Preset-Read/State-Dump (257 Presets); CMD 11 sub 1C ×32; IR/NAM multi-chunk upload (sub=0x1C) ×30; CMD 11 sub 18 ×20; CMD 12 sub 18 ×20; state-dump chunk (sub=0x4E) ×5; CMD 11 sub 04 ×3; CMD 11 sub 12 ×1; CMD 11 sub 0A ×1; CMD 12 sub 0A ×1 |
| `gp200-capture-20260320-152215.pcap` | 48 KB | 77 | Preset-Read/State-Dump (9 Presets); Preset-Change (2×, #[2]); Toggle [AMP,BOOST,NR+,PRE,PRE-,VOL+,WAH] |
| `gp200-capture-20260323-121456.pcap` | 6.9 MB | 2 | Toggle [EQ+,NR+] |
| `gp200-capture-20260323-121559.pcap` | 11 KB | 23 | CMD 12 sub 20 ×11; param/effect-change or controller assignment (sub=0x14, 54B raw) ×11 |
| `gp200-capture-20260323-121732.pcap` | 9 KB | 11 | Preset-Change (4×, #[1, 15]); Toggle [NR+,PRE-]; CMD 12 sub 18 ×1 |
| `gp200-capture-20260323-121825.pcap` | 10 KB | 17 | Preset-Change (4×, #[0, 1]); Toggle [NR+,PRE-,WAH-]; CMD 12 sub 18 ×1 |
| `gp200-capture-20260323-122109.pcap` | 15 KB | 51 | Preset-Change (5×, #[0]); Toggle [BOOST+,CAB+,NR+,PRE-,WAH-]; param/effect-change or controller assignment (sub=0x14, 54B raw) ×7; CMD 12 sub 0C ×7; CMD 12 sub 08 ×7; CMD 12 sub 18 ×5 |
| `gp200-capture-20260323-122305.pcap` | 31 KB | 149 | Preset-Change (1×, #[0]); Toggle [EQ-,NR+,PRE-,WAH-]; CMD 12 sub 18 ×1 |
| `gp200-capture-20260323-122704.pcap` | 22.3 MB | 34 | param/effect-change or controller assignment (sub=0x14, 54B raw) ×33 |
| `gp200-capture-20260323-122940.pcap` | 10.2 MB | 2 | param/effect-change or controller assignment (sub=0x14, 54B raw) ×1 |
| `gp200-capture-20260323-124534.pcap` | 71 KB | 124 | Preset-Read/State-Dump (14 Presets); Toggle [AMP,BOOST,BOOST+,CAB,NR,NR+,PRE,PRE-,VOL+,WAH] |
| `gp200-capture-20260323-124730.pcap` | 10 KB | 24 | Toggle [NR+,PRE-,VOL+] |
| `gp200-capture-20260323-130830.pcap` | 30 KB | 45 | Preset-Read/State-Dump (5 Presets); Toggle [BOOST+,BOOST-,NR+,PRE] |
| `gp200-capture-20260323-131350.pcap` | 7 KB | 4 | Toggle [BOOST+,NR+,PRE-,WAH-] |
| `gp200-capture-20260323-131507.pcap` | 7 KB | 6 | Toggle [BOOST+,NR+,PRE-,WAH-]; CMD 12 sub 18 ×1 |
| `gp200-capture-20260323-131738.pcap` | 16 KB | 22 | Preset-Read/State-Dump (2 Presets); Toggle [NR+,PRE,PRE-,WAH-]; CMD 12 sub 0C ×1; CMD 12 sub 08 ×1; CMD 12 sub 18 ×1 |
| `gp200-capture-20260323-134033.pcap` | 8 KB | 10 | CMD 12 sub 0C ×5; CMD 12 sub 08 ×4 |
| `gp200-capture-20260323-134538.pcap` | 45 KB | 12 | Toggle [MOD+]; CMD 12 sub 0C ×6; CMD 12 sub 08 ×5 |
| `gp200-capture-20260323-134828.pcap` | 45 KB | 10 | CMD 12 sub 0C ×4; CMD 12 sub 08 ×4; param/effect-change or controller assignment (sub=0x14, 54B raw) ×2 |
| `gp200-capture-20260323-140802.pcap` | 76 KB | 415 | Toggle [EQ-,NR+,PRE-,WAH-] |
| `gp200-capture-20260323-141104.pcap` | 19 KB | 75 | Toggle [PRE-,WAH-] |
| `gp200-capture-20260323-141331.pcap` | 145 KB | 651 | Preset-Read/State-Dump (8 Presets); Toggle [AMP,BOOST,EQ-,PRE,PRE-,WAH,WAH-]; state-dump chunk (sub=0x4E) ×5; CMD 11 sub 1C ×4; IR/NAM multi-chunk upload (sub=0x1C) ×3; CMD 11 sub 04 ×2; CMD 11 sub 12 ×1; CMD 11 sub 0A ×1; CMD 12 sub 0A ×1 |
| `gp200-capture-20260323-142122.pcap` | 8 KB | 14 | fx_state_resp×14 |
| `gp200-capture-20260323-142750.pcap` | 41 KB | 23 | IR/NAM multi-chunk upload (sub=0x1C) ×23 |
| `gp200-capture-20260323-143107.pcap` | 99 KB | 96 | Toggle [AMP+]; IR/NAM multi-chunk upload (sub=0x1C) ×90; param/effect-change or controller assignment (sub=0x14, 54B raw) ×2; CMD 12 sub 0C ×1; CMD 12 sub 08 ×1 |
| `gp200-capture-20260323-143826.pcap` | 63 KB | 45 | IR/NAM multi-chunk upload (sub=0x1C) ×45 |
| `gp200-capture-20260323-172312.pcap` | 11 KB | 22 | CMD 12 sub 0C ×9; param/effect-change or controller assignment (sub=0x14, 54B raw) ×6; CMD 12 sub 08 ×6 |
| `gp200-capture-20260323-172452.pcap` | 116 KB | 222 | Preset-Read/State-Dump (22 Presets); Preset-Change (4×, #[0]); Toggle [AMP,BOOST,CAB-,PRE,WAH,WAH-]; CMD 12 sub 08 ×12; param/effect-change or controller assignment (sub=0x14, 54B raw) ×9; CMD 12 sub 0C ×9 |
| `gp200-capture-20260323-172614.pcap` | 10 KB | 14 | CMD 12 sub 0C ×6; param/effect-change or controller assignment (sub=0x14, 54B raw) ×4; CMD 12 sub 08 ×4 |
| `gp200-capture-20260323-172728.pcap` | 10 KB | 18 | param/effect-change or controller assignment (sub=0x14, 54B raw) ×6; CMD 12 sub 0C ×6; CMD 12 sub 08 ×6 |
| `gp200-capture-20260323-174918.pcap` | 9 KB | 9 | Toggle [AMP+]; param/effect-change or controller assignment (sub=0x14, 54B raw) ×3; CMD 12 sub 0C ×3; CMD 12 sub 08 ×2 |
| `gp200-capture-20260323-175101.pcap` | 8.5 MB | 2267 | Preset-Read/State-Dump (257 Presets); Toggle [?0B,?0B+,?0C,?0C+,?0D,?0E,?0F,AMP,AMP+,BOOST,CAB,DLY,EQ,MOD,NR,PRE,PRE+,RVB,VOL,VOL+,WAH,WAH-]; CMD 11 sub 04 ×45; CMD 11 sub 1C ×30; IR/NAM multi-chunk upload (sub=0x1C) ×30; CMD 11 sub 12 ×23; CMD 12 sub 12 ×22; CMD 11 sub 18 ×20; CMD 12 sub 18 ×20; state-dump chunk (sub=0x4E) ×5; param/effect-change or controller assignment (sub=0x14, 54B raw) ×2; CMD 12 sub 0C ×1; CMD 12 sub 08 ×1; CMD 11 sub 0A ×1; CMD 12 sub 0A ×1; CMD 12 sub 04 ×1 |
| `gp200-capture-20260323-180104.pcap` | 2.3 MB | 54 | Toggle [AMP+]; IR/NAM multi-chunk upload (sub=0x1C) ×45; param/effect-change or controller assignment (sub=0x14, 54B raw) ×3; CMD 12 sub 0C ×2; CMD 12 sub 08 ×2 |
| `gp200-capture-20260323-182027.pcap` | 317 KB | 4 | CMD 11 sub 04 ×2; CMD 11 sub 12 ×1; CMD 12 sub 12 ×1 |
| `gp200-capture-20260323-183245.pcap` | 30 KB | 23 | IR/NAM multi-chunk upload (sub=0x1C) ×23 |
| `gp200-capture-20260323-200453.pcap` | 7 KB | 3 | Preset-Change (1×, #[0]); Toggle [PRE-,RVB+] |
| `gp200-capture-20260323-200517.pcap` | 22 KB | 80 | Toggle [PRE-]; param/effect-change or controller assignment (sub=0x14, 54B raw) ×25; CMD 12 sub 18 ×9; CMD 12 sub 08 ×1 |
| `gp200-capture-20260323-201458.pcap` | 33 KB | 170 | fx_state_resp×170 |
| `gp200-capture-20260323-203246.pcap` | 43 KB | 30 | Preset-Read/State-Dump (2 Presets); Preset-Change (2×, #[0, 1]); Toggle [PRE,PRE-,RVB+,WAH,WAH-]; CMD 12 sub 18 ×2; CMD 12 sub 08 ×1 |
| `gp200-capture-20260323-203344.pcap` | 24 KB | 26 | Preset-Read/State-Dump (2 Presets); Preset-Change (2×, #[0, 2]); Toggle [BOOST,PRE,PRE-,RVB+,WAH-]; CMD 12 sub 18 ×1; CMD 12 sub 08 ×1 |
| `gp200-capture-20260323-203439.pcap` | 42 KB | 36 | Toggle [PRE-,WAH-]; param/effect-change or controller assignment (sub=0x14, 54B raw) ×18 |
| `gp200-capture-20260323-203547.pcap` | 20 KB | 8 | Toggle [PRE-]; CMD 12 sub 18 ×2; CMD 12 sub 08 ×1 |
| `gp200-capture-20260323-203642.pcap` | 63 KB | 113 | Preset-Read/State-Dump (12 Presets); Preset-Change (3×, #[0, 1]); Toggle [AMP,BOOST,PRE,PRE-,RVB+,WAH,WAH-]; CMD 12 sub 08 ×3; CMD 12 sub 18 ×2 |
| `gp200-capture-20260323-203730.pcap` | 27 KB | 31 | Preset-Change (2×, #[0, 1]); Toggle [PRE-,RVB+,WAH-]; param/effect-change or controller assignment (sub=0x14, 54B raw) ×9; CMD 12 sub 18 ×1; CMD 12 sub 08 ×1 |
| `gp200-capture-20260323-203838.pcap` | 33 KB | 44 | Preset-Change (1×, #[0]); Toggle [PRE-,RVB+,WAH-]; param/effect-change or controller assignment (sub=0x14, 54B raw) ×20 |
| `gp200-capture-20260323-204011.pcap` | 23 KB | 87 | Toggle [PRE-]; param/effect-change or controller assignment (sub=0x14, 54B raw) ×42; CMD 12 sub 18 ×1 |
| `gp200-capture-20260323-204352.pcap` | 9 KB | 12 | Toggle [PRE-]; CMD 12 sub 18 ×3 |
| `gp200-capture-20260323-210733.pcap` | 7 KB | 1 | CMD 12 sub 18 ×1 |
| `gp200-capture-20260323-210958.pcap` | 62 KB | 107 | Preset-Read/State-Dump (11 Presets); Preset-Change (1×, #[1]); Toggle [AMP,BOOST,EQ+,PRE,PRE-,WAH,WAH-]; state-dump chunk (sub=0x4E) ×5; CMD 11 sub 04 ×2; CMD 11 sub 1C ×2; CMD 12 sub 18 ×2; CMD 11 sub 12 ×1; CMD 11 sub 0A ×1; CMD 12 sub 0A ×1; IR/NAM multi-chunk upload (sub=0x1C) ×1 |
| `gp200-capture-20260323-211407.pcap` | 1.2 MB | 2287 | Preset-Read/State-Dump (266 Presets); CMD 11 sub 1C ×64; IR/NAM multi-chunk upload (sub=0x1C) ×39; CMD 12 sub 18 ×21; CMD 11 sub 18 ×20; state-dump chunk (sub=0x4E) ×5; CMD 11 sub 04 ×4; CMD 11 sub 0A ×2; CMD 12 sub 0A ×2; CMD 11 sub 12 ×1 |
| `gp200-capture-20260323-211645.pcap` | 9 KB | 10 | Toggle [PRE-]; CMD 12 sub 18 ×4; CMD 12 sub 08 ×1 |
| `gp200-capture-20260323-212146.pcap` | 7 KB | 3 | Toggle [PRE-]; CMD 12 sub 18 ×1; CMD 12 sub 08 ×1 |
| `gp200-capture-20260324-084047.pcap` | 1.6 MB | 2169 | Preset-Read/State-Dump (257 Presets); CMD 11 sub 1C ×30; IR/NAM multi-chunk upload (sub=0x1C) ×30; CMD 11 sub 18 ×21; CMD 12 sub 18 ×20; state-dump chunk (sub=0x4E) ×5; CMD 11 sub 04 ×3; CMD 11 sub 12 ×1; CMD 11 sub 0A ×1; CMD 12 sub 0A ×1 |
| `gp200-capture-20260324-084156.pcap` | 1.1 MB | 2172 | Preset-Read/State-Dump (257 Presets); Toggle [?0B,?0C,?0D,?0E,?0F,AMP,BOOST,CAB,DLY,EQ,EQ+,MOD,NR,PRE,PRE-,RVB,VOL,WAH,WAH-]; CMD 11 sub 1C ×31; IR/NAM multi-chunk upload (sub=0x1C) ×30; CMD 11 sub 18 ×20; CMD 12 sub 18 ×20; state-dump chunk (sub=0x4E) ×5; CMD 11 sub 04 ×3; CMD 11 sub 12 ×1; CMD 11 sub 0A ×1; CMD 12 sub 0A ×1 |
| `gp200-capture-20260324-085205.pcap` | 197 KB | 1073 | Toggle [?0B+,?0C+,?0D+,?0E+,?0F+,AMP+,BOOST+,CAB+,DLY+,EQ+,MOD+,NR+,PRE+,PRE-,RVB+,VOL+,WAH+,WAH-] |
| `gp200-capture-20260324-142215.pcap` | 1.5 MB | 1328 | Preset-Read/State-Dump (166 Presets) |
| `gp200-capture-20260324-142234.pcap` | 6.7 MB | 2179 | Preset-Read/State-Dump (257 Presets); Toggle [?0B,?0C,?0D,?0E,?0F,AMP,BOOST,CAB,DLY,EQ,EQ+,EQ-,MOD,NR,PRE,RVB,RVB+,VOL,WAH,WAH-]; CMD 11 sub 1C ×31; IR/NAM multi-chunk upload (sub=0x1C) ×30; CMD 11 sub 18 ×20; CMD 12 sub 18 ×20; state-dump chunk (sub=0x4E) ×5; CMD 11 sub 04 ×4; CMD 11 sub 12 ×2; CMD 11 sub 0A ×1; CMD 12 sub 0A ×1 |
| `gp200-capture-20260324-142321.pcap` | 1.2 MB | 2253 | Preset-Read/State-Dump (257 Presets); Toggle [?0B,?0C,?0D,?0E,?0F,AMP,AMP+,BOOST,CAB,CAB+,CAB-,DLY,EQ,MOD,NR,PRE,RVB,VOL,WAH,WAH-]; IR/NAM multi-chunk upload (sub=0x1C) ×98; CMD 11 sub 1C ×30; CMD 11 sub 18 ×20; CMD 12 sub 18 ×20; state-dump chunk (sub=0x4E) ×5; param/effect-change or controller assignment (sub=0x14, 54B raw) ×4; CMD 11 sub 04 ×3; CMD 12 sub 0C ×2; CMD 12 sub 08 ×2; CMD 11 sub 12 ×1; CMD 11 sub 0A ×1; CMD 12 sub 0A ×1 |
| `gp200-capture-20260412-143509.pcap` | 70 KB | 329 | CMD 12 sub 18 ×329 |
| `gp200-capture-20260412-143552.pcap` | 223 KB | 1093 | Toggle [CAB+,CAB-]; CMD 12 sub 18 ×1086; param/effect-change or controller assignment (sub=0x14, 54B raw) ×1; CMD 12 sub 0C ×1; CMD 12 sub 08 ×1 |
| `gp200-capture-20260412-143745.pcap` | 12 KB | 11 | Preset-Write → Slot [9] 'American Idiot'; Preset-Change (1×, #[1]); Toggle [NR+,PRE-,WAH-] |
| `gp200-capture-20260412-150422.pcap` | 533 KB | 1015 | Preset-Read/State-Dump (117 Presets); CMD 12 sub 18 ×74 |
| `gp200-capture-20260412-150809.pcap` | 14 KB | 51 | CMD 12 sub 18 ×49 |
| `gp200-capture-20260518-075745.pcap` | 10 KB | 21 | CMD 12 sub 20 ×10; param/effect-change or controller assignment (sub=0x14, 54B raw) ×10 |
| `gp200-capture-20260518-075856.pcap` | 14 KB | 41 | Preset-Change (1×, #[1]); Toggle [PRE-,RVB+,WAH-]; CMD 12 sub 20 ×18; param/effect-change or controller assignment (sub=0x14, 54B raw) ×18; CMD 12 sub 18 ×1 |

## Protokoll-Fingerprint: noch nicht (voll) dekodierte Sub-Commands

| Sub-Command | Hinweis | Vorkommen | Richtung | Payload-Längen | # Captures |
|-------------|---------|----------:|----------|----------------|-----------:|
| `cmd12_sub18` | — | 3186 | D+H | 52 | 43 |
| `cmd12_sub1C` | IR/NAM multi-chunk upload (sub=0x1C) | 770 | D+H | 60,200,340,370 | 20 |
| `cmd11_sub1C` | — | 408 | H | 60 | 12 |
| `cmd12_sub14` | param/effect-change or controller assignment (sub=0x14, 54B raw) | 315 | D+H | 44 | 27 |
| `cmd11_sub18` | — | 161 | H | 52 | 8 |
| `cmd11_sub04` | — | 82 | H | 12 | 13 |
| `cmd12_sub08` | — | 73 | D | 50,66,80,96,110,112,142 | 27 |
| `cmd12_sub4E` | state-dump chunk (sub=0x4E) | 70 | D | 216,374 | 12 |
| `cmd12_sub0C` | — | 68 | D | 28,58 | 18 |
| `cmd12_sub20` | — | 44 | H | 68 | 7 |
| `cmd11_sub12` | — | 38 | H | 4 | 13 |
| `cmd12_sub12` | — | 23 | D+H | 4,5 | 2 |
| `cmd11_sub0A` | — | 15 | H | 24 | 12 |
| `cmd12_sub0A` | — | 15 | D | 24 | 12 |
| `cmd12_sub38` | — | 2 | H | 116 | 2 |
| `cmd12_sub04` | — | 1 | H | 12 | 1 |

Richtung: `H` = Host→Device, `D` = Device→Host.

---

Verwandt: [`sysex-protocol.md`](sysex-protocol.md) · [`capture-todo.md`](capture-todo.md)
