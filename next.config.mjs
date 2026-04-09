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
            `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://musikersuche.org https://challenges.cloudflare.com`,
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
