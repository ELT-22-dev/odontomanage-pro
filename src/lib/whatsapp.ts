import { formatDate } from './dates'

/** Converts a Brazilian phone number into the digits-only format wa.me expects (country code + DDD + number). */
function toWhatsAppNumber(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '')
  if (digits.length >= 12 && digits.startsWith('55')) return digits
  return `55${digits}`
}

export function openWhatsApp(rawPhone: string, message: string) {
  const digits = rawPhone.replace(/\D/g, '')
  if (!digits) throw new Error('Este contato nao tem telefone/WhatsApp cadastrado')
  const number = toWhatsAppNumber(rawPhone)
  const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function buildAppointmentReminderMessage(params: {
  patientName: string
  date: string
  time: string
  dentistName?: string | null
  type?: string | null
}): string {
  const { patientName, date, time, dentistName, type } = params
  const formattedDate = formatDate(date, { weekday: 'long', day: '2-digit', month: 'long' })
  const typeLabel = type && type.trim().toLowerCase() !== 'consulta' ? ` de ${type}` : ''
  let msg = `Ola ${patientName}! Passando para lembrar da sua consulta${typeLabel} agendada para ${formattedDate} as ${time}`
  if (dentistName) msg += ` com Dr(a). ${dentistName}`
  msg += '. Qualquer duvida ou imprevisto, e so responder por aqui. Ate breve!'
  return msg
}

export function buildGreetingMessage(patientName: string, clinicName?: string): string {
  return `Ola ${patientName}! Aqui e da ${clinicName || 'clinica'}. Tudo bem?`
}
