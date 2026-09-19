'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'

type Institute = {
  inst_short_name: string
  inst_full_name?: string
  inst_Address1?: string
  inst_Address2?: string
  inst_District?: string
  inst_State?: string
  Landline_PhoneNo?: string
  Director_Name?: string
  Director_Desig?: string
  Director_Email?: string
  Director_MobileNo?: string
  ExamHead_Name?: string
  ExamHead_Desig?: string
  ExamHead_Email?: string
  ExamHead_MobileNo?: string
}

type InstituteProfileFormProps = {
  institute?: Institute
  onSave: (data: Institute) => Promise<void>
  onCancel: () => void
  isEditing: boolean
}

export default function InstituteProfileForm({ institute, onSave, onCancel, isEditing }: InstituteProfileFormProps) {
  const [data, setData] = useState<Institute>(institute ?? { inst_short_name: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (field: keyof Institute, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSave(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">
            {isEditing ? 'Edit Institute Profile' : 'Add Institute'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Organize your institute information across three sections
          </p>
        </div>

        {error && <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 1: Institute Profile */}
          <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-blue-50 to-transparent p-6">
            <h3 className="mb-4 flex items-center text-lg font-semibold text-blue-900">
              <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">1</div>
              Institute Profile
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Short Name *</label>
                <input
                  type="text"
                  maxLength={10}
                  value={data.inst_short_name}
                  onChange={e => handleChange('inst_short_name', e.target.value)}
                  disabled={isEditing}
                  placeholder="e.g., NIT, IIT"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Cannot be changed after creation</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  maxLength={100}
                  value={data.inst_full_name ?? ''}
                  onChange={e => handleChange('inst_full_name', e.target.value)}
                  placeholder="e.g., National Institute of Technology"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address 1</label>
                <input
                  type="text"
                  maxLength={100}
                  value={data.inst_Address1 ?? ''}
                  onChange={e => handleChange('inst_Address1', e.target.value)}
                  placeholder="Street address"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address 2</label>
                <input
                  type="text"
                  maxLength={100}
                  value={data.inst_Address2 ?? ''}
                  onChange={e => handleChange('inst_Address2', e.target.value)}
                  placeholder="Apartment, suite, etc."
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                <input
                  type="text"
                  maxLength={50}
                  value={data.inst_District ?? ''}
                  onChange={e => handleChange('inst_District', e.target.value)}
                  placeholder="e.g., Delhi, Mumbai"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  maxLength={50}
                  value={data.inst_State ?? ''}
                  onChange={e => handleChange('inst_State', e.target.value)}
                  placeholder="e.g., Delhi, Maharashtra"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Landline Phone</label>
                <input
                  type="tel"
                  maxLength={20}
                  value={data.Landline_PhoneNo ?? ''}
                  onChange={e => handleChange('Landline_PhoneNo', e.target.value)}
                  placeholder="+91-XXX-XXXXXXX"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Director/Principal Profile */}
          <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-purple-50 to-transparent p-6">
            <h3 className="mb-4 flex items-center text-lg font-semibold text-purple-900">
              <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-white text-sm font-bold">2</div>
              Director/Principal Profile
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Director Name</label>
                <input
                  type="text"
                  maxLength={50}
                  value={data.Director_Name ?? ''}
                  onChange={e => handleChange('Director_Name', e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input
                  type="text"
                  maxLength={25}
                  value={data.Director_Desig ?? ''}
                  onChange={e => handleChange('Director_Desig', e.target.value)}
                  placeholder="e.g., Director, Principal"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  maxLength={50}
                  value={data.Director_Email ?? ''}
                  onChange={e => handleChange('Director_Email', e.target.value)}
                  placeholder="director@example.com"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={data.Director_MobileNo ?? ''}
                  onChange={e => handleChange('Director_MobileNo', e.target.value)}
                  placeholder="10-digit number"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Programme Coordinator */}
          <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-green-50 to-transparent p-6">
            <h3 className="mb-4 flex items-center text-lg font-semibold text-green-900">
              <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white text-sm font-bold">3</div>
              Programme Coordinator (Exam Head)
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exam Head Name</label>
                <input
                  type="text"
                  maxLength={50}
                  value={data.ExamHead_Name ?? ''}
                  onChange={e => handleChange('ExamHead_Name', e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input
                  type="text"
                  maxLength={25}
                  value={data.ExamHead_Desig ?? ''}
                  onChange={e => handleChange('ExamHead_Desig', e.target.value)}
                  placeholder="e.g., Exam Head, Coordinator"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  maxLength={50}
                  value={data.ExamHead_Email ?? ''}
                  onChange={e => handleChange('ExamHead_Email', e.target.value)}
                  placeholder="examhead@example.com"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={data.ExamHead_MobileNo ?? ''}
                  onChange={e => handleChange('ExamHead_MobileNo', e.target.value)}
                  placeholder="10-digit number"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end border-t pt-6">
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !data.inst_short_name}>
              {busy ? 'Saving...' : 'Save Institute Profile'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
