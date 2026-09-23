import type { NextConfig } from 'next'

/**
 * Cabecalhos de seguranca aplicados a todas as respostas. O sistema guarda
 * dados de saude (LGPD, dado sensivel) — nada de iframe de terceiros, nada de
 * sniffing de MIME, e o navegador so fala com este dominio via HTTPS.
 */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // `pg` usa modulos nativos opcionais do Node — nao deve ser empacotado pelo bundler.
  serverExternalPackages: ['pg'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
