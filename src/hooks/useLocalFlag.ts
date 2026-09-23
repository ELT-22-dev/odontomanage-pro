'use client'

import { useCallback, useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()

function read(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === 'true'
  } catch {
    return fallback
  }
}

/**
 * Preferencia booleana guardada no localStorage (ex: menu recolhido).
 * No servidor usa o valor padrao, evitando erro de hidratacao.
 */
export function useLocalFlag(key: string, fallback = false): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => read(key, fallback),
    () => fallback,
  )
  const set = useCallback(
    (v: boolean) => {
      try {
        localStorage.setItem(key, String(v))
      } catch {
        // sem localStorage: preferencia nao persiste
      }
      listeners.forEach((l) => l())
    },
    [key],
  )
  return [value, set]
}
