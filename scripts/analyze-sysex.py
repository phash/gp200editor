#!/usr/bin/env python3
"""
GP-200 SysEx Protocol Analyzer
=================================
Decodes USB MIDI SysEx captures (pcapng) for the Valeton GP-200.

Usage:
  python analyze-sysex.py <capture.pcap>
  python analyze-sysex.py                # uses default path (see DEFAULT_PCAP below)

Windows capture workflow:
  1. Wireshark 4.x mit tshark + USBPcap installieren (Checkbox im Installer)
  2. GP-200 per USB anschließen (Normalmodus: 6-In/4-Out)
  3. PowerShell (Admin): scripts\capture-windows.ps1
     → Interface auswählen → Valeton-Editor/Browser bedienen → ENTER
  4. python scripts\analyze-sysex.py <capture.pcap>

Linux capture workflow:
  sudo modprobe usbmon
  tshark -i usbmon3 -w capture.pcap   # Bus-Nr. aus: lsusb | grep -i valeton
  python3 scripts/analyze-sysex.py capture.pcap

Protocol (fully confirmed 2026-03-18, sources: own USB captures + GP-200LT Reddit post):
  Header:  F0 21 25 7E 47 50 2D 32 [CMD] [PAYLOAD...] F7
  CMD:
    0x11 = REQUEST  (host → device: query state/data)
    0x12 = SET/RESP (host → device: write; device → host: response)

  Data Encoding: NIBBLE ENCODING
    Every SysEx data byte holds only 4 bits (values 0x00-0x0F).
    Two consecutive nibble-bytes form one decoded byte:
      decoded[i] = (raw[2i] << 4) | raw[2i+1]
    This is NOT Roland 7-bit encoding. Used for ALL preset data.

  Sub-commands (byte 9):
    0x08 (SET)    → Change active preset: byte 26 = preset number (0-based)
    0x08 (RESP)   → FX block state response
    0x10 (SET)    → Toggle FX block on/off (46B): byte 38 = block ID, byte 40 = state
    0x10 (REQ)    → CMD=0x11: Request full preset data
    0x18 (D→H)   → Preset data chunks (READ): 7 chunks/preset, nibble-encoded
                    Chunk header: [0x18] [slot:1B] [offset:2B LE] [nibble-data...]
                    7 chunks × 370 nibble bytes (last chunk: 132) = 2352 total → 1176B decoded
    0x20 (H→D)   → Preset chunk write (WRITE): 4 chunks/preset, nibble-encoded
                    Chunk header: [0x20] [slot:1B] [offset:2B LE] [nibble-data...]
                    4 chunks × 366 nibble bytes = 1464 total → 732B decoded
    0x4E (D→H)   → Initial state dump on connect (same chunk format as 0x18)

  READ Decoded Preset Format (1176 bytes per preset):
    [0:28]    28B header: constant prefix + slot# at [6:8] LE16 + metadata
    [28:60]   32B name: null-terminated ASCII (max 31 chars)
    [60:100]  40B zeros (padding)
    [100:108] 8B constant: 08 00 10 00 [slot:2B] 04 04
    [108:119] 11B block routing order (signal chain, block IDs 0x00-0x0A)
    [119]     1B 00 terminator
    [120:912] 11×72B effect blocks — IDENTICAL structure to .prst file blocks:
                +0  4B  14 00 44 00   marker
                +4  1B  slot index (0-10)
                +5  1B  active flag (0=bypass, 1=on)
                +6  2B  00 0F (constant)
                +8  4B  effect ID (LE uint32, high byte = module type)
                +12 60B 15× float32 LE (parameters)
    [912:1176] 264B trailing (controller/pedal assignments)

  WRITE Decoded Format (732 bytes):
    [0:36]    36B write header (similar to read but with 0x27 markers)
    [36:68]   32B name (same position offset from name-start as read)
    [68:128]  60B middle section with routing table
    [128:704] 8×72B effect blocks 0-7 (complete)
    [704:732] 28B effect block 8 partial (marker+slot+active+const+effID+4 params)
    Note: blocks 9 (RVB) and 10 (VOL) are NOT sent; device keeps existing values.

  Device: 256 preset slots (0-255), factory defaults at slots 249-255 ("It's GP-200")

  Block IDs (byte 38 in toggle command):
    0x00=PRE  0x01=WAH  0x02=BOOST  0x03=AMP  0x04=NR
    0x05=CAB  0x06=EQ   0x07=MOD    0x08=DLY  0x09=RVB  0x0A=VOL

  Read Protocol (one preset):
    Host → CMD=0x11, sub=0x10, 46B with slot# at bytes 16, 29, 33
    Device → 7 sub=0x18 chunks → nibble-decode → 1176B preset data
    Name at decoded[28], effect blocks at decoded[120] (11×72B)

  Write Protocol (one preset):
    Construct 732B payload (see WRITE format above)
    Nibble-encode → 1464B nibble data
    Split into 4 chunks with offsets 0, 311, 622, 1061
    Host → CMD=0x12, sub=0x20 for each chunk

  See also: docs/sysex-protocol.md
"""

