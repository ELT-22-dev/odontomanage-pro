/**
 * Seed data for demo mode (VITE_DEMO_MODE=true) — fake patients/agenda/financeiro/
 * prontuarios so a portfolio visitor sees a populated system with zero setup.
 * Dates are computed relative to "today" at seed time so the demo never looks stale.
 */
export const DEMO_USER_ID = 'demo-user'

function isoDate(daysFromToday: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  return d.toISOString().slice(0, 10)
}

function isoDateTime(daysFromToday: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  return d.toISOString()
}

interface SeedPatient {
  id: string
  name: string
  cpf: string
  rg: string | null
  birth_date: string
  sex: string
  marital_status: string | null
  profession: string | null
  phone: string
  whatsapp: string
  email: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  notes: string | null
  emergency_contact: string | null
  insurance: string | null
  insurance_number: string | null
  financial_guardian: string | null
  status: string
}

const PATIENTS: SeedPatient[] = [
  { id: 'p1', name: 'Ana Beatriz Costa', cpf: '123.456.789-01', rg: '12.345.678-9', birth_date: '1990-04-12', sex: 'F', marital_status: 'Solteira', profession: 'Designer', phone: '(11) 98888-1010', whatsapp: '(11) 98888-1010', email: 'ana.costa@example.com', address: 'Rua das Flores, 120', city: 'Sao Paulo', state: 'SP', zip: '01234-000', notes: 'Prefere atendimento no periodo da manha.', emergency_contact: 'Marcos Costa - (11) 98888-1011', insurance: 'Amil Dental', insurance_number: 'AM-5521', financial_guardian: null, status: 'active' },
  { id: 'p2', name: 'Bruno Almeida Santos', cpf: '234.567.890-12', rg: '23.456.789-0', birth_date: '1985-09-02', sex: 'M', marital_status: 'Casado', profession: 'Engenheiro civil', phone: '(11) 97777-2020', whatsapp: '(11) 97777-2020', email: 'bruno.santos@example.com', address: 'Av. Paulista, 900', city: 'Sao Paulo', state: 'SP', zip: '01310-100', notes: null, emergency_contact: 'Carla Santos - (11) 97777-2021', insurance: null, insurance_number: null, financial_guardian: null, status: 'active' },
  { id: 'p3', name: 'Camila Ferreira Lima', cpf: '345.678.901-23', rg: '34.567.890-1', birth_date: '2001-01-25', sex: 'F', marital_status: 'Solteira', profession: 'Estudante', phone: '(11) 96666-3030', whatsapp: '(11) 96666-3030', email: 'camila.lima@example.com', address: 'Rua Augusta, 45', city: 'Sao Paulo', state: 'SP', zip: '01305-000', notes: 'Ansiedade em procedimentos - explicar cada etapa.', emergency_contact: 'Roberto Lima - (11) 96666-3031', insurance: 'Sulamerica Odonto', insurance_number: 'SA-8842', financial_guardian: 'Roberto Lima', status: 'active' },
  { id: 'p4', name: 'Diego Rodrigues Pereira', cpf: '456.789.012-34', rg: '45.678.901-2', birth_date: '1978-11-30', sex: 'M', marital_status: 'Divorciado', profession: 'Contador', phone: '(11) 95555-4040', whatsapp: '(11) 95555-4040', email: 'diego.pereira@example.com', address: 'Rua Oscar Freire, 300', city: 'Sao Paulo', state: 'SP', zip: '01426-000', notes: null, emergency_contact: null, insurance: null, insurance_number: null, financial_guardian: null, status: 'active' },
  { id: 'p5', name: 'Eduarda Martins Oliveira', cpf: '567.890.123-45', rg: '56.789.012-3', birth_date: '1995-06-18', sex: 'F', marital_status: 'Solteira', profession: 'Advogada', phone: '(11) 94444-5050', whatsapp: '(11) 94444-5050', email: 'eduarda.oliveira@example.com', address: 'Alameda Santos, 780', city: 'Sao Paulo', state: 'SP', zip: '01418-000', notes: null, emergency_contact: 'Julia Oliveira - (11) 94444-5051', insurance: 'Amil Dental', insurance_number: 'AM-7734', financial_guardian: null, status: 'active' },
  { id: 'p6', name: 'Felipe Souza Barbosa', cpf: '678.901.234-56', rg: '67.890.123-4', birth_date: '2015-03-08', sex: 'M', marital_status: null, profession: null, phone: '(11) 93333-6060', whatsapp: '(11) 93333-6060', email: '', address: 'Rua Consolacao, 55', city: 'Sao Paulo', state: 'SP', zip: '01301-000', notes: 'Paciente infantil - responsavel: Patricia Barbosa.', emergency_contact: 'Patricia Barbosa - (11) 93333-6060', insurance: null, insurance_number: null, financial_guardian: 'Patricia Barbosa', status: 'active' },
  { id: 'p7', name: 'Gabriela Nunes Rocha', cpf: '789.012.345-67', rg: '78.901.234-5', birth_date: '1988-12-05', sex: 'F', marital_status: 'Casada', profession: 'Fisioterapeuta', phone: '(11) 92222-7070', whatsapp: '(11) 92222-7070', email: 'gabriela.rocha@example.com', address: 'Rua Haddock Lobo, 210', city: 'Sao Paulo', state: 'SP', zip: '01414-000', notes: null, emergency_contact: null, insurance: 'Sulamerica Odonto', insurance_number: 'SA-1190', financial_guardian: null, status: 'inactive' },
  { id: 'p8', name: 'Henrique Cardoso Dias', cpf: '890.123.456-78', rg: '89.012.345-6', birth_date: '1970-07-22', sex: 'M', marital_status: 'Casado', profession: 'Comerciante', phone: '(11) 91111-8080', whatsapp: '(11) 91111-8080', email: 'henrique.dias@example.com', address: 'Rua Bela Cintra, 400', city: 'Sao Paulo', state: 'SP', zip: '01415-000', notes: null, emergency_contact: 'Sonia Dias - (11) 91111-8081', insurance: null, insurance_number: null, financial_guardian: null, status: 'active' },
]

