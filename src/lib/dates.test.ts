import { describe, expect, it } from 'vitest'
import { addDays, addMonths, ageFrom, formatDate, monthEnd, mondayOf, toISODate, weekOf } from './dates'

describe('toISODate', () => {
  it('usa o fuso da clinica, nao UTC (bug da versao antiga: apos 21h "hoje" virava amanha)', () => {
    // 23/09/2026 22:30 em Sao Paulo = 24/09/2026 01:30 UTC
    const lateEvening = new Date('2026-09-24T01:30:00Z')
    expect(toISODate(lateEvening, 'America/Sao_Paulo')).toBe('2026-09-23')
    expect(toISODate(lateEvening, 'UTC')).toBe('2026-09-24')
  })
})

describe('addDays / addMonths', () => {
  it('atravessa meses e anos', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-11', 3)).toBe('2027-02')
  })

  it('monthEnd devolve uma data real (fevereiro, ano bissexto, dezembro)', () => {
    expect(monthEnd('2026-02-10')).toBe('2026-02-28')
    expect(monthEnd('2028-02-01')).toBe('2028-02-29')
    expect(monthEnd('2026-12-15')).toBe('2026-12-31')
    expect(monthEnd('2026-09-23')).toBe('2026-09-30')
  })
})

describe('semana', () => {
  it('segunda-feira da semana, inclusive quando o dia e domingo', () => {
    expect(mondayOf('2026-09-23')).toBe('2026-09-21') // quarta
    expect(mondayOf('2026-09-27')).toBe('2026-09-21') // domingo
    expect(mondayOf('2026-09-21')).toBe('2026-09-21') // segunda
  })

  it('weekOf devolve 7 dias de segunda a domingo', () => {
    const w = weekOf('2026-09-23')
    expect(w).toHaveLength(7)
    expect(w[0]).toBe('2026-09-21')
    expect(w[6]).toBe('2026-09-27')
  })
})

describe('formatDate', () => {
  it('nao volta um dia ao exibir (bug classico de new Date("AAAA-MM-DD"))', () => {
    expect(formatDate('2026-09-01')).toBe('01/09/2026')
  })
  it('vazio para null', () => {
    expect(formatDate(null)).toBe('')
  })
})

describe('ageFrom', () => {
  it('conta anos completos', () => {
    expect(ageFrom('1990-09-24', '2026-09-23')).toBe(35)
    expect(ageFrom('1990-09-23', '2026-09-23')).toBe(36)
    expect(ageFrom(null)).toBeNull()
  })
})
