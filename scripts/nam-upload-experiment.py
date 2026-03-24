#!/usr/bin/env python3
"""NAM upload experiment — sends IR/NAM chunks to GP-200 with configurable timing.

Usage:
  python scripts/nam-upload-experiment.py [--delay MS] [--wait-ack] [--max-chunks N]

Options:
  --delay MS       Delay between chunks in ms (default: 50)
  --wait-ack       Wait for device response after each chunk (timeout 500ms)
  --max-chunks N   Only send first N chunks (default: all)
  --handshake      Do full handshake before sending (default: skip)
  --dry-run        Just show what would be sent
"""

import sys, json, time, argparse, threading
import mido

# GP-200 SysEx header
HEADER = bytes([0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32])

def find_gp200():
    """Find GP-200 MIDI ports."""
    out_name = next((n for n in mido.get_output_names() if 'GP-200' in n), None)
    in_name = next((n for n in mido.get_input_names() if 'GP-200' in n), None)
    return out_name, in_name

def do_handshake(out, inp):
    """Minimal handshake: identity + enter editor mode + state dump + version check."""
    print("Handshake...")

    # Identity query
    identity_query = list(HEADER) + [0x11, 0x04, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF7]
    out.send(mido.Message('sysex', data=identity_query[1:-1]))  # mido strips F0/F7
    resp = wait_for_sysex(inp, timeout=3.0)
    if resp:
        print(f"  Identity response: {len(resp)} bytes")
    else:
        print("  WARNING: No identity response")

    # Enter editor mode
    editor_mode = list(HEADER) + [0x11, 0x12, 0x00, 0x00, 0x00, 0xF7]
    out.send(mido.Message('sysex', data=editor_mode[1:-1]))
    time.sleep(0.1)
    print("  Editor mode entered")

    # State dump request
    state_dump = list(HEADER) + [0x11, 0x04, 0x00, 0x00, 0x00, 0x00, 0x06, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF7]
    out.send(mido.Message('sysex', data=state_dump[1:-1]))
    for i in range(5):
        resp = wait_for_sysex(inp, timeout=3.0)
        if resp:
            print(f"  State dump chunk {i+1}/5: {len(resp)} bytes")

    # Version check
    version_check = list(HEADER) + [0x11, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x06, 0x00, 0x00,
                                     0x0D, 0x04, 0x0F, 0x07, 0x08, 0x0B, 0x00, 0x00, 0x0C, 0x0B, 0x04, 0x05, 0xF7]
    out.send(mido.Message('sysex', data=version_check[1:-1]))
    resp = wait_for_sysex(inp, timeout=3.0)
    if resp:
        print(f"  Version response: {len(resp)} bytes")

    print("Handshake done.\n")