const APPT_TYPES = ['Consulta', 'Limpeza', 'Avaliacao', 'Restauracao', 'Canal', 'Extracao', 'Ortodontia']
const DENTISTS = ['Dr. Paulo Mendes', 'Dra. Renata Vieira']
const ROOMS = ['Sala 1', 'Sala 2']

interface SeedAppointment {
  offsetDays: number
  time: string
  patient: SeedPatient
  type: string
  status: string
  notes: string | null
}

const APPOINTMENTS_DEF: SeedAppointment[] = [
  { offsetDays: -6, time: '09:00', patient: PATIENTS[0], type: 'Limpeza', status: 'completed', notes: null },
  { offsetDays: -4, time: '14:30', patient: PATIENTS[3], type: 'Canal', status: 'completed', notes: 'Sessao 1 de 3.' },
  { offsetDays: -2, time: '10:00', patient: PATIENTS[6], type: 'Avaliacao', status: 'no_show', notes: null },
  { offsetDays: -1, time: '16:00', patient: PATIENTS[1], type: 'Restauracao', status: 'completed', notes: null },
  { offsetDays: 0, time: '09:30', patient: PATIENTS[2], type: 'Consulta', status: 'confirmed', notes: 'Primeira consulta - avaliacao geral.' },
  { offsetDays: 0, time: '11:00', patient: PATIENTS[5], type: 'Avaliacao', status: 'scheduled', notes: 'Paciente infantil, acompanhado da mae.' },
  { offsetDays: 0, time: '15:00', patient: PATIENTS[7], type: 'Limpeza', status: 'scheduled', notes: null },
  { offsetDays: 1, time: '09:00', patient: PATIENTS[4], type: 'Ortodontia', status: 'scheduled', notes: 'Ajuste do aparelho.' },
  { offsetDays: 2, time: '13:30', patient: PATIENTS[0], type: 'Avaliacao', status: 'scheduled', notes: null },
  { offsetDays: 3, time: '10:30', patient: PATIENTS[3], type: 'Canal', status: 'scheduled', notes: 'Sessao 2 de 3.' },
  { offsetDays: 5, time: '14:00', patient: PATIENTS[1], type: 'Extracao', status: 'scheduled', notes: null },
]

interface SeedTransaction {
  offsetDays: number
  patient: SeedPatient | null
  type: 'income' | 'expense'
  category: string
  description: string | null
  amount: number
  payment_method: string | null
  status: string
  installments: number
  current_installment: number
}

const TRANSACTIONS_DEF: SeedTransaction[] = [
  { offsetDays: -6, patient: PATIENTS[0], type: 'income', category: 'Consulta', description: 'Limpeza + profilaxia', amount: 180, payment_method: 'cartao', status: 'paid', installments: 1, current_installment: 1 },
  { offsetDays: -4, patient: PATIENTS[3], type: 'income', category: 'Tratamento de canal', description: 'Sessao 1 de 3', amount: 450, payment_method: 'pix', status: 'paid', installments: 3, current_installment: 1 },
  { offsetDays: -3, patient: null, type: 'expense', category: 'Material odontologico', description: 'Compra de resinas e material de restauracao', amount: 620, payment_method: 'cartao', status: 'paid', installments: 1, current_installment: 1 },
  { offsetDays: -1, patient: PATIENTS[1], type: 'income', category: 'Restauracao', description: 'Restauracao dente 26', amount: 280, payment_method: 'dinheiro', status: 'paid', installments: 1, current_installment: 1 },
  { offsetDays: -1, patient: null, type: 'expense', category: 'Aluguel', description: 'Aluguel da clinica', amount: 3200, payment_method: 'transferencia', status: 'paid', installments: 1, current_installment: 1 },
  { offsetDays: 0, patient: PATIENTS[2], type: 'income', category: 'Consulta', description: 'Avaliacao inicial', amount: 150, payment_method: 'pix', status: 'pending', installments: 1, current_installment: 1 },
  { offsetDays: 2, patient: PATIENTS[4], type: 'income', category: 'Ortodontia', description: 'Mensalidade do aparelho', amount: 320, payment_method: 'cartao', status: 'pending', installments: 12, current_installment: 4 },
  { offsetDays: 5, patient: PATIENTS[1], type: 'income', category: 'Extracao', description: 'Extracao dente 38', amount: 380, payment_method: 'pix', status: 'pending', installments: 1, current_installment: 1 },
  { offsetDays: -12, patient: PATIENTS[7], type: 'income', category: 'Consulta', description: 'Consulta de rotina', amount: 150, payment_method: 'dinheiro', status: 'paid', installments: 1, current_installment: 1 },
  { offsetDays: -20, patient: null, type: 'expense', category: 'Equipamento', description: 'Manutencao do compressor', amount: 340, payment_method: 'cartao', status: 'paid', installments: 1, current_installment: 1 },
]

