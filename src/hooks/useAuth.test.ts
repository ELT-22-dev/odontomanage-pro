import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuth } from './useAuth'
import { blink } from '@/blink/client'

// Replaces the whole module — useAuth only touches blink.auth, and mocking it
// here isolates the test from demoClient.ts's localStorage-backed auth state.
vi.mock('@/blink/client', () => ({
  blink: { auth: { onAuthStateChanged: vi.fn() } },
}))

describe('useAuth', () => {
  beforeEach(() => {
    vi.mocked(blink.auth.onAuthStateChanged).mockReset()
  })

  it('starts loading, with no authenticated user', () => {
    vi.mocked(blink.auth.onAuthStateChanged).mockImplementation(() => () => {})

    const { result } = renderHook(() => useAuth())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('reflects an authenticated user once the auth listener fires', () => {
    let emit: (state: { user: unknown; isLoading: boolean; isPasswordRecovery: boolean }) => void = () => {}
    vi.mocked(blink.auth.onAuthStateChanged).mockImplementation((cb) => {
      emit = cb
      return () => {}
    })

    const { result } = renderHook(() => useAuth())
    act(() => {
      emit({ user: { id: '1', email: 'a@b.com', displayName: 'A' }, isLoading: false, isPasswordRecovery: false })
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.user?.email).toBe('a@b.com')
  })

  it('surfaces isPasswordRecovery — AppLayout branches on this to show the reset-password screen', () => {
    let emit: (state: { user: unknown; isLoading: boolean; isPasswordRecovery: boolean }) => void = () => {}
    vi.mocked(blink.auth.onAuthStateChanged).mockImplementation((cb) => {
      emit = cb
      return () => {}
    })

    const { result } = renderHook(() => useAuth())
    act(() => {
      emit({ user: null, isLoading: false, isPasswordRecovery: true })
    })

    expect(result.current.isPasswordRecovery).toBe(true)
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('unsubscribes from the auth listener on unmount (no leaked listener across page navigations)', () => {
    const unsubscribe = vi.fn()
    vi.mocked(blink.auth.onAuthStateChanged).mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useAuth())
    unmount()

    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
