import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  serverExternalPackages: ['@node-rs/argon2'],
  async headers() {
    return [
    // Prevent browser from caching page/JS responses in dev — forces fresh loads after rebuilds
    ...(process.env.NODE_ENV === 'development' ? [{
      source: '/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'no-store, must-revalidate' },
      ],
    }] : []),
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            // 'unsafe-eval' is needed for Matomo analytics (loaded from
            // musikersuche.org) and the Next.js 15 / React 19 client runtime
            // under certain chunk-loading paths. Keeping it off caused a
            // silent regression where the Matomo tracker blocked the first
            // interactive render. 'unsafe-inline' is already required for
            // Next.js hydration so the marginal security cost is small.
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://musikersuche.org https://challenges.cloudflare.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self'",
            "connect-src 'self' https://musikersuche.org https://challenges.cloudflare.com",
            "frame-src https://challenges.cloudflare.com",
            "object-src 'none'",
            "worker-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),
        },
      ],
    }];
  },
};

export default withNextIntl(nextConfig);