interface SeedRecord {
  patient: SeedPatient
  record_type: 'note' | 'diagnosis' | 'prescription' | 'treatment'
  title: string
  content: string | null
  diagnosis: string | null
  treatment_plan: string | null
  prescriptions: string | null
  offsetDays: number
}

const RECORDS_DEF: SeedRecord[] = [
  { patient: PATIENTS[0], record_type: 'note', title: 'Evolucao - Limpeza', content: 'Paciente compareceu para profilaxia. Gengiva com leve inflamacao, orientada sobre tecnica de escovacao.', diagnosis: null, treatment_plan: null, prescriptions: null, offsetDays: -6 },
  { patient: PATIENTS[3], record_type: 'diagnosis', title: 'Diagnostico - Canal dente 36', content: null, diagnosis: 'Pulpite irreversivel no dente 36, necessario tratamento endodontico.', treatment_plan: 'Tratamento de canal em 3 sessoes, seguido de restauracao.', prescriptions: null, offsetDays: -4 },
  { patient: PATIENTS[3], record_type: 'prescription', title: 'Prescricao pos-sessao 1', content: null, diagnosis: null, treatment_plan: null, prescriptions: 'Amoxicilina 500mg - 8/8h por 7 dias. Ibuprofeno 400mg se dor.', offsetDays: -4 },
  { patient: PATIENTS[1], record_type: 'treatment', title: 'Plano - Restauracao dente 26', content: null, diagnosis: 'Carie oclusal dente 26.', treatment_plan: 'Restauracao em resina composta, 1 sessao.', prescriptions: null, offsetDays: -1 },
  { patient: PATIENTS[2], record_type: 'note', title: 'Anamnese inicial', content: 'Paciente relata ansiedade odontologica. Sem historico de alergias. Sem uso continuo de medicamentos.', diagnosis: null, treatment_plan: null, prescriptions: null, offsetDays: 0 },
]

export interface DemoSeed {
  patients: Record<string, unknown>[]
  appointments: Record<string, unknown>[]
  transactions: Record<string, unknown>[]
  medical_records: Record<string, unknown>[]
  clinic_settings: Record<string, unknown>[]
}

export function buildDemoSeed(): DemoSeed {
  const patients = PATIENTS.map((p) => ({
    ...p,
    user_id: DEMO_USER_ID,
    created_at: isoDateTime(-30),
  }))

  const appointments = APPOINTMENTS_DEF.map((a, i) => ({
    id: `apt${i + 1}`,
    user_id: DEMO_USER_ID,
    patient_id: a.patient.id,
    patient_name: a.patient.name,
    dentist_name: DENTISTS[i % DENTISTS.length],
    date: isoDate(a.offsetDays),
    time: a.time,
    type: a.type,
    room: ROOMS[i % ROOMS.length],
    notes: a.notes,
    status: a.status,
    created_at: isoDateTime(a.offsetDays - 1),
  }))

  const transactions = TRANSACTIONS_DEF.map((t, i) => ({
    id: `txn${i + 1}`,
    user_id: DEMO_USER_ID,
    patient_id: t.patient?.id ?? null,
    patient_name: t.patient?.name ?? null,
    type: t.type,
    category: t.category,
    description: t.description,
    amount: t.amount,
    payment_method: t.payment_method,
    status: t.status,
    installments: t.installments,
    current_installment: t.current_installment,
    due_date: isoDate(t.offsetDays),
    paid_date: t.status === 'paid' ? isoDate(t.offsetDays) : null,
    created_at: isoDateTime(t.offsetDays),
  }))

  const medical_records = RECORDS_DEF.map((r, i) => ({
    id: `rec${i + 1}`,
    user_id: DEMO_USER_ID,
    patient_id: r.patient.id,
    patient_name: r.patient.name,
    record_type: r.record_type,
    title: r.title,
    content: r.content,
    diagnosis: r.diagnosis,
    treatment_plan: r.treatment_plan,
    prescriptions: r.prescriptions,
    created_at: isoDateTime(r.offsetDays),
    updated_at: isoDateTime(r.offsetDays),
  }))

  const clinic_settings = [
    {
      id: 'settings1',
      user_id: DEMO_USER_ID,
      clinic_name: 'OdontoManage Pro — Demo',
      logo_data_url: null,
      updated_at: isoDateTime(-30),
    },
  ]

  return { patients, appointments, transactions, medical_records, clinic_settings }
}
