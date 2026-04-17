import { describe, it, expect } from 'vitest';
import { getClientIp } from '@/lib/getClientIp';

function req(headers: Record<string, string>): Request {
  return new Request('https://example.com', { headers });
}

describe('getClientIp', () => {
  it('prefers cf-connecting-ip', () => {
    expect(
      getClientIp(req({
        'cf-connecting-ip': '1.1.1.1',
        'x-forwarded-for': '2.2.2.2',
        'x-real-ip': '3.3.3.3',
      })),
    ).toBe('1.1.1.1');
  });

  it('falls back to x-forwarded-for (first hop)', () => {
    expect(
      getClientIp(req({
        'x-forwarded-for': '2.2.2.2, 4.4.4.4',
        'x-real-ip': '3.3.3.3',
      })),
    ).toBe('2.2.2.2');
  });

  it('falls back to x-real-ip', () => {
    expect(getClientIp(req({ 'x-real-ip': '3.3.3.3' }))).toBe('3.3.3.3');
  });

  it('returns "unknown" when no headers present', () => {
    expect(getClientIp(req({}))).toBe('unknown');
  });
});
