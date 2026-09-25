import { parseDraft, serializeDraft } from '@/lib/trip-requests/draft'
import type { BuilderState } from './types'
export const DRAFT_STORAGE_KEY = 'weemap.tripBuilder.v1'
export function loadDraft(storage: Pick<Storage, 'getItem'> | undefined): BuilderState | undefined { try { const parsed = parseDraft(storage?.getItem(DRAFT_STORAGE_KEY)); if (!parsed.ok) return undefined; const { version, updated_at, ...fields } = parsed.draft; void version; void updated_at; return fields } catch { return undefined } }
export function saveDraft(storage: Pick<Storage, 'setItem'> | undefined, state: BuilderState) { try { storage?.setItem(DRAFT_STORAGE_KEY, serializeDraft(state)) } catch { /* local storage is optional */ } }
export function clearDraft(storage: Pick<Storage, 'removeItem'> | undefined) { try { storage?.removeItem(DRAFT_STORAGE_KEY) } catch { /* local storage is optional */ } }
