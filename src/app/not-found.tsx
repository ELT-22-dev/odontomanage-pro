import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <p className="text-muted-foreground">Pagina nao encontrada.</p>
      <Link href="/" className="text-sm text-primary hover:underline">
        Voltar para o inicio
      </Link>
    </div>
  )
}