import sys
import os
import struct
import subprocess

# ---- Platform helpers -------------------------------------------------------

def find_tshark() -> str:
    """Find tshark executable; searches PATH then common Windows install paths."""
    candidates = ["tshark"]
    if sys.platform == "win32":
        candidates += [
            r"C:\Program Files\Wireshark\tshark.exe",
            r"C:\Program Files (x86)\Wireshark\tshark.exe",
        ]
    for c in candidates:
        try:
            subprocess.run([c, "--version"], capture_output=True, check=True)
            return c
        except (FileNotFoundError, subprocess.CalledProcessError):
            continue
    print("FEHLER: tshark nicht gefunden.", file=sys.stderr)
    print("  Windows: Wireshark installieren mit 'TShark' und 'USBPcap' (Checkboxen im Installer)", file=sys.stderr)
    print("  Linux:   sudo apt install tshark", file=sys.stderr)
    sys.exit(1)

def default_pcap() -> str:
    if sys.platform == "win32":
        return os.path.join(os.path.expanduser("~"), "Desktop", "gp200-capture.pcap")
    return "/home/manuel/gp200-capture-windows.pcap"

SYSEX_HEADER = bytes([0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32])

# Block IDs used in toggle commands (byte 38)
BLOCK_NAMES = {
    0x00: 'PRE', 0x01: 'WAH', 0x02: 'BOOST', 0x03: 'AMP', 0x04: 'NR',
    0x05: 'CAB', 0x06: 'EQ',  0x07: 'MOD',   0x08: 'DLY', 0x09: 'RVB', 0x0A: 'VOL',
}


def decode_usb_midi(hexstr: str) -> bytes:
    """Extract MIDI bytes from USB MIDI Event Packets (4 bytes each, USB MIDI 1.0 spec)."""
    midi, _ = decode_usb_midi_ex(hexstr)
    return midi


def decode_usb_midi_ex(hexstr: str) -> tuple[bytes, bool]:
    """Extract MIDI bytes and whether SysEx end (F7) was found.

    Returns (midi_bytes, has_sysex_end).
    Handles CIN 4 (continue), 5/6/7 (end with 1/2/3 bytes),
    and CIN 0xF (single byte, used by GP-200 for standalone F7 ACKs).
    """
    data = bytes.fromhex(hexstr.replace(':', '').replace(' ', ''))
    midi = bytearray()
    has_end = False
    i = 0
    while i + 3 < len(data):
        cin = data[i] & 0x0F
        if cin == 0x4:   # SysEx continue (3 bytes)
            midi.extend(data[i+1:i+4])
        elif cin == 0x5: # SysEx end (1 byte)
            midi.append(data[i+1])
            has_end = True
        elif cin == 0x6: # SysEx end (2 bytes)
            midi.extend(data[i+1:i+3])
            has_end = True
        elif cin == 0x7: # SysEx end (3 bytes)
            midi.extend(data[i+1:i+4])
            has_end = True
        elif cin == 0xF: # Single byte (GP-200 uses for standalone F7 ACK)
            midi.append(data[i+1])
            if data[i+1] == 0xF7:
                has_end = True
        i += 4
    return bytes(midi), has_end


