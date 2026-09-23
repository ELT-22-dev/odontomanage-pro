'use client'

import Papa from 'papaparse'

/** Baixa um arquivo gerado no navegador. */
export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * CSV no formato que o Excel brasileiro abre direto: separador ";" e BOM
 * UTF-8 (sem o BOM, acentos viram "Ã§" no Excel).
 */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const csv = Papa.unparse(rows, { delimiter: ';' })
  downloadFile(filename, '﻿' + csv, 'text/csv;charset=utf-8')
}
