import { describe, expect, it } from 'vitest'
import { detectColumnMapping, mapRowToPatient, parseCsv } from './patientImport'

describe('parseCsv', () => {
  it('parses headers and rows, trimming header whitespace', () => {
    const csv = 'Nome , Telefone\nJoao Silva,11999998888\nMaria Souza,11888887777'
    const { headers, rows } = parseCsv(csv)
    expect(headers).toEqual(['Nome', 'Telefone'])
    expect(rows).toEqual([
      { Nome: 'Joao Silva', Telefone: '11999998888' },
      { Nome: 'Maria Souza', Telefone: '11888887777' },
    ])
  })

  it('skips empty lines instead of producing a row of empty values', () => {
    const csv = 'Nome,Email\nJoao,joao@example.com\n\n'
    const { rows } = parseCsv(csv)
    expect(rows).toHaveLength(1)
  })
})

describe('detectColumnMapping', () => {
  it('matches accented, differently-cased Portuguese headers to the right field', () => {
    const mapping = detectColumnMapping(['Nome Completo', 'Endereço', 'Nascimento'])
    expect(mapping.name).toBe('Nome Completo')
    expect(mapping.address).toBe('Endereço')
    expect(mapping.birth_date).toBe('Nascimento')
  })

  it('matches common English aliases too', () => {
    const mapping = detectColumnMapping(['name', 'email', 'phone'])
    expect(mapping).toEqual({ name: 'name', email: 'email', phone: 'phone' })
  })

  it('ignores headers with no known alias instead of guessing', () => {
    const mapping = detectColumnMapping(['Coluna Misteriosa'])
    expect(mapping).toEqual({})
  })

  it('is insensitive to spaces/punctuation differences between header and alias', () => {
    // "Data de Nascimento" normalizes to "datadenascimento", one of the aliases.
    const mapping = detectColumnMapping(['Data de Nascimento'])
    expect(mapping.birth_date).toBe('Data de Nascimento')
  })
})

describe('mapRowToPatient', () => {
  it('pulls only the mapped fields from the row, trimming values', () => {
    const row = { 'Nome Completo': '  Joao Silva  ', 'Coluna Ignorada': 'lixo' }
    const mapping = detectColumnMapping(['Nome Completo', 'Coluna Ignorada'])
    const patient = mapRowToPatient(row, mapping)
    expect(patient).toEqual({ name: 'Joao Silva' })
  })

  it('omits a field entirely when the row has no value for its mapped column', () => {
    const mapping = { name: 'Nome', email: 'Email' } as const
    const patient = mapRowToPatient({ Nome: 'Joao' }, mapping)
    expect(patient).toEqual({ name: 'Joao' })
    expect('email' in patient).toBe(false)
  })
})