def nibble_decode(data: bytes) -> bytes:
    """Decode nibble-encoded SysEx data: each pair of 4-bit bytes → one decoded byte."""
    out = bytearray()
    for i in range(0, len(data) - 1, 2):
        out.append((data[i] << 4) | data[i + 1])
    return bytes(out)


def nibble_encode(data: bytes) -> bytes:
    """Encode bytes as nibble-encoded SysEx: each byte → two 4-bit nibble bytes."""
    out = bytearray()
    for b in data:
        out.append((b >> 4) & 0x0F)
        out.append(b & 0x0F)
    return bytes(out)


def decode_midi_7bit(data: bytes) -> bytes:
    """
    Decode 7-bit MIDI encoding (Roland-style) — UNUSED for GP-200.
    The GP-200 uses nibble encoding, not this format.
    Kept for reference only.
    """
    out = bytearray()
    i = 0
    while i + 7 < len(data):
        msb = data[i]
        for j in range(7):
            if i + 1 + j >= len(data):
                break
            byte = data[i + 1 + j] | ((msb >> j & 1) << 7)
            out.append(byte)
        i += 8
    return bytes(out)


def parse_messages(pcap_path: str) -> list[dict]:
    """Extract all GP-200 SysEx messages from a pcapng capture.

    Works with both Linux (usbmon) and Windows (USBPcap) captures.
    On Windows, the usbaudio dissector consumes bulk data so we disable it
    to get raw USB MIDI bytes in usb.capdata.

    SysEx messages can span multiple USB frames — we accumulate MIDI bytes
    across consecutive frames (same direction) until F7 is found.
    """
    tshark = find_tshark()
    result = subprocess.run(
        [tshark, '--disable-protocol', 'usbaudio',
         '-r', pcap_path,
         '-T', 'fields',
         '-e', 'frame.number',
         '-e', 'frame.time_relative',
         '-e', 'usb.src',
         '-e', 'usb.endpoint_address.direction',
         '-e', 'usb.capdata',
         '-e', 'usb.data_fragment'],
        capture_output=True, text=True
    )
    if result.returncode != 0 and result.stderr:
        print(f"tshark Fehler: {result.stderr.strip()}", file=sys.stderr)

    messages = []
    # Multi-frame SysEx accumulator
    midi_buffer = bytearray()
    buffer_meta = None  # (pkt_num, timestamp, direction)

    for line in result.stdout.strip().split('\n'):
        parts = line.split('\t')
        if len(parts) < 5:
            continue

        pkt_num_s, timestamp_s, src, ep_dir_s = parts[0], parts[1], parts[2], parts[3]
        capdata    = parts[4] if len(parts) > 4 else ''
        datafrag   = parts[5] if len(parts) > 5 else ''
        hexdata    = capdata or datafrag
        if not hexdata:
            continue

        try:
            pkt_num   = int(pkt_num_s)
            timestamp = float(timestamp_s)
        except ValueError:
            continue

        # Direction: prefer endpoint direction flag (works on both Linux + Windows)
        if ep_dir_s == '0':
            direction = 'host->dev'
        elif ep_dir_s == '1':
            direction = 'dev->host'
        else:
            direction = 'host->dev' if src == 'host' else 'dev->host'

        midi_bytes, has_sysex_end = decode_usb_midi_ex(hexdata)
        if not midi_bytes:
            continue

        # New SysEx start?
        if midi_bytes[0] == 0xF0:
            midi_buffer = bytearray(midi_bytes)
            buffer_meta = (pkt_num, timestamp, direction)
        elif buffer_meta:
            # Continuation frame — append to existing buffer
            midi_buffer.extend(midi_bytes)

        # If SysEx end found, assemble complete message
        if has_sysex_end and buffer_meta and len(midi_buffer) >= 10:
            midi = bytes(midi_buffer)
            if midi[:8] == SYSEX_HEADER:
                cmd = midi[8]
                payload = midi[9:-1]  # strip F7

                msg = {
                    'pkt': buffer_meta[0],
                    'time': buffer_meta[1],
                    'direction': buffer_meta[2],
                    'cmd': cmd,
                    'payload': payload,
                    'raw_midi': midi,
                }
                # Classify by (cmd, sub-command, length)
                if len(payload) >= 1:
                    sub = payload[0]

                    if cmd == 0x11 and sub == 0x10 and len(payload) <= 46:
                        if len(payload) > 12 and payload[12] == 0x01:
                            msg['type'] = 'req_patch'
                            if len(payload) > 17:
                                msg['preset_num'] = payload[17]
                        else:
                            msg['type'] = 'req_fx_state'
                            if len(payload) > 29:
                                block_id = payload[29]
                                msg['block_id'] = block_id
                                msg['block_name'] = BLOCK_NAMES.get(block_id, f'?{block_id:02X}')

                    elif cmd == 0x11 and sub == 0x20:
                        msg['type'] = 'req_patch_name'
                        if len(payload) > 17:
                            msg['preset_num'] = payload[17]

                    elif cmd == 0x12 and sub == 0x08 and len(payload) <= 30:
                        if direction == 'host->dev' and len(payload) > 17 and payload[5] == 0x08:
                            msg['type'] = 'change_preset'
                            msg['preset_num'] = payload[17]
                        else:
                            msg['type'] = 'fx_state_resp'
                            if len(payload) > 15:
                                msg['block_id'] = payload[13]
                                msg['block_name'] = BLOCK_NAMES.get(payload[13], f'?{payload[13]:02X}')
                                msg['state'] = payload[15]

                    elif cmd == 0x12 and sub == 0x10 and len(payload) <= 46:
                        msg['type'] = 'toggle_fx'
                        if len(payload) > 31:
                            block_id = payload[29]
                            state = payload[31]
                            msg['block_id'] = block_id
                            msg['block_name'] = BLOCK_NAMES.get(block_id, f'?{block_id:02X}')
                            msg['state'] = state

                    elif cmd == 0x12 and sub == 0x18 and len(payload) > 100:
                        msg['type'] = 'preset_read_chunk'
                        msg['slot'] = payload[1]
                        msg['offset'] = struct.unpack_from('<H', payload, 2)[0]
                        msg['data'] = payload[4:]

                    elif cmd == 0x12 and sub == 0x20 and len(payload) > 100:
                        msg['type'] = 'preset_chunk'
                        msg['slot'] = payload[1]
                        msg['offset'] = struct.unpack_from('<H', payload, 2)[0]
                        msg['data'] = payload[4:]

                    elif sub == 0x10 and len(payload) > 36:
                        msg['type'] = 'capabilities'

                    else:
                        msg['type'] = f'unknown_cmd{cmd:02X}_sub{sub:02X}'

                messages.append(msg)
            # Reset buffer
            midi_buffer = bytearray()
            buffer_meta = None

    return messages


