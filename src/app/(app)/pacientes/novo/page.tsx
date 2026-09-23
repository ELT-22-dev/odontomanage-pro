'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PatientForm } from '@/components/PatientForm'
import { Button } from '@/components/ui/button'
import { keys, useInvalidate } from '@/hooks/queries'

export default function NewPatientPage() {
  const router = useRouter()
  const invalidate = useInvalidate()

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-3xl">
      <title>Novo paciente · OdontoManage Pro</title>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/pacientes')} aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Novo paciente</h1>
          <p className="text-sm text-muted-foreground">Preencha os dados do paciente</p>
        </div>
      </div>
      <PatientForm
        onCancel={() => router.push('/pacientes')}
        onSaved={async (p) => {
          await invalidate(keys.patients)
          router.push(`/pacientes/${p.id}`)
        }}
      />
    </div>
  )
}
