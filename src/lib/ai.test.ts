import { describe, expect, it, vi, beforeEach } from 'vitest'
import { askAssistant, summarizeRecord } from './ai'
import { supabase } from './supabase'

// Replaces the whole module so the real src/lib/supabase.ts (which throws at
// import time without real VITE_SUPABASE_URL/ANON_KEY) never actually runs.
vi.mock('./supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

describe('askAssistant', () => {
  beforeEach(() => {
    vi.mocked(supabase.functions.invoke).mockReset()
  })

  it('calls the "ai" edge function with the chat action and returns the answer', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { answer: 'Voce tem 42 pacientes ativos.' },
      error: null,
    } as never)

    const answer = await askAssistant('Quantos pacientes ativos?', '{"total":42}', [])

    expect(supabase.functions.invoke).toHaveBeenCalledWith('ai', {
      body: { action: 'chat', question: 'Quantos pacientes ativos?', context: '{"total":42}', history: [] },
    })
    expect(answer).toBe('Voce tem 42 pacientes ativos.')
  })

  it('throws the transport error message when the function invocation itself fails', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code' },
    } as never)

    await expect(askAssistant('oi', '{}', [])).rejects.toThrow(
      'Edge Function returned a non-2xx status code',
    )
  })

  it('throws the application-level error when the function responds 200 with { error }', async () => {
    // This is how the "ai" function reports "not authenticated" / bad input —
    // HTTP 200/4xx handled inside the function, not a transport failure.
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { error: 'Nao autenticado' },
      error: null,
    } as never)

    await expect(askAssistant('oi', '{}', [])).rejects.toThrow('Nao autenticado')
  })
})

describe('summarizeRecord', () => {
  beforeEach(() => {
    vi.mocked(supabase.functions.invoke).mockReset()
  })

  it('calls the "ai" edge function with the summarize action and returns the draft as-is', async () => {
    const draft = { content: 'Evolucao...', diagnosis: '', treatment_plan: '', prescriptions: '' }
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: draft, error: null } as never)

    const result = await summarizeRecord({
      rawNotes: 'paciente relatou dor',
      patientName: 'Joao',
      recordType: 'note',
    })

    expect(supabase.functions.invoke).toHaveBeenCalledWith('ai', {
      body: {
        action: 'summarize',
        rawNotes: 'paciente relatou dor',
        patientName: 'Joao',
        recordType: 'note',
      },
    })
    expect(result).toEqual(draft)
  })
})
