'use client'

import { useCallback, useState } from 'react'

/**
 * Estado de um dialogo de criar/editar. `key` muda a cada abertura para o
 * formulario montar do zero com os dados certos (sem useEffect copiando props).
 *
 *   const dlg = useDialog<Appointment>()
 *   dlg.open(appt)            // editar
 *   dlg.open()                // criar
 *   <AppointmentDialog key={dlg.key} open={dlg.isOpen} onOpenChange={dlg.setOpen} appointment={dlg.item} />
 */
export function useDialog<T>() {
  const [state, setState] = useState<{ isOpen: boolean; item: T | null; key: number }>({ isOpen: false, item: null, key: 0 })
  const open = useCallback((item?: T | null) => setState((s) => ({ isOpen: true, item: item ?? null, key: s.key + 1 })), [])
  const setOpen = useCallback((isOpen: boolean) => setState((s) => ({ ...s, isOpen })), [])
  return { ...state, open, setOpen }
}
