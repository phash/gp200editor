import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';
import { downloadPresetBuffer } from '@/lib/storage';
import { PRSTDecoder } from '@/core/PRSTDecoder';
import { encodeToJson } from '@/core/PRSTJsonCodec';

// Next.js discovers this file by convention and wires it to `og:image`
// for the share page. Image is generated once per (locale, token) pair
// and cached by the Next.js data cache.

export const runtime = 'nodejs';
export const alt = 'Valeton GP-200 preset';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = {
  params: { token: string; locale: 'de' | 'en' | 'es' | 'fr' | 'it' | 'pt' };
};

export default async function OgImage({ params }: Props) {
  const { token } = params;

  const preset = await prisma.preset.findUnique({
    where: { shareToken: token },
    select: {
      name: true,
      presetKey: true,
      public: true,
      user: { select: { username: true } },
    },
  });

  const fallbackTitle = 'Valeton GP-200';
  const name = preset?.public ? preset.name : fallbackTitle;
  const username = preset?.public ? `@${preset.user.username}` : 'preset-forge.com';

  let amp: string | null = null;
  let cab: string | null = null;
  if (preset?.public) {
    try {
      const buffer = await downloadPresetBuffer(preset.presetKey);
      const decoded = new PRSTDecoder(buffer).decode();
      const json = encodeToJson(decoded, {
        shareToken: token,
        locale: 'en',
        sourceUrl: null,
        sourceLabel: null,
        description: null,
      });
      amp = json.highlights.amp?.realName ?? json.highlights.amp?.valetonName ?? null;
      cab = json.highlights.cab?.realName ?? json.highlights.cab?.valetonName ?? null;
    } catch {
      // S3 or decode error — fall through with null amp/cab
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0b0f14 0%, #1a1d25 100%)',
          padding: '72px',
          fontFamily: 'sans-serif',
          color: '#f8e5a3',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div
            style={{
              fontSize: '28px',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: '#8a6b1a',
              display: 'flex',
            }}
          >
            Valeton GP-200 · Preset Forge
          </div>
          <div
            style={{
              fontSize: '88px',
              lineHeight: 1.05,
              fontWeight: 700,
              color: '#ffcb47',
              letterSpacing: '-0.02em',
              display: 'flex',
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: '24px',
              color: '#9aa4b5',
              marginTop: '8px',
              display: 'flex',
            }}
          >
            by {username}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {amp && (
            <div
              style={{
                display: 'flex',
                gap: '16px',
                alignItems: 'baseline',
                fontSize: '36px',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  padding: '6px 16px',
                  background: 'rgba(255, 203, 71, 0.12)',
                  border: '1px solid #8a6b1a',
                  borderRadius: '6px',
                  color: '#ffcb47',
                  fontSize: '20px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                }}
              >
                AMP
              </span>
              <span style={{ color: '#e4e7ec' }}>{amp}</span>
            </div>
          )}
          {cab && (
            <div
              style={{
                display: 'flex',
                gap: '16px',
                alignItems: 'baseline',
                fontSize: '28px',
                color: '#9aa4b5',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  padding: '6px 16px',
                  background: 'rgba(255, 203, 71, 0.08)',
                  border: '1px solid #5c4a1a',
                  borderRadius: '6px',
                  color: '#c9a04a',
                  fontSize: '18px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                }}
              >
                CAB
              </span>
              <span>{cab}</span>
            </div>
          )}
          <div
            style={{
              fontSize: '22px',
              color: '#5c6472',
              marginTop: '20px',
              display: 'flex',
            }}
          >
            preset-forge.com · Free GP-200 preset library
          </div>
        </div>
      </div>
    ),
    size,
  );
}
