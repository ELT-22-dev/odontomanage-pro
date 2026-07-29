/**
 * Client for the `ai` Supabase Edge Function (supabase/functions/ai) — the
 * only place the Anthropic API key is allowed to live. This module never
 * talks to Claude directly from the browser; it just forwards already
 * RLS-authorized data to the edge function and returns its response.
 *
 * `supabase.functions.invoke` attaches the current session's access token
 * automatically, so the edge function can verify the caller is logged in.
 */
import { supabase } from '@/lib/supabase'

async function callAI<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai', { body: payload })
  if (error) throw new Error(error.message || 'Erro ao contatar o assistente de IA')
  if (data?.error) throw new Error(data.error)
  return data as T
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function askAssistant(
  question: string,
  context: string,
  history: ChatMessage[],
): Promise<string> {
  const data = await callAI<{ answer: string }>({ action: 'chat', question, context, history })
  return data.answer
}

export interface RecordSummary {
  content: string
  diagnosis: string
  treatment_plan: string
  prescriptions: string
}

export async function summarizeRecord(params: {
  rawNotes: string
  patientName: string
  recordType: string
}): Promise<RecordSummary> {
  return callAI<RecordSummary>({ action: 'summarize', ...params })
}
