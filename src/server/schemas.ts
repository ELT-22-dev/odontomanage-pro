import 'server-only'
import { z } from 'zod'

/*
 * Validacao de tudo que chega nas APIs. Regra: nenhum dado do navegador vai
 * para o banco sem passar por um destes schemas. Campo de texto vazio ("")
 * vira null, para nao gravar string vazia em coluna opcional.
 */

const emptyToNull = (v: string) => (v === '' ? null : v)

/** Texto opcional (vazio → null). */
const optText = (max = 500) => z.string().trim().max(max, `maximo de ${max} caracteres`).transform(emptyToNull).nullable().optional()

/** Texto obrigatorio. */
const reqText = (max = 200, label = 'campo') => z.string().trim().min(1, `${label} e obrigatorio`).max(max)

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data invalida (use AAAA-MM-DD)')
const optDate = z.union([isoDate, z.literal('')]).transform((v) => (v === '' ? null : v)).nullable().optional()

const uuid = z.uuid('identificador invalido')

export const password = z.string().min(8, 'a senha precisa ter pelo menos 8 caracteres').max(200)
const email = z.string().trim().toLowerCase().pipe(z.email('email invalido'))

// ── Auth / usuarios ─────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'informe o email'),
  password: z.string().min(1, 'informe a senha'),
})

export const setupSchema = z.object({
  clinic_name: reqText(120, 'nome da clinica'),
  name: reqText(120, 'nome'),
  email,
  password,
})

export const profileSchema = z.object({
  name: reqText(120, 'nome'),
  email,
})

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'informe a senha atual'),
  new_password: password,
})

export const createUserSchema = z.object({
  name: reqText(120, 'nome'),
  email,
  password,
  role: z.enum(['admin', 'staff']).default('staff'),
})

export const updateUserSchema = z.object({
  name: reqText(120, 'nome').optional(),
  role: z.enum(['admin', 'staff']).optional(),
  active: z.boolean().optional(),
  password: password.optional(),
})

// ── Clinica ─────────────────────────────────────────────────────────────────
export const settingsSchema = z.object({
  clinic_name: reqText(120, 'nome da clinica'),
  phone: optText(40),
  address: optText(300),
  // Logo em data URL (imagem pequena). ~700KB em base64 ≈ 500KB de imagem.
  logo_data_url: z
    .string()
    .max(700_000, 'logo muito grande (maximo ~500KB)')
    .regex(/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/, 'logo deve ser uma imagem')
    .nullable()
    .optional(),
})

// ── Pacientes ───────────────────────────────────────────────────────────────
export const PATIENT_COLUMNS = [
  'name', 'cpf', 'rg', 'birth_date', 'sex', 'marital_status', 'profession', 'phone',
  'whatsapp', 'email', 'address', 'city', 'state', 'zip', 'notes', 'emergency_contact',
  'insurance', 'insurance_number', 'financial_guardian', 'status',
] as const

const patientFields = {
  name: reqText(200, 'nome'),
  cpf: optText(20),
  rg: optText(30),
  birth_date: optDate,
  sex: optText(30),
  marital_status: optText(40),
  profession: optText(100),
  phone: optText(40),
  whatsapp: optText(40),
  email: z.union([email, z.literal('')]).transform((v) => (v === '' ? null : v)).nullable().optional(),
  address: optText(300),
  city: optText(100),
  state: optText(50),
  zip: optText(20),
  notes: optText(5000),
  emergency_contact: optText(200),
  insurance: optText(100),
  insurance_number: optText(60),
  financial_guardian: optText(200),
  status: z.enum(['active', 'inactive']).optional(),
}

export const createPatientSchema = z.object(patientFields)
export const updatePatientSchema = z.object(patientFields).partial()

/** Importacao CSV: mais tolerante (email invalido vira null em vez de rejeitar a linha). */
export const importPatientsSchema = z.object({
  rows: z
    .array(
      z.object({
        ...patientFields,
        email: z.string().trim().max(200).transform((v) => (/^\S+@\S+\.\S+$/.test(v) ? v.toLowerCase() : null)).nullable().optional(),
        birth_date: z.string().trim().transform(normalizeImportDate).nullable().optional(),
      }),
    )
    .min(1, 'nenhuma linha para importar')
    .max(5000, 'maximo de 5000 pacientes por importacao'),
})

/** Aceita AAAA-MM-DD ou DD/MM/AAAA (formato comum em planilhas brasileiras). */
function normalizeImportDate(v: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

// ── Consultas ───────────────────────────────────────────────────────────────
export const APPOINTMENT_COLUMNS = [
  'patient_id', 'dentist_name', 'date', 'time', 'duration_minutes', 'type', 'room', 'notes', 'status', 'google_event_id',
] as const

const appointmentStatus = z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])

const appointmentFields = {
  patient_id: uuid,
  dentist_name: optText(120),
  date: isoDate,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'horario invalido (use HH:MM)'),
  duration_minutes: z.coerce.number().int().min(5).max(480).optional(),
  type: z.string().trim().max(80).transform((v) => v || 'Consulta').optional(),
  room: optText(40),
  notes: optText(2000),
  status: appointmentStatus.optional(),
  google_event_id: optText(200),
}

export const createAppointmentSchema = z.object({
  ...appointmentFields,
  // true = agendar mesmo havendo outra consulta do mesmo dentista no mesmo horario.
  force: z.boolean().optional(),
})
export const updateAppointmentSchema = z.object(appointmentFields).partial().extend({ force: z.boolean().optional() })

// ── Financeiro ──────────────────────────────────────────────────────────────
export const TRANSACTION_COLUMNS = [
  'patient_id', 'type', 'category', 'description', 'amount', 'payment_method', 'status',
  'installments', 'current_installment', 'due_date', 'paid_date',
] as const

const transactionFields = {
  patient_id: uuid.nullable().optional().or(z.literal('').transform(() => null)),
  type: z.enum(['income', 'expense']),
  category: reqText(80, 'categoria'),
  description: optText(500),
  amount: z.coerce.number().positive('o valor precisa ser maior que zero').max(10_000_000),
  payment_method: optText(40),
  status: z.enum(['paid', 'pending', 'cancelled']).optional(),
  installments: z.coerce.number().int().min(1).max(120).optional(),
  current_installment: z.coerce.number().int().min(1).max(120).optional(),
  due_date: optDate,
  paid_date: optDate,
}

export const createTransactionSchema = z.object(transactionFields)
export const updateTransactionSchema = z.object(transactionFields).partial()

// ── Prontuarios ─────────────────────────────────────────────────────────────
export const RECORD_COLUMNS = [
  'patient_id', 'record_type', 'title', 'content', 'diagnosis', 'treatment_plan', 'prescriptions',
] as const

const recordFields = {
  patient_id: uuid,
  record_type: z.enum(['note', 'diagnosis', 'prescription', 'treatment']).default('note'),
  title: reqText(200, 'titulo'),
  content: optText(20_000),
  diagnosis: optText(10_000),
  treatment_plan: optText(10_000),
  prescriptions: optText(10_000),
}

export const createRecordSchema = z.object(recordFields)
export const updateRecordSchema = z.object({
  ...recordFields,
  record_type: z.enum(['note', 'diagnosis', 'prescription', 'treatment']),
}).partial()
