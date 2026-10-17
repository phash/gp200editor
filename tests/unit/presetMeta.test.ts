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
  it('leads with the preset name and names the amp', () => {
    expect(buildShareMeta(base).title).toBe(
      'Black Betty – Free GP-200 Preset (Marshall JCM900) | Preset Forge',
    );
  });

  it('puts the style in front of "Preset" when set', () => {
    expect(buildShareMeta({ ...base, style: 'Rock' }).title).toBe(
      'Black Betty – Free GP-200 Rock Preset (Marshall JCM900) | Preset Forge',
    );
  });

  it('omits the amp when it could not be decoded', () => {
    expect(buildShareMeta({ ...base, amp: null }).title).toBe(
      'Black Betty – Free GP-200 Preset | Preset Forge',
    );
  });

  it('never names the uploader', () => {
    expect(buildShareMeta(base).title).not.toContain('@');
  });
});

describe('buildShareMeta description', () => {
  it('describes the signal chain once and ends with the call to action', () => {
    const { description } = buildShareMeta({
      ...base,
      cab: 'Marshall® 1960AV 4x12"',
      drive: 'Ibanez® TS808',
    });
    expect(description).toBe(
      'Free Valeton GP-200 preset: Marshall JCM900 amp into Marshall 1960AV 4x12", with Ibanez TS808. Download the .prst or open it in the browser editor.',
    );
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
      description: 'https://www.youtube.com/watch?v=x\r\nAndy Timmons -  That Pedal Show\r\n',
    });
    expect(description).toContain('Andy Timmons - That Pedal Show.');
    expect(description).not.toContain('http');
    expect(description).not.toMatch(/[\r\n]/);
  });

  it('stays within 160 characters', () => {
    const { description } = buildShareMeta({
      ...base,
      drive: 'Ibanez® TS808',
      description: 'A very long human description '.repeat(10),
    });
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith('…')).toBe(true);
  });

  it('falls back to a generic sentence without decoded modules', () => {
    const { description } = buildShareMeta({ ...base, amp: null, cab: null });
    expect(description).toBe(
      'Free Valeton GP-200 preset. Download the .prst or open it in the browser editor.',
    );
  });
});
