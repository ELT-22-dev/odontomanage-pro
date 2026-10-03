import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATES, firstName, renderTemplate, ruleMatches } from './followup'

describe('ruleMatches', () => {
  it('casa por trecho, sem acento e sem diferenciar maiusculas', () => {
    expect(ruleMatches('Extração do siso', 'extra')).toBe(true)
    expect(ruleMatches('EXTRACAO', 'Extra')).toBe(true)
    expect(ruleMatches('Avaliação inicial', 'avalia')).toBe(true)
    expect(ruleMatches('Limpeza', 'canal')).toBe(false)
  })
  it('padrao vazio nunca casa (evita regra que pega tudo)', () => {
    expect(ruleMatches('Consulta', '  ')).toBe(false)
  })
})

describe('renderTemplate', () => {
  it('preenche as variaveis e limpa espacos duplicados', () => {
    expect(renderTemplate('Ola {nome}, aqui e da {clinica}. {motivo}', { nome: 'Ana', clinica: 'Clinica Sorriso' })).toBe(
      'Ola Ana, aqui e da Clinica Sorriso.',
    )
  })
  it('variavel desconhecida fica como esta (nao some texto do modelo)', () => {
    expect(renderTemplate('Oi {nome} {xyz}', { nome: 'Ana', clinica: 'X' })).toBe('Oi Ana {xyz}')
  })
  it('todos os modelos padrao usam {nome} e {clinica}', () => {
    for (const t of Object.values(DEFAULT_TEMPLATES)) {
      expect(t).toContain('{nome}')
      expect(t).toContain('{clinica}')
    }
  })
})

describe('firstName', () => {
  it('pega so o primeiro nome', () => {
    expect(firstName('  Maria da Silva ')).toBe('Maria')
  })
})