def reconstruct_preset(messages: list[dict], slot: int | None = None) -> dict[int, bytes]:
    """
    Reconstruct preset bytes from preset_chunk messages (CMD=0x12, sub=0x20 write chunks).
    Assembly: concatenate all chunks' nibble data in chunk order, then nibble-decode.
    Returns dict: slot → decoded binary data (732 bytes per preset).

    Decoded write format (732 bytes):
      [0:36]   write header (with 0x27 markers)
      [36:68]  preset name (null-terminated ASCII, 32 bytes)
      [68:128] middle section (routing table in last 20 bytes)
      [128:704] effect blocks 0-7 (8 × 72 bytes, identical to .prst format)
      [704:732] effect block 8 partial (first 28 bytes, DLY)
    """
    chunks_by_slot: dict[int, list[tuple[int, bytes]]] = {}
    for m in messages:
        if m.get('type') != 'preset_chunk':
            continue
        s = m['slot']
        if slot is not None and s != slot:
            continue
        chunks_by_slot.setdefault(s, []).append((m['offset'], m['data']))

    results = {}
    for s, chunks in chunks_by_slot.items():
        # Sort by chunk order (offset) and concatenate all nibble data
        chunks.sort(key=lambda x: x[0])
        all_nibbles = bytearray()
        for _, data in chunks:
            all_nibbles.extend(data)
        results[s] = nibble_decode(bytes(all_nibbles))

    return results


