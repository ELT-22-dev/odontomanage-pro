/**
 * Picks the data + auth backend at build time:
 *  - VITE_DEMO_MODE=true, OR no Supabase URL/key configured at all -> demoClient.ts
 *    (localStorage, no account/setup needed — for portfolio/demo deploys only, see
 *    CLAUDE.md "Demo mode"). The "no config" fallback exists so a deploy with a
 *    misapplied/missing env var degrades to a working demo instead of a hard crash —
 *    a real clinic always has real Supabase env vars set (see IMPLANTACAO.md), so
 *    this never fires for a production deploy.
 *  - otherwise -> supabaseClient.ts (real backend, used by every real clinic deploy)
 * Both export the same shape so route components never branch on this.
 */
import * as supabaseClient from './supabaseClient'
import * as demoClient from './demoClient'

const hasSupabaseConfig = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true' || !hasSupabaseConfig

const impl = IS_DEMO_MODE ? demoClient : supabaseClient

export type { LocalUser } from './supabaseClient'
export const blink = impl.blink
export const exportAllData = impl.exportAllData
export const importAllData = impl.importAllData
export const clearAllData = impl.clearAllData
