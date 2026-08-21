/**
 * Picks the data + auth backend at build time:
 *  - VITE_DEMO_MODE=true -> demoClient.ts (localStorage, no account/setup needed —
 *    for portfolio/demo deploys only, see CLAUDE.md "Demo mode")
 *  - otherwise -> supabaseClient.ts (real backend, used by every real clinic deploy)
 * Both export the same shape so route components never branch on this.
 */
import * as supabaseClient from './supabaseClient'
import * as demoClient from './demoClient'

export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

const impl = IS_DEMO_MODE ? demoClient : supabaseClient

export type { LocalUser } from './supabaseClient'
export const blink = impl.blink
export const exportAllData = impl.exportAllData
export const importAllData = impl.importAllData
export const clearAllData = impl.clearAllData