def wait_for_sysex(inp, timeout=0.5):
    """Wait for a SysEx response from the device."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        msg = inp.poll()
        if msg and msg.type == 'sysex':
            return bytes([0xF0] + list(msg.data) + [0xF7])
        time.sleep(0.005)
    return None

def collect_responses(inp, duration=0.5):
    """Collect all SysEx responses within a time window."""
    responses = []
    deadline = time.time() + duration
    while time.time() < deadline:
        msg = inp.poll()
        if msg and msg.type == 'sysex':
            data = bytes([0xF0] + list(msg.data) + [0xF7])
            responses.append(data)
        time.sleep(0.005)
    return responses

def main():
    parser = argparse.ArgumentParser(description='NAM upload experiment')
    parser.add_argument('--delay', type=int, default=20, help='Delay between chunks (ms)')
    parser.add_argument('--wait-ack', action='store_true', help='Wait for ACK after each chunk')
    parser.add_argument('--ack-timeout', type=int, default=300, help='ACK timeout (ms)')
    parser.add_argument('--pre-delay', type=int, default=200, help='Delay after each pre-command (ms)')
    parser.add_argument('--max-chunks', type=int, default=0, help='Max chunks to send (0=all)')
    parser.add_argument('--handshake', action='store_true', help='Do handshake first')
    parser.add_argument('--dry-run', action='store_true', help='Just show what would be sent')
    parser.add_argument('--chunks-file', default='scripts/nam-replay-chunks.json', help='Path to chunks JSON')
    parser.add_argument('--fix-marker', action='store_true', help='Change chunk byte[10] from 0x40 to 0x20')
    args = parser.parse_args()

    # Load chunks — support both plain array and {preCommands, chunks} format
    with open(args.chunks_file) as f:
        raw = json.load(f)

    if isinstance(raw, dict):
        pre_commands = raw.get('preCommands', [])
        chunks = raw.get('chunks', [])
    else:
        pre_commands = []
        chunks = raw

    # Fix marker byte if requested (0x40 -> 0x20)
    if args.fix_marker:
        for i in range(len(chunks)):
            if len(chunks[i]) > 10 and chunks[i][10] == 0x40:
                chunks[i] = list(chunks[i])
                chunks[i][10] = 0x20

    total = len(chunks) if args.max_chunks == 0 else min(args.max_chunks, len(chunks))
    print(f"NAM Upload Experiment")
    print(f"  Pre-commands: {len(pre_commands)}")
    print(f"  Chunks: {total}/{len(chunks)}")
    print(f"  Delay: {args.delay}ms")
    print(f"  Wait for ACK: {args.wait_ack}")
    print()

    if args.dry_run:
        for i in range(total):
            chunk = chunks[i]
            offset = chunk[11] | (chunk[12] << 8) if len(chunk) > 12 else 0
            print(f"  Chunk {i+1:3d}/{total}: {len(chunk):4d} bytes, offset={offset}")
        return

    # Find device
    out_name, in_name = find_gp200()
    if not out_name or not in_name:
        print("ERROR: GP-200 not found!")
        print(f"  Output ports: {mido.get_output_names()}")
        print(f"  Input ports: {mido.get_input_names()}")
        sys.exit(1)

    print(f"Device: {out_name}")

    out = mido.open_output(out_name)
    inp = mido.open_input(in_name)

    # Drain any pending messages
    while inp.poll():
        pass

    if args.handshake:
        do_handshake(out, inp)
        # Drain any remaining handshake responses
        print("Draining residual responses...")
        drained = collect_responses(inp, duration=1.0)
        if drained:
            for r in drained:
                sub = r[9] if len(r) > 9 else 0
                print(f"  Drained: sub=0x{sub:02x} ({len(r)}B)")
        else:
            print("  (none)")
        print()

    # Send pre-commands (IR slot selection, etc.)
    if pre_commands:
        print(f"Sending {len(pre_commands)} pre-commands (delay={args.pre_delay}ms)...")
        for i, cmd in enumerate(pre_commands):
            cmd_bytes = bytes(cmd)
            sub = cmd_bytes[9] if len(cmd_bytes) > 9 else 0
            out.send(mido.Message('sysex', data=list(cmd_bytes[1:-1])))
            resp = wait_for_sysex(inp, timeout=args.ack_timeout / 1000.0)
            if resp:
                rsub = resp[9] if len(resp) > 9 else 0
                print(f"  Pre-cmd {i+1}: sub=0x{sub:02x} ({len(cmd_bytes)}B) -> resp sub=0x{rsub:02x} ({len(resp)}B)")
                print(f"    {' '.join(f'{b:02x}' for b in resp[:20])}")
            else:
                print(f"  Pre-cmd {i+1}: sub=0x{sub:02x} ({len(cmd_bytes)}B) -> no response")
            time.sleep(args.pre_delay / 1000.0)
        print()

    # Send chunks
    print(f"Sending {total} chunks...")
    ack_count = 0
    for i in range(total):
        chunk = bytes(chunks[i])
        offset = chunk[11] | (chunk[12] << 8) if len(chunk) > 12 else 0

        # Send chunk (mido wants data without F0/F7)
        out.send(mido.Message('sysex', data=list(chunk[1:-1])))

        status = f"  Chunk {i+1:3d}/{total}: {len(chunk):4d} bytes, offset={offset:5d}"

        if args.wait_ack:
            resp = wait_for_sysex(inp, timeout=args.ack_timeout / 1000.0)
            if resp:
                ack_count += 1
                sub = resp[9] if len(resp) > 9 else 0
                status += f" -> ACK sub=0x{sub:02x} ({len(resp)}B)"
            else:
                status += " -> no response"
        else:
            # Still check for any async responses
            time.sleep(0.01)
            resp = inp.poll()
            if resp and resp.type == 'sysex':
                data = bytes([0xF0] + list(resp.data) + [0xF7])
                sub = data[9] if len(data) > 9 else 0
                ack_count += 1
                status += f" -> async sub=0x{sub:02x} ({len(data)}B)"

        print(status)

        if i < total - 1:
            time.sleep(args.delay / 1000.0)

    # Wait for any final responses
    print(f"\nWaiting for final responses...")
    final = collect_responses(inp, duration=2.0)
    for resp in final:
        sub = resp[9] if len(resp) > 9 else 0
        print(f"  Final response: sub=0x{sub:02x}, {len(resp)} bytes")
        print(f"    {' '.join(f'{b:02x}' for b in resp[:30])}...")

    print(f"\nDone. Sent {total} chunks, received {ack_count + len(final)} responses.")

    out.close()
    inp.close()

if __name__ == '__main__':
    main()
