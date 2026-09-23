import type { Metadata, Viewport } from 'next'
import { DM_Sans, IBM_Plex_Mono } from 'next/font/google'
import type { ReactNode } from 'react'
import { Providers } from './providers'
import './globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-mono', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'OdontoManage Pro', template: '%s · OdontoManage Pro' },
  description: 'Sistema de gestao para clinicas odontologicas.',
  // Sistema interno com dados de saude: nunca indexar.
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f1a2a',
}

/**
 * Roda antes da primeira pintura: aplica o tema salvo (claro/escuro) sem
 * "piscar". Padrao: escuro. Preferencia guardada no localStorage do navegador.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='light'?false:t==='system'?window.matchMedia('(prefers-color-scheme: dark)').matches:true;document.documentElement.classList.toggle('dark',d);}catch(e){document.documentElement.classList.add('dark')}})();`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${dmSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