def generate_toggle_fx(block_id: int, enabled: bool) -> bytes:
    """
    Generate the SysEx message to toggle an effect block on/off.
    block_id: see BLOCK_NAMES dict above (0x00=PRE ... 0x0A=VOL)
    enabled: True = active, False = bypass
    """
    # Template from confirmed GP-200LT captures (same protocol as GP-200)
    # Context bytes vary for PRE/BOOST vs others — using the common form here
    msg = bytearray([
        0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,  # header
        0x12, 0x10,                                          # CMD=SET, sub=TOGGLE_FX
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,   # bytes 10-17
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,   # bytes 18-25
        0x01, 0x00, 0x00, 0x01, 0x05, 0x00, 0x00, 0x00,   # bytes 26-33
        0x04, 0x00, 0x00, 0x00,                             # bytes 34-37
        block_id,                                            # byte 38: block ID
        0x00,                                                # byte 39
        0x01 if enabled else 0x00,                          # byte 40: state
        0x0C, 0x0F, 0x00, 0x02,                            # bytes 41-44
        0xF7,
    ])
    return bytes(msg)


def generate_change_preset(preset_num: int) -> bytes:
    """
    Generate the SysEx message to switch to a preset.
    preset_num: 0-based preset index
    """
    msg = bytearray([
        0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,  # header
        0x12, 0x08,                                          # CMD=SET, sub=CHANGE_PRESET
        0x00, 0x00, 0x00, 0x00, 0x08, 0x01, 0x00, 0x00,   # bytes 10-17
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,   # bytes 18-25
        preset_num & 0x7F,                                   # byte 26: preset number (0-based)
        0x00, 0x00,                                          # bytes 27-28
        0xF7,
    ])
    return bytes(msg)


def generate_request_patch_name(preset_num: int) -> bytes:
    """
    Generate the SysEx message to request a preset's name.
    preset_num: 0-based preset index
    """
    n = preset_num & 0x7F
    msg = bytearray([
        0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,  # header
        0x11, 0x20,                                          # CMD=REQ, sub=REQ_PATCH_NAME
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        n,                                                   # byte 26
        0x00, 0x00, 0x00,
        0x07, 0x00, 0x00, 0x01, 0x04, 0x00, 0x00, 0x00,
        n,                                                   # byte 37
        0x00, 0x00, 0x00,
        n,                                                   # byte 41
        0x00, 0x00,
        0xF7,
    ])
    return bytes(msg)


