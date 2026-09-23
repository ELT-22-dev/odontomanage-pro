/**
 * Tipos compartilhados entre frontend e API — o formato exato do JSON que as
 * rotas em src/app/api devolvem. Datas "YYYY-MM-DD" sao strings (sem fuso);
 * timestamps (created_at etc.) sao strings ISO.
 */

export type Role = 'admin' | 'staff'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
}

export interface User extends SessionUser {
  active: boolean
  last_login_at: string | null
  created_at: string
}

export interface ClinicSettings {
  clinic_name: string
  phone: string | null
  address: string | null
  logo_data_url: string | null
}

export type PatientStatus = 'active' | 'inactive'

export interface Patient {
  id: string
  name: string
  cpf: string | null
  rg: string | null
  birth_date: string | null
  sex: string | null
  marital_status: string | null
  profession: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  notes: string | null
  emergency_contact: string | null
  insurance: string | null
  insurance_number: string | null
  financial_guardian: string | null
  status: PatientStatus
  created_at: string
  updated_at: string
}

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

export interface Appointment {
  id: string
  patient_id: string
  patient_name: string
  patient_phone: string | null
  patient_whatsapp: string | null
  dentist_name: string | null
  date: string
  time: string
  duration_minutes: number
  type: string
  room: string | null
  notes: string | null
  status: AppointmentStatus
  google_event_id: string | null
  created_at: string
}

export type TransactionType = 'income' | 'expense'
export type TransactionStatus = 'paid' | 'pending' | 'cancelled'

export interface Transaction {
  id: string
  patient_id: string | null
  patient_name: string | null
  type: TransactionType
  category: string
  description: string | null
  amount: number
  payment_method: string | null
  status: TransactionStatus
  installments: number
  current_installment: number
  due_date: string | null
  paid_date: string | null
  created_at: string
}

export type RecordType = 'note' | 'diagnosis' | 'prescription' | 'treatment'

export interface MedicalRecord {
  id: string
  patient_id: string
  patient_name: string
  record_type: RecordType
  title: string
  content: string | null
  diagnosis: string | null
  treatment_plan: string | null
  prescriptions: string | null
  created_by_name: string | null
  updated_by_name: string | null
  created_at: string
  updated_at: string
}

export interface AuditEntry {
  id: number
  user_name: string | null
  action: string
  entity: string | null
  entity_id: string | null
  details: Record<string, unknown> | null
  ip: string | null
  created_at: string
}

export interface AiStatus {
  /** ANTHROPIC_API_KEY presente no servidor */
  configured: boolean
  /** admin ligou o assistente em Configuracoes */
  enabled: boolean
}

export interface AiStructuredNote {
  title: string
  record_type: RecordType
  content: string
  diagnosis: string
  treatment_plan: string
  prescriptions: string
}

export interface AiPatientSummary {
  summary: string
  alerts: string[]
  pending: string[]
  last_visit: string
}
