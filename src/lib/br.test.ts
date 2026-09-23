import { describe, expect, it } from 'vitest'
import { isValidCpf, maskCep, maskCpf, maskPhone } from './br'

describe('CPF', () => {
  it('aplica mascara progressiva', () => {
    expect(maskCpf('529')).toBe('529')
    expect(maskCpf('5299822')).toBe('529.982.2')
    expect(maskCpf('52998224725')).toBe('529.982.247-25')
    expect(maskCpf('529.982.247-25999')).toBe('529.982.247-25')
  })

  it('valida digitos verificadores', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('123')).toBe(false)
  })
})

describe('telefone e CEP', () => {
  it('celular e fixo', () => {
    expect(maskPhone('11988887777')).toBe('(11) 98888-7777')
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444')
    expect(maskPhone('')).toBe('')
  })
  it('CEP', () => {
    expect(maskCep('01310100')).toBe('01310-100')
  })
})
