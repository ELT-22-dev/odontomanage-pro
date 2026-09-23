'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { LoadError, Loading } from '@/components/EmptyState'
import { PatientForm } from '@/components/PatientForm'
import { Button } from '@/components/ui/button'
import { keys, useInvalidate, usePatient } from '@/hooks/queries'

export default function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const invalidate = useInvalidate()
  const { data: patient, isLoading, error } = usePatient(id)
  const back = () => router.push(`/pacientes/${id}`)

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-3xl">
      <title>Editar paciente · OdontoManage Pro</title>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={back} aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Editar paciente</h1>
          <p className="text-sm text-muted-foreground truncate">{patient?.name}</p>
        </div>
      </div>
      {isLoading ? (
        <Loading />
      ) : error || !patient ? (
        <LoadError message={error?.message ?? 'Paciente nao encontrado'} />
      ) : (
        <PatientForm
          patient={patient}
          onCancel={back}
          onSaved={async () => {
            await invalidate(keys.patients, keys.appointments, keys.transactions, keys.records)
            back()
          }}
        />
      )}
    </div>
  )
}
