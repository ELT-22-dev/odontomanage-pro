'use client'

export type ThemeMode = 'light' | 'dark' | 'system'

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  try {
    const t = localStorage.getItem('theme')
    return t === 'light' || t === 'system' ? t : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(mode: ThemeMode) {
  try {
    localStorage.setItem('theme', mode)
  } catch {
    // navegador sem localStorage: tema vale so para esta aba
  }
  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}
