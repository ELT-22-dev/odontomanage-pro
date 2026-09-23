'use client'

/**
 * Todas as leituras de dados do frontend, via React Query. Cada hook = uma
 * rota GET da API. Depois de salvar algo, invalide a chave correspondente
 * (`invalidate(keys.patients)`) para a tela recarregar.
 */
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from '@/lib/api'
import type {
  AiStatus, Appointment, AuditEntry, ClinicSettings, MedicalRecord, Patient, Transaction, User,
} from '@/lib/types'

export const keys = {
  patients: ['patients'] as const,
  patient: (id: string) => ['patients', id] as const,
  appointments: ['appointments'] as const,
  transactions: ['transactions'] as const,
  records: ['records'] as const,
  settings: ['settings'] as const,
  dentists: ['dentists'] as const,
  users: ['users'] as const,
  audit: ['audit'] as const,
  ai: ['ai-status'] as const,
}

function qs(params: Record<string, string | null | undefined>) {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v)
  const str = s.toString()
  return str ? `?${str}` : ''
}

export type PatientWithUsage = Patient & { usage: { appointments: number; records: number; transactions: number } }

export const usePatients = () =>
  useQuery({ queryKey: keys.patients, queryFn: () => api.get<Patient[]>('/api/patients') })

export const usePatient = (id: string) =>
  useQuery({ queryKey: keys.patient(id), queryFn: () => api.get<PatientWithUsage>(`/api/patients/${id}`), retry: false })

export const useAppointments = (filters: { from?: string; to?: string; patientId?: string } = {}) =>
  useQuery({
    queryKey: [...keys.appointments, filters],
    queryFn: () =>
      api.get<Appointment[]>(`/api/appointments${qs({ from: filters.from, to: filters.to, patient_id: filters.patientId })}`),
  })

export const useTransactions = (patientId?: string) =>
  useQuery({
    queryKey: [...keys.transactions, patientId ?? 'all'],
    queryFn: () => api.get<Transaction[]>(`/api/transactions${qs({ patient_id: patientId })}`),
  })

export const useRecords = (patientId?: string) =>
  useQuery({
    queryKey: [...keys.records, patientId ?? 'all'],
    queryFn: () => api.get<MedicalRecord[]>(`/api/medical-records${qs({ patient_id: patientId })}`),
  })

export const useSettings = () =>
  useQuery({ queryKey: keys.settings, queryFn: () => api.get<ClinicSettings>('/api/settings'), staleTime: 5 * 60_000 })

export const useDentists = () => useQuery({ queryKey: keys.dentists, queryFn: () => api.get<string[]>('/api/dentists') })

export const useUsers = (enabled = true) =>
  useQuery({ queryKey: keys.users, queryFn: () => api.get<User[]>('/api/users'), enabled })

export const useAudit = (enabled = true) =>
  useQuery({ queryKey: keys.audit, queryFn: () => api.get<AuditEntry[]>('/api/audit'), enabled })

/** `const invalidate = useInvalidate(); invalidate(keys.patients, keys.appointments)` */
export function useInvalidate() {
  const qc = useQueryClient()
  return useCallback(
    (...queryKeys: QueryKey[]) => Promise.all(queryKeys.map((queryKey) => qc.invalidateQueries({ queryKey }))),
    [qc],
  )
}

export function useClinicName() {
  const { data } = useSettings()
  return data?.clinic_name?.trim() || 'OdontoManage Pro'
}

/** IA disponivel? (chave no servidor + ligada pelo admin) */
export const useAiStatus = () =>
  useQuery({ queryKey: keys.ai, queryFn: () => api.get<AiStatus>('/api/ai/status'), staleTime: 5 * 60_000 })

export function useAiEnabled() {
  const { data } = useAiStatus()
  return !!(data?.configured && data?.enabled)
}
