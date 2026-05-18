#!/usr/bin/env python3
"""Decode send/return reorder captures by nibble-decoding sub=0x20 payloads."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from importlib import import_module
m = import_module('analyze-sysex')

def hex_bytes(b):
    return ' '.join(f'{x:02x}' for x in b)

def decode_routing(payload, label):
    """Nibble-decode a sub=0x20 payload (without the leading sub byte)."""
    # payload includes the sub byte at [0]. Skip it then nibble-decode.
    raw = payload[1:]  # after sub=0x20
    # Strip three padding bytes (typical for sub=0x20 small frames: 00 00 00) then nibble-decode
    # Actually look at format: sub=0x20 reorder = 78 bytes total => payload = 69 bytes => sub + 68 nibble?
    # From docs: sub=0x20 (78 bytes) = F0+header(8)+CMD(1)+SUB(1)+ 64 nibble + F7  => 78
    # So payload (after F0..GP-2..CMD) starts at index 9 = [0x20, then 3 raw padding? no — the docs say [00 00 00] are at decoded[0,1] (nibble of 00 00)]
    # The 64 nibble bytes after [0x20] decode to 32 bytes. But what about the leading 3 bytes in the host->dev capture?
    # In raw payload we saw: "20 00 00 00 00 00 00 00 00 04" -> sub=0x20, then 00 00 00 (?), then nibble starts?
    # Looking at the param-change format: sub=0x18, then "00 00 00", then 48 nibble bytes => 24 decoded
    # For sub=0x20: SUB + (00 00 00) + 64 nibble + F7 => 1+3+64+1 = 69 payload bytes
    pad = raw[:3]
    nibble = raw[3:]
    if len(nibble) % 2 != 0:
        nibble = nibble[:-1]
    decoded = bytearray()
    for i in range(0, len(nibble), 2):
        decoded.append((nibble[i] << 4) | nibble[i+1])
    print(f'\n=== {label} ===')
    print(f'  raw payload ({len(payload)} bytes): {hex_bytes(payload)}')
    print(f'  pad: {hex_bytes(pad)}   nibble bytes: {len(nibble)}   decoded: {len(decoded)}')
    print(f'  decoded:    {hex_bytes(decoded)}')
    if len(decoded) >= 28:
        msg_type = decoded[8]
        const = decoded[14:16]
        routing = decoded[16:27]
        term = decoded[27] if len(decoded) > 27 else None
        print(f'  decoded[8] msg_type=0x{msg_type:02x}  decoded[14:16]={hex_bytes(const)}  terminator=0x{term:02x}' if term is not None else '')
        print(f'  routing (decoded[16:27], 11 bytes): {[f"{b:02x}" for b in routing]}')
    return decoded

def main(pcap):
    msgs = m.parse_messages(pcap)
    sub20 = [x for x in msgs if x.get('cmd') == 0x12 and len(x['payload']) > 0 and x['payload'][0] == 0x20 and x['direction'] == 'host->dev']
    print(f'{pcap}: {len(sub20)} host->dev sub=0x20 messages')
    for idx, msg in enumerate(sub20):
        decode_routing(msg['payload'], f"#{idx+1} pkt={msg['pkt']} t={msg['time']:.3f}")
    # also check device responses sub=0x14
    sub14 = [x for x in msgs if x.get('cmd') == 0x12 and len(x['payload']) > 0 and x['payload'][0] == 0x14 and x['direction'] == 'dev->host']
    print(f'\n{len(sub14)} dev->host sub=0x14 responses')
    for idx, msg in enumerate(sub14[:3]):
        print(f'  #{idx+1} pkt={msg["pkt"]} payload ({len(msg["payload"])}B): {hex_bytes(msg["payload"])}')

if __name__ == '__main__':
    for p in sys.argv[1:]:
        main(p)
        print('\n' + '=' * 80 + '\n')
