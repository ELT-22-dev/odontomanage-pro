'use client'

/**
 * Cliente HTTP do frontend para as rotas em src/app/api. Todas as telas usam
 * isto (via React Query) — nunca `fetch` solto.
 *
 * - Erros da API ({ error: "..." }) viram `ApiError` com a mensagem pronta
 *   para mostrar no toast.
 * - 401 (sessao expirada) manda de volta para o login automaticamente.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !url.startsWith('/api/auth/')) {
      // Recarga completa de proposito: limpa o cache de dados da sessao anterior.
      window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`)
    }
    throw new ApiError((data as { error?: string }).error || `Erro ${res.status}`, res.status, data as Record<string, unknown>)
  }
  return data as T
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  put: <T>(url: string, body: unknown) => request<T>('PUT', url, body),
  patch: <T>(url: string, body: unknown) => request<T>('PATCH', url, body),
  del: <T = { ok: true }>(url: string) => request<T>('DELETE', url),
}

/** Mensagem legivel de qualquer erro (para toast.error). */
export function errorMessage(err: unknown, fallback = 'Algo deu errado'): string {
  return err instanceof Error && err.message ? err.message : fallback
}
