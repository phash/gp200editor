import { describe, it, expect } from 'vitest';
import { buildShareMeta, plainAmpName } from '@/lib/presetMeta';

const base = {
  name: 'Black Betty',
  style: null,
  description: null,
  amp: 'Marshall® JCM900',
  cab: 'Vintage Marshall® 4x12" cabinet with Celestion® G12M Greenbacks',
  drive: null,
};

describe('plainAmpName', () => {
  it('drops trademark signs and parenthetical channel notes', () => {
    expect(plainAmpName('Mesa/Boogie® Dual Rectifier® (Modern mode)')).toBe(
      'Mesa/Boogie Dual Rectifier',
    );
    expect(plainAmpName("Fender® '65 Twin Reverb")).toBe("Fender '65 Twin Reverb");
  });
});

describe('buildShareMeta title', () => {
  it('leads with the preset name, then the amp and "Free Download"', () => {
    expect(buildShareMeta(base).title).toBe(
      'Black Betty – Marshall JCM900 GP-200 Preset | Free Download',
    );
  });

  it('puts the style in front of the amp when it fits', () => {
    expect(buildShareMeta({ ...base, name: 'Thunder', style: 'Rock' }).title).toBe(
      'Thunder – Rock Marshall JCM900 GP-200 Preset | Free Download',
    );
  });

  it('drops the style before the amp when both do not fit in 60 characters', () => {
    const { title } = buildShareMeta({ ...base, style: 'Rock' });
    expect(title).toBe('Black Betty – Marshall JCM900 GP-200 Preset | Free Download');
    expect(title.length).toBeLessThanOrEqual(60);
  });

  it('uses the style alone when the amp could not be decoded', () => {
    expect(buildShareMeta({ ...base, amp: null, style: 'Blues' }).title).toBe(
      'Black Betty – Blues GP-200 Preset | Free Download',
    );
  });

  it('falls back to a plain free-download title without amp or style', () => {
    expect(buildShareMeta({ ...base, amp: null }).title).toBe(
      'Black Betty – Free GP-200 Preset Download',
    );
  });

  it('keeps long names intact rather than cutting them', () => {
    const name = 'A Really Long Preset Name For A Song';
    const { title } = buildShareMeta({ ...base, name, amp: 'Mesa/Boogie® Dual Rectifier®' });
    expect(title).toBe(`${name} – Free GP-200 Preset Download`);
  });

  it('never names the uploader', () => {
    expect(buildShareMeta(base).title).not.toContain('@');
  });
});

describe('buildShareMeta description', () => {
  it('opens with "free … preset download", describes the chain once, ends with the call to action', () => {
    const { description } = buildShareMeta({
      ...base,
      cab: 'Marshall® 1960AV 4x12"',
      drive: 'Ibanez® TS808',
    });
    expect(description).toBe(
      'Free Valeton GP-200 preset download: Marshall JCM900 amp into Marshall 1960AV 4x12", with Ibanez TS808. Get the .prst or open it in the browser editor.',
    );
  });

  it('names the style in the lead when set', () => {
    const { description } = buildShareMeta({ ...base, style: 'Rock', cab: null });
    expect(description.startsWith('Free Valeton GP-200 Rock preset download: Marshall JCM900 amp.')).toBe(true);
  });

  it('ignores the auto-generated ingest description that repeats the chain', () => {
    const { description } = buildShareMeta({
      ...base,
      description: 'Valeton GP-200 preset: Marshall® JCM900 amp, Vintage Marshall® 4x12" cabinet.',
    });
    expect(description.match(/JCM900/g)).toHaveLength(1);
  });

  it('keeps a human description, without URLs or line breaks', () => {
    const { description } = buildShareMeta({
      ...base,
      cab: null,
      description: 'https://www.youtube.com/watch?v=x\r\nAndy Timmons -  That Pedal Show\r\n',
    });
    expect(description).toContain('Andy Timmons - That Pedal Show.');
    expect(description).not.toContain('http');
    expect(description).not.toMatch(/[\r\n]/);
  });

  it('stays within 155 characters', () => {
    const { description } = buildShareMeta({
      ...base,
      drive: 'Ibanez® TS808',
      description: 'A very long human description '.repeat(10),
    });
    expect(description.length).toBeLessThanOrEqual(155);
    expect(description.endsWith('…')).toBe(true);
  });

  it('falls back to a generic sentence without decoded modules', () => {
    const { description } = buildShareMeta({ ...base, amp: null, cab: null });
    expect(description).toBe(
      'Free Valeton GP-200 preset download. Get the .prst or open it in the browser editor.',
    );
  });
});
