import { NextResponse, type NextRequest } from 'next/server'

/**
 * Primeira barreira (roda antes de qualquer tela): sem o cookie de sessao,
 * manda para o login lembrando a pagina pedida (?next=). A validacao REAL da
 * sessao (assinatura, usuario ativo, versao) acontece em src/app/(app)/layout.tsx
 * e em cada rota da API — isto aqui so evita renderizar a tela a toa.
 */
const PUBLIC = ['/login', '/setup']

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  if (PUBLIC.includes(pathname)) return NextResponse.next()
  if (req.cookies.has('odonto_session')) return NextResponse.next()
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`
  return NextResponse.redirect(url)
}

export const config = {
  // Tudo, exceto API (responde 401 sozinha), arquivos do Next e estaticos.
  matcher: ['/((?!api|_next/static|_next/image|favicon.svg|robots.txt).*)'],
}