def print_summary(messages: list[dict]) -> None:
    print(f"{'Pkt':>4}  {'Time':>8}  {'Dir':>10}  {'CMD':>5}  {'Type':<22}  {'Details'}")
    print('-' * 90)
    for m in messages:
        details = ''
        t = m.get('type', '?')
        if t == 'preset_chunk':
            details = f"slot={m['slot']} offset={m['offset']} data={len(m['data'])}B"
        elif t in ('toggle_fx', 'req_fx_state', 'fx_state_resp'):
            block = m.get('block_name', '?')
            state = m.get('state')
            state_str = ('ON' if state else 'OFF') if state is not None else '?'
            details = f"block={block} state={state_str}"
        elif t in ('change_preset', 'req_patch', 'req_patch_name'):
            details = f"preset={m.get('preset_num', '?')}"
        elif t in ('preset_chunk', 'preset_read_chunk'):
            details = f"slot={m.get('slot','?')} offset={m.get('offset','?')} data={len(m.get('data',b''))}B"
        else:
            details = f"payload={m['payload'][:10].hex(' ')}"
        print(f"{m['pkt']:>4}  {m['time']:>8.3f}  {m['direction']:>10}  "
              f"0x{m['cmd']:02X}  {t:<22}  {details}")


def decode_all_read_presets(messages: list[dict]) -> dict[int, bytes]:
    """
    Reconstruct all presets from sub=0x18 READ chunks.
    Groups chunks by offset==0 boundaries, concatenates nibble data, decodes.
    Returns dict: group_index → decoded bytes (1176B per preset).
    """
    chunks = [(m['pkt'], m['slot'], m['offset'], m['data'])
              for m in messages if m.get('type') == 'preset_read_chunk']
    chunks.sort(key=lambda x: x[0])  # sort by frame number

    groups: list[list] = []
    current: list = []
    for frame, slot, offset, data in chunks:
        if offset == 0 and current:
            groups.append(current)
            current = []
        current.append((offset, data))
    if current:
        groups.append(current)

    result = {}
    for gi, group in enumerate(groups):
        group_sorted = sorted(group, key=lambda x: x[0])
        all_nibbles = bytearray()
        for _, data in group_sorted:
            all_nibbles.extend(data)
        decoded = nibble_decode(bytes(all_nibbles))
        result[gi] = decoded
    return result


if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else default_pcap()
    if not os.path.exists(path):
        print(f"FEHLER: Datei nicht gefunden: {path}", file=sys.stderr)
        print(f"  Verwendung: python analyze-sysex.py <capture.pcap>", file=sys.stderr)
        sys.exit(1)
    print(f"Analysiere: {path}\n")

    messages = parse_messages(path)
    print_summary(messages)

    print("\n--- Preset-WRITE Rekonstruktion (sub=0x20 chunks) ---")
    presets = reconstruct_preset(messages)
    if not presets:
        print("  (keine preset_chunk Nachrichten gefunden)")
    for slot, data in presets.items():
        # Write format: name at offset 36, effect blocks at 128
        name_raw = data[36:68].split(b'\x00')[0]
        name = name_raw.decode('ascii', errors='replace')
        block_marker_count = sum(1 for i in range(len(data)-3)
                                 if data[i:i+4] == bytes([0x14, 0x00, 0x44, 0x00]))
        print(f"  Slot {slot:2d}: {len(data)}B  name='{name}'  effect_blocks={block_marker_count}")

    print("\n--- Preset-READ Gruppen (sub=0x18 chunks) ---")
    read_presets = decode_all_read_presets(messages)
    if not read_presets:
        print("  (keine preset_read_chunk Nachrichten gefunden)")
    for gi, data in list(read_presets.items())[:20]:  # show first 20
        name_raw = data[28:60].split(b'\x00')[0]
        name = name_raw.decode('ascii', errors='replace')
        slot = data[6] | (data[7] << 8)
        print(f"  Gruppe {gi:3d}: slot={slot:3d} decoded={len(data)}B  name='{name}'")
    if len(read_presets) > 20:
        print(f"  ... ({len(read_presets)} Gruppen gesamt)")

    print("\n--- Toggle FX Beispiele ---")
    for block_id, name in BLOCK_NAMES.items():
        msg = generate_toggle_fx(block_id, True)
        print(f"  Toggle {name:5s} ON:  {msg.hex(' ')}")
