'use client'

import { useRef, useState } from 'react'
import { Building2, ImagePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { keys, useInvalidate } from '@/hooks/queries'
import { api, errorMessage } from '@/lib/api'
import { maskPhone } from '@/lib/br'
import type { ClinicSettings } from '@/lib/types'

/** Reduz a imagem para no maximo 256px (o logo so aparece pequeno) e devolve data URL. */
function resizeImage(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Nao foi possivel ler a imagem'))
    }
    img.src = url
  })
}

/** Nome, contato e logo da clinica (somente admin). Montado com os dados ja carregados. */
export function ClinicSection({ settings }: { settings: ClinicSettings }) {
  const invalidate = useInvalidate()
  const logoInput = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    clinic_name: settings.clinic_name,
    phone: settings.phone ?? '',
    address: settings.address ?? '',
    logo_data_url: settings.logo_data_url,
  })
  const [saving, setSaving] = useState(false)

  const pickLogo = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem')
      return
    }
    try {
      const logo_data_url = await resizeImage(file)
      setForm((f) => ({ ...f, logo_data_url }))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/api/settings', form)
      await invalidate(keys.settings)
      toast.success('Dados da clinica salvos')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="size-4" /> Dados da clinica
        </CardTitle>
        <CardDescription>Aparecem no menu, na tela de login e no cabecalho dos prontuarios impressos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          {form.logo_data_url ? (
            <div className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL local */}
              <img src={form.logo_data_url} alt="Logo" className="size-16 rounded-lg object-cover border border-border/60" />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, logo_data_url: null }))}
                className="absolute -top-1.5 -right-1.5 flex items-center justify-center size-5 rounded-full bg-destructive text-white cursor-pointer"
                aria-label="Remover logo"
              >
                <X className="size-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => logoInput.current?.click()}
              className="flex items-center justify-center size-16 rounded-lg border border-dashed border-border/60 text-muted-foreground hover:bg-muted/50 transition-colors shrink-0 cursor-pointer"
              aria-label="Escolher logo"
            >
              <ImagePlus className="size-5" />
            </button>
          )}
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="clinic-name">Nome da clinica</Label>
            <Input id="clinic-name" value={form.clinic_name} onChange={(e) => setForm((f) => ({ ...f, clinic_name: e.target.value }))} />
          </div>
          <input
            ref={logoInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) pickLogo(file)
              e.target.value = ''
            }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="clinic-phone">Telefone</Label>
            <Input id="clinic-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: maskPhone(e.target.value) }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="clinic-address">Endereco</Label>
            <Input id="clinic-address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-between items-center">
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => logoInput.current?.click()}>
            <ImagePlus className="size-4" /> {form.logo_data_url ? 'Trocar logo' : 'Escolher logo'}
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={saving || !form.clinic_name.trim()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
