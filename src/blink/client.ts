/**
 * Data + auth layer for this portfolio build — no backend at all. Everything
 * lives in the browser's localStorage (see demoClient.ts), seeded with fake
 * data on first load. `blink.auth.*` / `blink.db.table(name).list/get/create/
 * update/delete` is a compatibility shim shape kept from an earlier Supabase-
 * backed version of this project, so route components didn't need to change.
 */
import * as demoClient from './demoClient'

export const IS_DEMO_MODE = true

export type { LocalUser } from './demoClient'
export const blink = demoClient.blink
export const exportAllData = demoClient.exportAllData
export const importAllData = demoClient.importAllData
export const clearAllData = demoClient.clearAllData
