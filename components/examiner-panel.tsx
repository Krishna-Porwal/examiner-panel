'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { BookOpen, Building2, ClipboardList, Download, Key, LogOut, Menu, Plus, ShieldCheck, UserRound, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PasswordChange from '@/components/password-change'
import InstituteProfileForm from '@/components/institute-profile-form'

type Role = 'CE' | 'CA' | 'FAC'
type Session = { user_name: string; role: string; institute?: string }
type ExaminerPanelProps = {
  token: string
  user: { user_name: string; role: string; institute?: string }
  onLogout: () => void
}
type Faculty = { PAN: string; Title?: string; faculty_name?: string; inst_short_name?: string; faculty_desig?: string; faculty_total_exp?: number; faculty_address?: string; faculty_Email?: string; faculty_MobileNo?: string; entered_by?: string; entered_on?: string }
type Institute = { inst_short_name: string; inst_full_name?: string; inst_Address1?: string; inst_Address2?: string; inst_District?: string; inst_State?: string; Landline_PhoneNo?: string; Director_Name?: string; Director_Desig?: string; Director_Email?: string; Director_MobileNo?: string; ExamHead_Name?: string; ExamHead_Desig?: string; ExamHead_Email?: string; ExamHead_MobileNo?: string }
type Course = { course_code: string; course_short_name?: string; course_full_name?: string }
type Subject = { subject_code: string; subject_short_name?: string; subject_full_name?: string; semester?: number; spec_id?: number; sub_subject_codes?: string }
type Specialization = { spec_id: number; spec_name?: string }
type FacultySubjectMap = { PAN: string; subject_code: string; entered_by?: string; entered_on?: string }
type FacultySpecMap = { PAN: string; spec_id: number; entered_by?: string; entered_on?: string }
type InstCourseMap = { inst_short_name: string; course_code: string; intake?: number; strength?: number }
type CourseSubjectMap = { course_code: string; subject_code: string; study_year?: number | null; semester?: number | null; inst_short_names?: string[] }

type UserPayload = { user_name: string; password: string; role: 'CA' | 'FAC' }
type UserCredential = { user_name: string; role: string }

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
const demoCredentials = [['Programme Coordinator', 'CENTRAL', 'change-me'], ['College Admin', 'NIT', 'college123'], ['College User', 'ABCDE1234F', 'faculty123']] as const

function normalizeUserName(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

function normalizeCredentialRole(value: string | undefined): 'CA' | 'FAC' | 'ALL' {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['ca', 'college admin', 'clg admin', 'college-admin', 'college_admin', 'institute admin'].includes(normalized)) return 'CA'
  if (['fac', 'faculty'].includes(normalized)) return 'FAC'
  return 'ALL'
}

function parseCsvRecords(csvText: string) {
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i]
    if (ch === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      row.push(current)
      current = ''
      continue
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && csvText[i + 1] === '\n') i += 1
      row.push(current)
      if (row.some(value => value.trim() !== '')) rows.push(row)
      row = []
      current = ''
      continue
    }
    current += ch
  }
  if (current.length || row.length) {
    row.push(current)
    if (row.some(value => value.trim() !== '')) rows.push(row)
  }
  if (rows.length < 2) return []
  const [headerRow, ...dataRows] = rows
  return dataRows.map(values => {
    const record: Record<string, string> = {}
    headerRow.forEach((header, index) => {
      record[header.trim()] = (values[index] ?? '').trim()
    })
    return record
  }).filter(record => Object.values(record).some(value => value !== ''))
}

function downloadCsv(filename: string, headers: string[], rows: Record<string, any>[]) {
  const csvContent = [headers.join(','), ...rows.map(row => headers.map(header => JSON.stringify(row[header] ?? '')).join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
const roleLabels: Record<string, string> = { CE: 'Programme Coordinator', CA: 'College Admin', FAC: 'College User' }
const navFor: Record<string, string[]> = { CE: ['Overview', 'Institutes', 'Courses', 'Specializations', 'Subjects', 'Faculty', 'Users', 'Credentials'], CA: ['My College', 'Courses', 'Specializations', 'Subjects', 'Faculty', 'Users', 'Credentials'], FAC: ['Dashboard', 'Faculty', 'Courses', 'Specializations', 'Subjects'] }
function ErrorAlert({ msg }: { msg: string }) {
  return msg ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{msg}</div> : null
}

function SuccessAlert({ msg }: { msg: string }) {
  return msg ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</div> : null
}

function sanitizeFormPayload(form: HTMLFormElement) {
  return Object.fromEntries(
    Array.from(new FormData(form).entries())
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
      .filter(([, value]) => value !== '' && value !== null && value !== undefined)
  )
}

function Stat({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return <div className="rounded-lg border bg-card p-4"><Icon className="mb-2 size-5" /><div className="text-2xl font-semibold">{value}</div><div className="text-sm text-muted-foreground">{label}</div></div>
}

function FacultyListTable({ fac, q, setQ, onSel, onExp, onAdd, onCreateCredential, canCreateCredential, canDelete, onDelete }: any) {
  return <div className="rounded-lg border bg-card"><div className="border-b p-4 flex gap-2"><input placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /><Button variant="outline" size="sm" onClick={onExp}><Download className="size-4" />CSV</Button><Button size="sm" onClick={onAdd}><Plus className="size-4" />Add</Button>{canCreateCredential && <Button variant="outline" size="sm" onClick={onCreateCredential}>Create Credential</Button>}</div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted"><th className="p-2 text-left text-foreground">Name</th><th className="p-2 text-left text-foreground">PAN</th><th className="p-2 text-left text-foreground">Institute</th><th className="p-2 text-right text-foreground">Action</th></tr></thead><tbody>{fac.map((f: Faculty) => <tr key={f.PAN} className="border-b"><td className="p-2 text-foreground">{f.faculty_name}</td><td className="p-2 font-mono text-xs text-foreground">{f.PAN}</td><td className="p-2 text-foreground">{f.inst_short_name}</td><td className="p-2 text-right"><Button size="sm" variant="outline" onClick={() => onSel(f)}>View</Button>{canDelete && <Button size="sm" variant="outline" className="ml-2 text-red-600" onClick={() => onDelete(f.PAN)}>Delete</Button>}</td></tr>)}</tbody></table></div></div>
}

function FacultyDialog({ fac, onClose, onEdit, subjects, courseSubjectMappings, facultySubjects, facultySpecs, specializations }: any) {
  const subjectRows = (facultySubjects ?? []).filter((item: FacultySubjectMap) => item.PAN === fac?.PAN)
  const specRows = (facultySpecs ?? []).filter((item: FacultySpecMap) => item.PAN === fac?.PAN)

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"><div className="w-full max-w-4xl rounded-lg border bg-card p-6 shadow-lg overflow-auto max-h-[80vh]"><div className="mb-4 flex justify-between items-start"><h2 className="text-lg font-semibold text-foreground">{fac?.faculty_name || 'Faculty'}</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button></div>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded border p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Profile</h3>
        <div className="space-y-2 text-sm text-foreground">
          <div><strong>PAN:</strong> {fac?.PAN}</div>
          <div><strong>Title:</strong> {fac?.Title || '-'}</div>
          <div><strong>Faculty Name:</strong> {fac?.faculty_name || '-'}</div>
          <div><strong>Institute:</strong> {fac?.inst_short_name || '-'}</div>
          <div><strong>Designation:</strong> {fac?.faculty_desig || '-'}</div>
          <div><strong>Total Experience:</strong> {fac?.faculty_total_exp ?? '-'} years</div>
          <div><strong>Address:</strong> {fac?.faculty_address || '-'}</div>
          <div><strong>Email:</strong> {fac?.faculty_Email || '-'}</div>
          <div><strong>Mobile:</strong> {fac?.faculty_MobileNo || '-'}</div>
          <div><strong>Entered By:</strong> {fac?.entered_by || '-'}</div>
          <div><strong>Entered On:</strong> {fac?.entered_on ? new Date(fac.entered_on).toLocaleString() : '-'}</div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded border p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Subjects</h3>
          <div className="space-y-2 text-sm">
            {subjectRows.length === 0 ? <div className="text-muted-foreground">No subjects mapped.</div> : subjectRows.map((item: FacultySubjectMap) => {
              const subject = (subjects ?? []).find((s: Subject) => s.subject_code === item.subject_code)
              const courseMap = (courseSubjectMappings ?? []).find((mapping: CourseSubjectMap) => mapping.subject_code === item.subject_code)
              return <div key={`${item.PAN}-${item.subject_code}`} className="rounded border p-2">
                <div className="font-medium">{subject?.subject_code || item.subject_code}</div>
                <div className="text-muted-foreground">{subject?.subject_full_name || subject?.subject_short_name || 'Subject record'}</div>
                <div className="text-xs text-muted-foreground">Course: {courseMap?.course_code || '-'} • Study Year: {courseMap?.study_year ?? '-'} • Semester: {courseMap?.semester ?? '-'}</div>
              </div>
            })}
          </div>
        </div>
        <div className="rounded border p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Specializations</h3>
          <div className="space-y-2 text-sm">
            {specRows.length === 0 ? <div className="text-muted-foreground">No specializations mapped.</div> : specRows.map((item: FacultySpecMap) => {
              const spec = (specializations ?? []).find((s: Specialization) => s.spec_id === item.spec_id)
              return <div key={`${item.PAN}-${item.spec_id}`} className="rounded border p-2"><div className="font-medium">{spec?.spec_name || `Spec ${item.spec_id}`}</div><div className="text-xs text-muted-foreground">Spec ID: {item.spec_id}</div></div>
            })}
          </div>
        </div>
      </div>
    </div>
    <div className="mt-4 flex gap-2 justify-end"><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={onEdit}>Edit</Button></div></div></div>
}

function CourseDetailsModal({ details, onClose }: any) {
  if (!details) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-4xl rounded-lg border bg-card p-6 shadow-lg overflow-auto max-h-[80vh]">
        <div className="mb-4 flex justify-between items-start">
          <h2 className="text-lg font-semibold text-foreground">{details.course.course_code} — {details.course.course_full_name || details.course.course_short_name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
        </div>
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <div className="col-span-2">
            <div className="mb-3"><strong>Colleges Offering:</strong> {details.institutesOffering?.length ?? 0}</div>
            <div className="mb-3"><strong>Subjects:</strong> {details.subjects?.length ?? 0}</div>
            <div className="mb-3"><strong>Faculty:</strong> {details.facultyCount ?? 0}</div>
            <div className="mt-4">
              <h3 className="text-sm font-semibold">Subjects</h3>
              <div className="space-y-2 mt-2">{(details.subjects ?? []).map((s: any) => {
                const code = s.subject_code ?? s.subject?.subject_code
                const short = s.subject_full_name ?? s.subject?.subject_full_name ?? s.subject_short_name ?? s.subject?.subject_short_name
                return <div key={code} className="rounded border p-2"><div className="font-medium">{code} — {short} {s.study_year ? <span className="ml-2 text-xs text-muted-foreground">Year {s.study_year}</span> : null} {s.semester ? <span className="ml-2 text-xs text-muted-foreground">Sem {s.semester}</span> : null}</div></div>
              })}</div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Colleges</h3>
            <div className="space-y-2 mt-2">{(details.institutesOffering ?? []).map((i: any) => <div key={i.inst_short_name} className="rounded border p-2">{i.inst_short_name} — {i.inst_full_name}</div>)}</div>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Faculty (sample)</h3>
          <div className="mt-2 space-y-2">{(details.faculty ?? []).slice(0, 200).map((f: any) => <div key={f.PAN} className="rounded border p-2">{f.faculty_name} — {f.PAN} — {f.inst_short_name}</div>)}</div>
        </div>
      </div>
    </div>
  )
}

function SubjectDetailsModal({ details, onClose }: any) {
  if (!details) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-3xl rounded-lg border bg-card p-6 shadow-lg overflow-auto max-h-[80vh]">
        <div className="mb-4 flex justify-between items-start">
          <h2 className="text-lg font-semibold text-foreground">{details.subject.subject_code} — {details.subject.subject_full_name || details.subject.subject_short_name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2"><strong>Semester:</strong> {details.subject.semester ?? '-'}</div>
            <div className="mb-2"><strong>Courses:</strong>
              <div className="mt-2 space-y-2">{(details.courses ?? []).map((c: any) => {
                const courseObj = c.course ?? c
                const code = courseObj.course_code
                const name = courseObj.course_full_name || courseObj.course_short_name
                return <div key={code} className="rounded border p-2">{code} — {name} {c.study_year ? <span className="ml-2 text-xs text-muted-foreground">Year {c.study_year}</span> : null} {c.semester ? <span className="ml-2 text-xs text-muted-foreground">Sem {c.semester}</span> : null}</div>
              })}</div>
            </div>
          </div>
          <div>
            <div className="mb-2"><strong>Available in Colleges:</strong> {details.instituteCount ?? (details.institutes ?? []).length}</div>
            <div className="mt-2 space-y-2">{(details.institutes ?? []).map((i: any) => <div key={i.inst_short_name} className="rounded border p-2">{i.inst_short_name} — {i.inst_full_name}</div>)}</div>
          </div>
        </div>
        <div className="mt-4"><h3 className="text-sm font-semibold">Faculty</h3><div className="mt-2 space-y-2">{(details.faculty ?? []).slice(0,200).map((f: any) => <div key={f.PAN} className="rounded border p-2">{f.faculty_name} — {f.PAN} — {f.inst_short_name}</div>)}</div></div>
      </div>
    </div>
  )
}

function InstituteDetailsModal({ details, onClose }: any) {
  if (!details) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-4xl rounded-lg border bg-card p-6 shadow-lg overflow-auto max-h-[80vh]">
        <div className="mb-4 flex justify-between items-start">
          <h2 className="text-lg font-semibold text-foreground">{details.institute.inst_short_name} — {details.institute.inst_full_name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2"><strong>Address:</strong> {details.institute.inst_Address1 ?? ''} {details.institute.inst_Address2 ?? ''}</div>
            <div className="mb-2"><strong>District / State:</strong> {details.institute.inst_District ?? '-'} / {details.institute.inst_State ?? '-'}</div>
            <div className="mb-2"><strong>Director:</strong> {details.institute.Director_Name ?? '-'} — {details.institute.Director_Email ?? ''}</div>
            <div className="mb-2"><strong>Exam Head:</strong> {details.institute.ExamHead_Name ?? '-'} — {details.institute.ExamHead_Email ?? ''}</div>
          </div>
          <div>
            <div className="mb-2"><strong>Courses Offered:</strong></div>
            <div className="mt-2 space-y-2">{(details.courseStats ?? details.courses ?? []).map((c: any) => {
              const course = c?.course ?? c
              return <div key={course?.course_code} className="rounded border p-2">{course?.course_code} — {course?.course_full_name || course?.course_short_name}</div>
            })}</div>
          </div>
        </div>
        <div className="mt-4"><h3 className="text-sm font-semibold">Faculty ({details.facultyCount ?? 0})</h3><div className="mt-2 space-y-2">{(details.faculty ?? []).slice(0,200).map((f: any) => <div key={f.PAN} className="rounded border p-2">{f.faculty_name} — {f.PAN}</div>)}</div></div>
      </div>
    </div>
  )
}

function FacultyForm({ fac, onClose, onSubmit, role }: any) {
  const fields = [
    { name: 'PAN', label: 'PAN', required: true, readOnly: Boolean(fac?.PAN) },
    { name: 'Title', label: 'Title' },
    { name: 'faculty_name', label: 'Faculty Name' },
    { name: 'inst_short_name', label: 'Institute', readOnly: role === 'FAC' || role === 'CA' },
    { name: 'faculty_desig', label: 'Designation' },
    { name: 'faculty_total_exp', label: 'Total Experience (Years)', type: 'number' },
    { name: 'faculty_address', label: 'Address' },
    { name: 'faculty_Email', label: 'Email', type: 'email' },
    { name: 'faculty_MobileNo', label: 'Mobile Number' },
  ]
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"><form onSubmit={onSubmit} className="w-full max-w-2xl rounded-lg border bg-card p-6 shadow-lg"><div className="mb-4 flex justify-between items-start"><h2 className="text-lg font-semibold text-foreground">{fac?.PAN ? 'Edit' : 'Add'} Faculty</h2><button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button></div><div className="grid gap-3 md:grid-cols-2 mb-4">{fields.map(field => <label key={field.name} className="block"><span className="text-sm font-medium text-foreground">{field.label}</span><input name={field.name} type={field.type ?? 'text'} defaultValue={fac?.[field.name] ?? ''} readOnly={field.readOnly} required={field.required} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70" /></label>)}</div><div className="flex gap-2 justify-end"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></div></form></div>
}

function InstituteForm({ inst, onClose, onSubmit, role }: any) {
  const fields = [
    { name: 'inst_short_name', label: 'Short Name', required: true, readOnly: Boolean(inst?.inst_short_name) && role !== 'CE' },
    { name: 'inst_full_name', label: 'Full Name' },
    { name: 'inst_Address1', label: 'Address 1' },
    { name: 'inst_Address2', label: 'Address 2' },
    { name: 'inst_District', label: 'District' },
    { name: 'inst_State', label: 'State' },
    { name: 'Landline_PhoneNo', label: 'Landline Phone' },
    { name: 'Director_Name', label: 'Director Name' },
    { name: 'Director_Desig', label: 'Director Designation' },
    { name: 'Director_Email', label: 'Director Email', type: 'email' },
    { name: 'Director_MobileNo', label: 'Director Mobile' },
    { name: 'ExamHead_Name', label: 'Exam Head Name' },
    { name: 'ExamHead_Desig', label: 'Exam Head Designation' },
    { name: 'ExamHead_Email', label: 'Exam Head Email', type: 'email' },
    { name: 'ExamHead_MobileNo', label: 'Exam Head Mobile' },
  ]
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"><form onSubmit={onSubmit} className="w-full max-w-3xl rounded-lg border bg-card p-6 shadow-lg"><div className="mb-4 flex justify-between items-start"><h2 className="text-lg font-semibold text-foreground">{inst?.inst_short_name ? 'Edit' : 'Add'} Institute</h2><button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button></div><div className="grid gap-3 md:grid-cols-2 mb-4">{fields.map(field => <label key={field.name} className="block"><span className="text-sm font-medium text-foreground">{field.label}</span><input name={field.name} type={field.type ?? 'text'} defaultValue={inst?.[field.name] ?? ''} readOnly={field.readOnly} required={field.required} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70" /></label>)}</div><div className="flex gap-2 justify-end"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></div></form></div>
}

function CourseForm({ course, onClose, onSubmit }: any) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"><form onSubmit={onSubmit} className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg"><div className="mb-4 flex justify-between items-start"><h2 className="text-lg font-semibold text-foreground">{course?.course_code ? 'Edit' : 'Add'} Course</h2><button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button></div><div className="space-y-3 mb-4"><label className="block"><span className="text-sm font-medium text-foreground">Course Code</span><input name="course_code" defaultValue={course?.course_code ?? ''} required className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label><label className="block"><span className="text-sm font-medium text-foreground">Course Short Name</span><input name="course_short_name" defaultValue={course?.course_short_name ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label><label className="block"><span className="text-sm font-medium text-foreground">Course Full Name</span><input name="course_full_name" defaultValue={course?.course_full_name ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label></div><div className="flex gap-2 justify-end"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></div></form></div>
}

function SpecializationForm({ item, onClose, onSubmit }: any) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"><form onSubmit={onSubmit} className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg"><div className="mb-4 flex justify-between items-start"><h2 className="text-lg font-semibold text-foreground">{item?.spec_id ? 'Edit' : 'Add'} Specialization</h2><button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button></div><div className="space-y-3 mb-4"><label className="block"><span className="text-sm font-medium text-foreground">spec_id</span><input name="spec_id" type="number" min={1} max={255} defaultValue={item?.spec_id ?? ''} required className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label><label className="block"><span className="text-sm font-medium text-foreground">spec_name</span><input name="spec_name" defaultValue={item?.spec_name ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label></div><div className="flex gap-2 justify-end"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></div></form></div>
}

function SubjectForm({ item, onClose, onSubmit, specializations }: any) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"><form onSubmit={onSubmit} className="w-full max-w-xl rounded-lg border bg-card p-6 shadow-lg"><div className="mb-4 flex justify-between items-start"><h2 className="text-lg font-semibold text-foreground">{item?.subject_code ? 'Edit' : 'Add'} Subject</h2><button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button></div><div className="grid gap-3 md:grid-cols-2 mb-4"><label className="block"><span className="text-sm font-medium text-foreground">Subject Code</span><input name="subject_code" defaultValue={item?.subject_code ?? ''} required maxLength={10} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label><label className="block"><span className="text-sm font-medium text-foreground">Sub Subject Codes</span><input name="sub_subject_codes" defaultValue={item?.sub_subject_codes ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label><label className="block"><span className="text-sm font-medium text-foreground">Short Name</span><input name="subject_short_name" defaultValue={item?.subject_short_name ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label><label className="block"><span className="text-sm font-medium text-foreground">Full Name</span><input name="subject_full_name" defaultValue={item?.subject_full_name ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label><label className="block"><span className="text-sm font-medium text-foreground">Semester</span><input name="semester" type="number" defaultValue={item?.semester ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label><label className="block"><span className="text-sm font-medium text-foreground">Specialization</span><select name="spec_id" defaultValue={item?.spec_id ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground"><option value="">Select specialization</option>{specializations.map((s: Specialization) => <option key={s.spec_id} value={String(s.spec_id)}>{s.spec_name || s.spec_id}</option>)}</select></label></div><div className="flex gap-2 justify-end"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></div></form></div>
}

export default function ExaminerPanel({ token, user, onLogout }: ExaminerPanelProps) {
  const [session] = useState<Session>(user as Session)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [active, setActive] = useState('Overview')
  const [faculty, setFaculty] = useState<Faculty[]>([])
  const [institutes, setInstitutes] = useState<Institute[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [specializations, setSpecializations] = useState<Specialization[]>([])
  const [facultySubjects, setFacultySubjects] = useState<FacultySubjectMap[]>([])
  const [facultySpecs, setFacultySpecs] = useState<FacultySpecMap[]>([])
  const [instCourseMappings, setInstCourseMappings] = useState<InstCourseMap[]>([])
  const [courseSubjectMappings, setCourseSubjectMappings] = useState<CourseSubjectMap[]>([])
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [editingMapping, setEditingMapping] = useState<CourseSubjectMap | null>(null)
  const [mappingForm, setMappingForm] = useState({
    course_code: '',
    subject_code: '',
    study_year: '',
    semester: '',
    inst_short_names: [] as string[],
  })
  const [selected, setSelected] = useState<Faculty | null>(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any | null>(null)
  const [searching, setSearching] = useState(false)
  const [showCourseDetails, setShowCourseDetails] = useState(false)
  const [showSubjectDetails, setShowSubjectDetails] = useState(false)
  const [showInstituteDetails, setShowInstituteDetails] = useState(false)
  const [showMappingDetails, setShowMappingDetails] = useState(false)
  const [mappingDetails, setMappingDetails] = useState<any | null>(null)
  const [courseDetails, setCourseDetails] = useState<any | null>(null)
  const [subjectDetails, setSubjectDetails] = useState<any | null>(null)
  const [instituteDetails, setInstituteDetails] = useState<any | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [instituteSearch, setInstituteSearch] = useState('')
  const [courseSearch, setCourseSearch] = useState('')
  const [specializationSearch, setSpecializationSearch] = useState('')
  const [subjectSearch, setSubjectSearch] = useState('')
  const [facultySearch, setFacultySearch] = useState('')
  const [instCourseSearch, setInstCourseSearch] = useState('')
  const [mappingCollegeSearch, setMappingCollegeSearch] = useState('')
  const [courseSubjectSearch, setCourseSubjectSearch] = useState('')
  const [facultySubjectSearch, setFacultySubjectSearch] = useState('')
  const [facultySpecializationSearch, setFacultySpecializationSearch] = useState('')
  const [editing, setEditing] = useState<Faculty | null>(null)
  const [editingInst, setEditingInst] = useState<Institute | null>(null)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [editingSpec, setEditingSpec] = useState<Specialization | null>(null)
  const [showInstituteProfileForm, setShowInstituteProfileForm] = useState(false)
  const [showInstituteFormForCE, setShowInstituteFormForCE] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [caCredential, setCaCredential] = useState<UserPayload>({ user_name: '', password: '', role: 'CA' })
  const [facCredential, setFacCredential] = useState<UserPayload>({ user_name: '', password: '', role: 'FAC' })
  const [users, setUsers] = useState<UserCredential[]>([])
  const [credentialFilter, setCredentialFilter] = useState<'ALL' | 'CA' | 'FAC'>('ALL')
  const [selectedSpec, setSelectedSpec] = useState<Specialization | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)

  const sessionToken = () => typeof window === 'undefined' ? '' : localStorage.getItem('token') ?? ''

  const request = async (path: string, options: RequestInit = {}) => {
    const token = sessionToken()
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(payload?.error ?? 'Request failed')
    }
    return response.status === 204 ? null : response.json()
  }
  useEffect(() => {
    loadData()
  }, [session])

  async function loadData() {
    try {
      setError('')
      setNotice('')
      const facultyRows = await request('/api/faculty').catch(() => [])
      const instituteRows = session?.role !== 'FAC' ? await request('/api/institutes').catch(() => []) : []
      const courseRows = session?.role !== 'FAC' ? await request('/api/courses').catch(() => []) : []
      const subjectRows = session?.role !== 'FAC' ? await request('/api/subjects').catch(() => []) : []
      const specRows = session?.role !== 'FAC' ? await request('/api/specializations').catch(() => []) : []
      const facultySubjectRows = await request('/api/faculty-subjects').catch(() => [])
      const facultySpecRows = await request('/api/faculty-specializations').catch(() => [])
      const instCourseRows = session?.role !== 'FAC' ? await request('/api/inst-courses').catch(() => []) : []
      const courseSubjectRows = session?.role !== 'FAC' ? await request('/api/course-subjects').catch(() => []) : []
      const userRows = session ? await request('/api/users').catch(() => []) : []
      setFaculty(Array.isArray(facultyRows) ? facultyRows : [])
      setInstitutes(Array.isArray(instituteRows) ? instituteRows : [])
      setCourses(Array.isArray(courseRows) ? courseRows : [])
      setSubjects(Array.isArray(subjectRows) ? subjectRows : [])
      setSpecializations(Array.isArray(specRows) ? specRows : [])
      setFacultySubjects(Array.isArray(facultySubjectRows) ? facultySubjectRows : [])
      setFacultySpecs(Array.isArray(facultySpecRows) ? facultySpecRows : [])
      setInstCourseMappings(Array.isArray(instCourseRows) ? instCourseRows : [])
      setCourseSubjectMappings(Array.isArray(courseSubjectRows) ? courseSubjectRows : [])
      setUsers(Array.isArray(userRows) ? userRows : [])
      if (session?.role === 'CA' && institutes.length === 0 && instituteRows?.length) {
        setCaCredential((prev) => ({ ...prev, user_name: instituteRows[0]?.inst_short_name ?? '' }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    }
  }

    async function doSearch(q?: string) {
      const term = typeof q === 'string' ? q : query
      if (!term || term.trim().length === 0) {
        setSearchResults(null)
        return
      }
      setSearching(true)
      setError('')
      try {
        const res = await request(`/api/search?q=${encodeURIComponent(term)}`)
        setSearchResults(res)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed')
      } finally {
        setSearching(false)
      }
    }

    async function openCourseDetails(courseCode: string) {
      try {
        setCourseDetails(null)
        const details = await request(`/api/courses/${encodeURIComponent(courseCode)}/details`)
        setCourseDetails(details)
        setShowCourseDetails(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load course details')
      }
    }

    async function openSubjectDetails(subjectCode: string) {
      try {
        setSubjectDetails(null)
        const details = await request(`/api/subjects/${encodeURIComponent(subjectCode)}/details`)
        setSubjectDetails(details)
        setShowSubjectDetails(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subject details')
      }
    }

    async function openInstituteDetails(instShortName: string) {
      try {
        setInstituteDetails(null)
        const details = await request(`/api/institutes/${encodeURIComponent(instShortName)}/details`)
        setInstituteDetails(details)
        setShowInstituteDetails(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load institute details')
      }
    }

  const visibleInstitutes = useMemo(() => {
    const scoped = session?.role === 'CA' ? institutes.filter(item => item.inst_short_name === session.institute) : institutes
    return scoped.filter(item => matchesSearch(item, instituteSearch, ['inst_short_name', 'inst_full_name', 'inst_District', 'inst_State', 'Director_Name', 'ExamHead_Name']))
  }, [institutes, instituteSearch, session])

  const visibleCourses = useMemo(() => {
    const scoped = session?.role === 'CA'
      ? courses.filter(item => {
          const mappedByInstitute = instCourseMappings.some(mapping => mapping.inst_short_name === session.institute && mapping.course_code === item.course_code)
          const mappedByCourseSubject = courseSubjectMappings.some(mapping =>
            mapping.course_code === item.course_code &&
            Array.isArray(mapping.inst_short_names) &&
            mapping.inst_short_names.includes(session.institute ?? '')
          )
          return mappedByInstitute || mappedByCourseSubject
        })
      : courses
    return scoped.filter(item => matchesSearch(item, courseSearch, ['course_code', 'course_short_name', 'course_full_name']))
  }, [courses, courseSearch, instCourseMappings, session, courseSubjectMappings])

  const collegeSpecializations = useMemo(() => {
    if (session?.role !== 'CA' || !session.institute) return [] as Specialization[]
    const allowedSubjectCodes = new Set(
      courseSubjectMappings
        .filter(item => Array.isArray(item.inst_short_names) && item.inst_short_names.includes(session.institute ?? ''))
        .map(item => item.subject_code)
    )
    return specializations.filter((spec: Specialization) => subjects.some((subject: Subject) => subject.spec_id === spec.spec_id && allowedSubjectCodes.has(subject.subject_code)))
  }, [courseSubjectMappings, session, specializations, subjects])

  const visibleSpecializations = useMemo(() => {
    const scoped = session?.role === 'CA'
      ? collegeSpecializations
      : specializations
    return scoped.filter((item: Specialization) => matchesSearch(item, specializationSearch, ['spec_id', 'spec_name']))
  }, [collegeSpecializations, session, specializations, specializationSearch])

  const visibleSubjects = useMemo(() => {
    const scoped = session?.role === 'CA'
      ? subjects.filter(item => {
          const mappedByCourseSubject = courseSubjectMappings.some(mapping =>
            mapping.subject_code === item.subject_code &&
            Array.isArray(mapping.inst_short_names) &&
            mapping.inst_short_names.includes(session.institute ?? '')
          )

          const mappedByInstituteCourse = instCourseMappings.some(mapping =>
            mapping.inst_short_name === session.institute &&
            courseSubjectMappings.some(courseSubject =>
              courseSubject.course_code === mapping.course_code &&
              courseSubject.subject_code === item.subject_code &&
              Array.isArray(courseSubject.inst_short_names) &&
              courseSubject.inst_short_names.includes(session.institute ?? '')
            )
          )

          return mappedByCourseSubject || mappedByInstituteCourse
        })
      : subjects
    return scoped.filter(item => matchesSearch(item, subjectSearch, ['subject_code', 'subject_short_name', 'subject_full_name', 'semester', 'spec_id']))
  }, [subjects, subjectSearch, session, courseSubjectMappings, instCourseMappings])

  const visibleFaculty = useMemo(() => {
    const base = session?.role === 'CA'
      ? faculty.filter(item => item.inst_short_name === session.institute)
      : session?.role === 'FAC'
        ? faculty.filter(item => item.inst_short_name === session.institute)
        : faculty

    return base.filter(item => matchesSearch(item, facultySearch, ['PAN', 'faculty_name', 'faculty_desig', 'faculty_Email', 'faculty_MobileNo', 'inst_short_name']))
  }, [faculty, facultySearch, session])

  const filtered = visibleFaculty

  const visibleInstCourseMappings = useMemo(() => {
    const base = session?.role === 'CA' || session?.role === 'FAC'
      ? instCourseMappings.filter(item => item.inst_short_name === session.institute)
      : instCourseMappings

    return base.filter(item => matchesSearch(item, instCourseSearch, ['inst_short_name', 'course_code', 'intake', 'strength']))
  }, [instCourseMappings, instCourseSearch, session])

  const visibleCourseSubjectMappings = useMemo(() => {
    const base = session?.role === 'CA' || session?.role === 'FAC'
      ? courseSubjectMappings.filter(item => {
          const institute = session.institute ?? ''
          const directInstituteMatch = Array.isArray(item.inst_short_names) && item.inst_short_names.includes(institute)
          const courseInstituteMatch = instCourseMappings.some(mapping => mapping.inst_short_name === institute && mapping.course_code === item.course_code)
          return directInstituteMatch || courseInstituteMatch
        })
      : courseSubjectMappings

    return base.filter(item => matchesSearch(item, courseSubjectSearch, ['course_code', 'subject_code']))
  }, [courseSubjectMappings, courseSubjectSearch, session, courses, instCourseMappings])

  const visibleFacultySubjects = useMemo(() => {
    const base = session?.role === 'FAC'
      ? facultySubjects.filter(item => faculty.some(f => f.PAN === item.PAN && f.inst_short_name === session.institute))
      : facultySubjects
    return base.filter(item => matchesSearch(item, facultySubjectSearch, ['PAN', 'subject_code']))
  }, [facultySubjects, faculty, facultySubjectSearch, session])

  const visibleFacultySpecs = useMemo(() => {
    const base = session?.role === 'FAC'
      ? facultySpecs.filter(item => faculty.some(f => f.PAN === item.PAN && f.inst_short_name === session.institute))
      : facultySpecs
    return base.filter(item => matchesSearch(item, facultySpecializationSearch, ['PAN', 'spec_id']))
  }, [facultySpecs, faculty, facultySpecializationSearch, session])

  const visibleUsers = useMemo(
    () => {
      const queryText = normalizeSearchValue(userSearch)
      const byRole = credentialFilter === 'ALL' ? users : users.filter(user => user.role === credentialFilter)
      if (!queryText) return byRole
      return byRole.filter(user => {
        const institute = user.role === 'CA' ? user.user_name : user.role === 'FAC' ? faculty.find(f => f.PAN === user.user_name)?.inst_short_name ?? '' : ''
        const pan = user.role === 'FAC' ? user.user_name : ''
        const haystack = [user.user_name, user.role, institute, pan].join(' ').toLowerCase()
        return haystack.includes(queryText)
      })
    },
    [users, credentialFilter, userSearch, faculty]
  )

  // Faculty available for credential creation (exclude those with FAC credentials)
  const availableFacultyForCredential = useMemo(() => {
    const existingFacCredentials = new Set(users.filter(u => u.role === 'FAC').map(u => u.user_name.toUpperCase()))
    const base = session?.role === 'CA' || session?.role === 'FAC'
      ? visibleFaculty.filter(f => !existingFacCredentials.has((f.PAN ?? '').toUpperCase()))
      : visibleFaculty.filter(f => !existingFacCredentials.has((f.PAN ?? '').toUpperCase()))
    return base
  }, [visibleFaculty, users, session])

  // Institutes available for credential creation (exclude those with CA credentials)
  const availableInstitutesForCredential = useMemo(() => {
    const existingCaCredentials = new Set(users.filter(u => u.role === 'CA').map(u => u.user_name.toUpperCase()))
    return visibleInstitutes.filter(i => !existingCaCredentials.has((i.inst_short_name ?? '').toUpperCase()))
  }, [visibleInstitutes, users])

  const mySubjects = facultySubjects.filter(item => item.PAN === session?.user_name)
  const mySpecializations = facultySpecs.filter(item => item.PAN === session?.user_name)
  const ownInstituteFaculty = faculty.filter(row => row.inst_short_name === session?.institute)

  const [assignmentTargetPan, setAssignmentTargetPan] = useState('')
  const assignmentFacultyOptions = session?.role === 'FAC' ? ownInstituteFaculty.filter(row => row.PAN) : []
  const selectedFacultyAssignments = assignmentTargetPan ? facultySubjects.filter(item => item.PAN === assignmentTargetPan) : []
  const selectedFacultySpecializations = assignmentTargetPan ? facultySpecs.filter(item => item.PAN === assignmentTargetPan) : []

  useEffect(() => {
    if (session?.role === 'FAC' && ownInstituteFaculty.length > 0 && !assignmentTargetPan) {
      setAssignmentTargetPan(ownInstituteFaculty[0].PAN)
    }
  }, [session, ownInstituteFaculty, assignmentTargetPan])

  async function saveFaculty(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = sanitizeFormPayload(e.currentTarget)
      if (!payload.PAN || String(payload.PAN).trim().length === 0) {
        throw new Error('PAN is required.')
      }
      const isCreate = !editing.PAN
      const saved = await request(isCreate ? '/api/faculty' : `/api/faculty/${encodeURIComponent(editing.PAN)}`, {
        method: isCreate ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      })
      setFaculty(rows => (isCreate ? [...rows, saved] : rows.map(row => (row.PAN === saved.PAN ? saved : row))))
      setSelected(saved)
      setEditing(null)
      setNotice('Faculty saved successfully.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save')
    } finally {
      setBusy(false)
    }
  }

  async function saveInstitute(e: FormEvent<HTMLFormElement> | any) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault()
    }

    const rawTarget = e?.currentTarget ?? e ?? {}
    const currentTarget = typeof rawTarget === 'object' ? rawTarget : {}
    const payload: Record<string, any> = {}

    for (const field of ['inst_short_name', 'inst_full_name', 'inst_Address1', 'inst_Address2', 'inst_District', 'inst_State', 'Landline_PhoneNo', 'Director_Name', 'Director_Desig', 'Director_Email', 'Director_MobileNo', 'ExamHead_Name', 'ExamHead_Desig', 'ExamHead_Email', 'ExamHead_MobileNo']) {
      const rawValue = currentTarget[field]
      const value = rawValue && typeof rawValue === 'object' && 'value' in rawValue ? rawValue.value : rawValue
      if (value !== undefined && value !== null && value !== '') {
        payload[field] = typeof value === 'string' ? value.trim() : value
      }
    }

    const instShortName = String(payload.inst_short_name ?? editingInst?.inst_short_name ?? '').trim()
    const isCreate = Boolean(e?.isCreate ?? !editingInst?.inst_short_name)

    if (!instShortName) {
      setError('Institute short name is required.')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const saved = await request(isCreate ? '/api/institutes' : `/api/institutes/${encodeURIComponent(editingInst?.inst_short_name ?? instShortName)}`, {
        method: isCreate ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      })

      setInstitutes(rows => (isCreate ? [...rows, saved] : rows.map(row => (row.inst_short_name === saved.inst_short_name ? saved : row))))
      setEditingInst(null)
      setNotice('Institute saved successfully.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save')
    } finally {
      setBusy(false)
    }
  }

  async function saveCourse(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = sanitizeFormPayload(e.currentTarget)
      const courseCode = String(payload.course_code ?? '').trim().toUpperCase()
      const isCreate = !editingCourse || !editingCourse.course_code
      const saved = await request(isCreate ? '/api/courses' : `/api/courses/${encodeURIComponent(editingCourse!.course_code)}`, {
        method: isCreate ? 'POST' : 'PUT',
        body: JSON.stringify({ ...payload, course_code: courseCode }),
      })
      setCourses(rows => (isCreate ? [...rows, saved] : rows.map(row => (row.course_code === editingCourse!.course_code ? saved : row))))
      setEditingCourse(null)
      setNotice('Course saved successfully.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save course')
    } finally {
      setBusy(false)
    }
  }

  async function saveSpecialization(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = sanitizeFormPayload(e.currentTarget)
      const isCreate = !editingSpec || !editingSpec.spec_id
      const saved = await request(isCreate ? '/api/specializations' : `/api/specializations/${encodeURIComponent(String(editingSpec!.spec_id))}`, {
        method: isCreate ? 'POST' : 'PUT',
        body: JSON.stringify({ ...payload, spec_id: Number(payload.spec_id) }),
      })
      setSpecializations(rows => (isCreate ? [...rows, saved] : rows.map(row => (row.spec_id === editingSpec!.spec_id ? saved : row))))
      setEditingSpec(null)
      setNotice('Specialization saved successfully.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save specialization')
    } finally {
      setBusy(false)
    }
  }

  async function saveSubject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = sanitizeFormPayload(e.currentTarget)
      const isCreate = !editingSubject || !editingSubject.subject_code
      const safePayload = {
        ...payload,
        semester: payload.semester ? Number(payload.semester) : undefined,
        spec_id: payload.spec_id ? Number(payload.spec_id) : undefined,
      }
      const saved = await request(isCreate ? '/api/subjects' : `/api/subjects/${encodeURIComponent(editingSubject!.subject_code)}`, {
        method: isCreate ? 'POST' : 'PUT',
        body: JSON.stringify(safePayload),
      })
      setSubjects(rows => (isCreate ? [...rows, saved] : rows.map(row => (row.subject_code === editingSubject!.subject_code ? saved : row))))
      setEditingSubject(null)
      setNotice('Subject saved successfully.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save subject')
    } finally {
      setBusy(false)
    }
  }

  async function deleteCourse(courseCode: string) {
    setBusy(true)
    setError('')
    try {
      await request(`/api/courses/${encodeURIComponent(courseCode)}`, { method: 'DELETE' })
      setCourses(rows => rows.filter(row => row.course_code !== courseCode))
      setNotice('Course deleted.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete course')
    } finally {
      setBusy(false)
    }
  }

  async function deleteSpecialization(specId: number) {
    setBusy(true)
    setError('')
    try {
      await request(`/api/specializations/${encodeURIComponent(String(specId))}`, { method: 'DELETE' })
      setSpecializations(rows => rows.filter(row => row.spec_id !== specId))
      setNotice('Specialization deleted.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete specialization')
    } finally {
      setBusy(false)
    }
  }

  async function deleteSubject(subjectCode: string) {
    setBusy(true)
    setError('')
    try {
      await request(`/api/subjects/${encodeURIComponent(subjectCode)}`, { method: 'DELETE' })
      setSubjects(rows => rows.filter(row => row.subject_code !== subjectCode))
      setNotice('Subject deleted.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete subject')
    } finally {
      setBusy(false)
    }
  }

  async function addFacultySubject() {
    if (!session || session.role !== 'FAC') return
    const subjectCode = (document.getElementById('faculty-subject-select') as HTMLSelectElement | null)?.value
    if (!subjectCode) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request('/api/faculty-subjects', {
        method: 'POST',
        body: JSON.stringify({ PAN: session.user_name, subject_code: subjectCode }),
      })
      setNotice('Subject added to your profile.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to add subject')
    } finally {
      setBusy(false)
    }
  }

  async function removeFacultySubject(subjectCode: string) {
    if (!session || session.role !== 'FAC') return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request(`/api/faculty-subjects/${encodeURIComponent(session.user_name)}/${encodeURIComponent(subjectCode)}`, { method: 'DELETE' })
      setNotice('Subject removed.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to remove subject')
    } finally {
      setBusy(false)
    }
  }

  async function addFacultySpec() {
    if (!session || session.role !== 'FAC') return
    const specId = (document.getElementById('faculty-spec-select') as HTMLSelectElement | null)?.value
    if (!specId) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request('/api/faculty-specializations', {
        method: 'POST',
        body: JSON.stringify({ PAN: session.user_name, spec_id: Number(specId) }),
      })
      setNotice('Specialization added to your profile.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to add specialization')
    } finally {
      setBusy(false)
    }
  }

  async function removeFacultySpec(specId: number) {
    if (!session || session.role !== 'FAC') return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request(`/api/faculty-specializations/${encodeURIComponent(session.user_name)}/${encodeURIComponent(String(specId))}`, { method: 'DELETE' })
      setNotice('Specialization removed.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to remove specialization')
    } finally {
      setBusy(false)
    }
  }

  async function saveInstCourse(req: { inst_short_name: string; course_code: string; intake?: string; strength?: string }) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request('/api/inst-courses', {
        method: 'POST',
        body: JSON.stringify({
          inst_short_name: req.inst_short_name,
          course_code: req.course_code,
          intake: req.intake ? Number(req.intake) : undefined,
          strength: req.strength ? Number(req.strength) : undefined,
        }),
      })
      setNotice('Institute-course mapping created.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create institute-course map')
    } finally {
      setBusy(false)
    }
  }

  async function deleteInstCourse(instShortName: string, courseCode: string) {
    setBusy(true)
    setError('')
    try {
      await request(`/api/inst-courses/${encodeURIComponent(instShortName)}/${encodeURIComponent(courseCode)}`, { method: 'DELETE' })
      setNotice('Institute-course mapping removed.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete institute-course map')
    } finally {
      setBusy(false)
    }
  }

  async function saveCourseSubject(req: { course_code: string; subject_code: string; study_year?: number | null; semester?: number | null; inst_short_names?: string[] }) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = {
        course_code: req.course_code,
        subject_code: req.subject_code,
        study_year: req.study_year ?? undefined,
        semester: req.semester ?? undefined,
        inst_short_names: Array.isArray(req.inst_short_names) ? req.inst_short_names.filter(Boolean) : [],
      }

      if (editingMapping) {
        await request(`/api/course-subjects/${encodeURIComponent(editingMapping.course_code)}/${encodeURIComponent(editingMapping.subject_code)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        setNotice('Course-subject mapping updated.')
      } else {
        await request('/api/course-subjects', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setNotice('Course-subject mapping created.')
      }
      await loadData()
      const refreshedMapping = {
        course_code: req.course_code,
        subject_code: req.subject_code,
        study_year: req.study_year ?? null,
        semester: req.semester ?? null,
        inst_short_names: Array.isArray(req.inst_short_names) ? req.inst_short_names.filter(Boolean) : [],
      }
      if (showMappingDetails || mappingDetails) {
        await openViewMapping(refreshedMapping)
      }
      setShowMappingModal(false)
      setEditingMapping(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create course-subject map')
    } finally {
      setBusy(false)
    }
  }

  async function deleteCourseSubject(courseCode: string, subjectCode: string) {
    setBusy(true)
    setError('')
    try {
      await request(`/api/course-subjects/${encodeURIComponent(courseCode)}/${encodeURIComponent(subjectCode)}`, { method: 'DELETE' })
      setNotice('Course-subject mapping removed.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete course-subject map')
    } finally {
      setBusy(false)
    }
  }

  async function openEditMapping(mapping: CourseSubjectMap) {
    const selectedInstituteCodes = Array.isArray(mapping.inst_short_names)
      ? mapping.inst_short_names
      : courseSubjectMappings.find((item) => item.course_code === mapping.course_code && item.subject_code === mapping.subject_code)?.inst_short_names ?? []

    setEditingMapping({ ...mapping, inst_short_names: selectedInstituteCodes })
    setShowMappingModal(true)
  }

  async function openAddMapping() {
    setEditingMapping(null)
    setShowMappingModal(true)
  }

  async function openViewMapping(mapping: CourseSubjectMap) {
    try {
      setError('')
      setMappingDetails(null)
      const [details, subjectDetails] = await Promise.all([
        request(`/api/courses/${encodeURIComponent(mapping.course_code)}/details`),
        request(`/api/subjects/${encodeURIComponent(mapping.subject_code)}/details`),
      ])

      const subjectCode = String(mapping.subject_code)
      const courseSubjectRow = Array.isArray(details.subjects)
        ? details.subjects.find((s: any) => String(s.subject_code ?? s.subject?.subject_code ?? '') === subjectCode) ?? null
        : null

      const rawInstituteRows = [
        ...(Array.isArray(subjectDetails.institutes) ? subjectDetails.institutes : []),
        ...(Array.isArray(details.institutesOffering) ? details.institutesOffering : []),
      ]
      const instituteRows = rawInstituteRows
        .map((entry: any) => entry?.institute ?? entry)
        .filter((institute: any) => institute && institute.inst_short_name)
        .filter((institute: any, index: number, arr: any[]) => {
          const key = String(institute.inst_short_name ?? institute.institute?.inst_short_name ?? '')
          return arr.findIndex((row: any) => String((row?.inst_short_name ?? row?.institute?.inst_short_name ?? '') || '') === key) === index
        })

      const courseFaculty = Array.isArray(details.faculty) ? details.faculty : []
      const subjectFaculty = Array.isArray(subjectDetails.faculty) ? subjectDetails.faculty : []
      const facultyRows = [...new Map(
        [...courseFaculty, ...subjectFaculty]
          .map((faculty: any) => [String(faculty.PAN ?? faculty.pan ?? faculty.faculty_id ?? `${faculty.faculty_name ?? 'faculty'}-${faculty.inst_short_name ?? 'inst'}`), faculty])
      ).values()]
        .filter((faculty: any) => {
          const subjectList = Array.isArray(faculty.subjects) ? faculty.subjects : []
          if (subjectList.length === 0) return true
          return subjectList.some((item: any) => {
            const itemCode = String(item.subject_code ?? item.subject?.subject_code ?? '')
            return itemCode === subjectCode
          })
        })

      setMappingDetails({
        course: details.course,
        subject: subjectDetails.subject ?? null,
        mapping: courseSubjectRow ?? {
          course_code: mapping.course_code,
          subject_code: subjectCode,
          study_year: mapping.study_year ?? null,
          semester: mapping.semester ?? null,
        },
        institutes: instituteRows,
        faculty: facultyRows,
      })
      setShowMappingDetails(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load mapping details')
    }
  }

  async function addCollegeToCourse(instShortName: string, courseCode: string) {
    if (!instShortName || !courseCode) return
    try {
      setBusy(true)
      await request('/api/inst-courses', {
        method: 'POST',
        body: JSON.stringify({ inst_short_name: instShortName, course_code: courseCode }),
      })
      setNotice('Institute mapped to the course.')
      await loadData()
      if (mappingDetails?.course?.course_code) {
        await openViewMapping({
          course_code: mappingDetails.course.course_code,
          subject_code: mappingDetails.mapping?.subject_code ?? mappingDetails.mapping?.subject?.subject_code,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to add institute mapping')
    } finally {
      setBusy(false)
    }
  }

  async function addFacultyToSubject(PAN: string, subjectCode: string) {
    if (!PAN || !subjectCode) return
    try {
      setBusy(true)
      await request('/api/faculty-subjects', {
        method: 'POST',
        body: JSON.stringify({ PAN, subject_code: subjectCode }),
      })
      setNotice('Faculty mapped to the subject.')
      await loadData()
      if (mappingDetails?.course?.course_code) {
        await openViewMapping({
          course_code: mappingDetails.course.course_code,
          subject_code: mappingDetails.mapping?.subject_code ?? mappingDetails.mapping?.subject?.subject_code,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to add faculty mapping')
    } finally {
      setBusy(false)
    }
  }
  async function deleteFaculty(pan: string) {
    if (!window.confirm(`Delete faculty ${pan}? This action cannot be undone.`)) return
    setBusy(true)
    setError('')
    try {
      await request(`/api/faculty/${encodeURIComponent(pan)}`, { method: 'DELETE' })
      setFaculty(rows => rows.filter(row => row.PAN !== pan))
      setNotice('Faculty deleted.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete faculty')
    } finally {
      setBusy(false)
    }
  }

  async function saveCredential(type: 'CA' | 'FAC', payload: UserPayload) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const normalizedUserName = normalizeUserName(payload.user_name)
      const existing = users.find(u => u.user_name.toUpperCase() === normalizedUserName && u.role === type)
      if (existing) {
        setError(`A credential already exists for this ${type === 'CA' ? 'institute' : 'faculty'} (${existing.user_name}). Please select or enter a different ${type === 'CA' ? 'institute code' : 'PAN'}.`)
        return
      }
      const body = { user_name: normalizedUserName, role: type, password: payload.password.trim() }
      console.log('Sending credential request:', body, 'Token:', sessionToken())
      const result = await request('/api/users', { method: 'POST', body: JSON.stringify(body) })
      console.log('Credential created:', result)
      setNotice(`${type === 'CA' ? 'College Admin' : 'Faculty'} credential created for "${normalizedUserName}". They can now sign in with this username and password.`)
      setCaCredential({ user_name: '', password: '', role: 'CA' })
      setFacCredential({ user_name: '', password: '', role: 'FAC' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unable to create credential'
      console.error('Credential creation error:', msg)
      if (msg.toLowerCase().includes('already exists')) {
        setError(`A login credential already exists for this ${type === 'CA' ? 'institute' : 'faculty'}. It has been removed from the list. Please refresh and try again.`)
        setCaCredential({ user_name: '', password: '', role: 'CA' })
        setFacCredential({ user_name: '', password: '', role: 'FAC' })
      } else {
        setError(msg)
      }
    } finally {
      setBusy(false)
      try {
        await loadData()
      } catch (e) {
        console.error('Failed to reload data:', e)
           }
    }
  }

  async function deleteCredential(user_name: string, role: string) {
    if (!window.confirm(`Revoke credential for ${user_name} (${role})?`)) return
    setBusy(true)
    setError('')
    try {
      await request(`/api/users/${encodeURIComponent(user_name)}/${encodeURIComponent(role)}`, { method: 'DELETE' })
      setUsers(rows => rows.filter(row => !(row.user_name === user_name && row.role === role)))
      setNotice('Credential revoked.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to revoke credential')
    } finally {
      setBusy(false)
    }
  }

  async function importInstitutesCsv(records: Record<string, string>[]) {
    for (const row of records) {
      const instShortName = String(row.inst_short_name ?? row.instShortName ?? '').trim()
      if (!instShortName) continue
      const payload = {
        inst_short_name: instShortName,
        inst_full_name: row.inst_full_name ?? row.instFullName ?? '',
        inst_Address1: row.inst_Address1 ?? row.address1 ?? '',
        inst_Address2: row.inst_Address2 ?? row.address2 ?? '',
        inst_District: row.inst_District ?? row.district ?? '',
        inst_State: row.inst_State ?? row.state ?? '',
        Landline_PhoneNo: row.Landline_PhoneNo ?? row.landline ?? '',
        Director_Name: row.Director_Name ?? row.director_name ?? '',
        Director_Desig: row.Director_Desig ?? row.director_desig ?? '',
        Director_Email: row.Director_Email ?? row.director_email ?? '',
        Director_MobileNo: row.Director_MobileNo ?? row.director_mobile ?? '',
        ExamHead_Name: row.ExamHead_Name ?? row.exam_head_name ?? '',
        ExamHead_Desig: row.ExamHead_Desig ?? row.exam_head_desig ?? '',
        ExamHead_Email: row.ExamHead_Email ?? row.exam_head_email ?? '',
        ExamHead_MobileNo: row.ExamHead_MobileNo ?? row.exam_head_mobile ?? '',
      }
      await request('/api/institutes', { method: 'POST', body: JSON.stringify(payload) })
    }
    setNotice('Institute CSV imported successfully.')
    await loadData()
  }

  async function importCoursesCsv(records: Record<string, string>[]) {
    for (const row of records) {
      const courseCode = String(row.course_code ?? row.courseCode ?? '').trim().toUpperCase()
      if (!courseCode) continue
      const payload = {
        course_code: courseCode,
        course_short_name: row.course_short_name ?? '',
        course_full_name: row.course_full_name ?? '',
      }
      await request('/api/courses', { method: 'POST', body: JSON.stringify(payload) })
    }
    setNotice('Course CSV imported successfully.')
    await loadData()
  }

  async function importFacultySubjectsCsv(records: Record<string, string>[]) {
    for (const row of records) {
      const pan = String(row.PAN ?? row.pan ?? '').trim()
      const subjectCode = String(row.subject_code ?? row.subjectCode ?? '').trim()
      if (!pan || !subjectCode) continue
      await request('/api/faculty-subjects', { method: 'POST', body: JSON.stringify({ PAN: pan, subject_code: subjectCode }) })
    }
    setNotice('Faculty-subject CSV imported successfully.')
    await loadData()
  }

  async function importFacultySpecsCsv(records: Record<string, string>[]) {
    for (const row of records) {
      const pan = String(row.PAN ?? row.pan ?? '').trim()
      const specId = Number(row.spec_id ?? row.specId ?? 0)
      if (!pan || !specId) continue
      await request('/api/faculty-specializations', { method: 'POST', body: JSON.stringify({ PAN: pan, spec_id: specId }) })
    }
    setNotice('Faculty-specialization CSV imported successfully.')
    await loadData()
  }

  async function importInstCoursesCsv(records: Record<string, string>[]) {
    for (const row of records) {
      const instShortName = String(row.inst_short_name ?? row.instShortName ?? '').trim()
      const courseCode = String(row.course_code ?? row.courseCode ?? '').trim().toUpperCase()
      if (!instShortName || !courseCode) continue
      await request('/api/inst-courses', { method: 'POST', body: JSON.stringify({ inst_short_name: instShortName, course_code: courseCode, intake: row.intake ? Number(row.intake) : undefined, strength: row.strength ? Number(row.strength) : undefined }) })
    }
    setNotice('Institute-course CSV imported successfully.')
    await loadData()
  }

  async function importCourseSubjectsCsv(records: Record<string, string>[]) {
    for (const row of records) {
      const courseCode = String(row.course_code ?? row.courseCode ?? '').trim().toUpperCase()
      const subjectCode = String(row.subject_code ?? row.subjectCode ?? '').trim()
      if (!courseCode || !subjectCode) continue
      await request('/api/course-subjects', { method: 'POST', body: JSON.stringify({ course_code: courseCode, subject_code: subjectCode, study_year: row.study_year ? Number(row.study_year) : undefined, semester: row.semester ? Number(row.semester) : undefined }) })
    }
    setNotice('Course-subject CSV imported successfully.')
    await loadData()
  }

  async function importSpecializationsCsv(records: Record<string, string>[]) {
    for (const row of records) {
      const specId = Number(row.spec_id ?? row.specId ?? 0)
      const specName = String(row.spec_name ?? row.specName ?? '').trim()
      if (!specId && !specName) continue
      await request('/api/specializations', {
        method: 'POST',
        body: JSON.stringify({
          spec_id: specId || undefined,
          spec_name: specName || undefined,
        }),
      })
    }
    setNotice('Specialization CSV imported successfully.')
    await loadData()
  }

  async function importSubjectsCsv(records: Record<string, string>[]) {
    for (const row of records) {
      const subjectCode = String(row.subject_code ?? row.subjectCode ?? '').trim()
      if (!subjectCode) continue
      await request('/api/subjects', {
        method: 'POST',
        body: JSON.stringify({
          subject_code: subjectCode,
          subject_short_name: row.subject_short_name ?? row.subjectShortName ?? '',
          subject_full_name: row.subject_full_name ?? row.subjectFullName ?? '',
          semester: row.semester ? Number(row.semester) : undefined,
          spec_id: row.spec_id ? Number(row.spec_id) : undefined,
          sub_subject_codes: row.sub_subject_codes ?? row.subSubjectCodes ?? '',
        }),
      })
    }
    setNotice('Subjects CSV imported successfully.')
    await loadData()
  }

  async function importFacultyCsv(records: Record<string, string>[]) {
    for (const row of records) {
      const pan = String(row.PAN ?? row.pan ?? '').trim()
      if (!pan) continue
      await request('/api/faculty', {
        method: 'POST',
        body: JSON.stringify({
          PAN: pan,
          Title: row.Title ?? '',
          faculty_name: row.faculty_name ?? row.facultyName ?? '',
          inst_short_name: row.inst_short_name ?? row.instShortName ?? session?.institute ?? '',
          faculty_desig: row.faculty_desig ?? row.facultyDesig ?? '',
          faculty_total_exp: row.faculty_total_exp ? Number(row.faculty_total_exp) : 0,
          faculty_address: row.faculty_address ?? row.address ?? '',
          faculty_Email: row.faculty_Email ?? row.email ?? '',
          faculty_MobileNo: row.faculty_MobileNo ?? row.mobile ?? '',
          entered_by: row.entered_by ?? '',
          entered_on: row.entered_on ?? '',
        }),
      })
    }
    setNotice('Faculty CSV imported successfully.')
    await loadData()
  }

  async function readCsvFileAndImport(file: File, importer: (records: Record<string, string>[]) => Promise<void>) {
    const text = await file.text()
    const records = parseCsvRecords(text)
    if (records.length === 0) throw new Error('No CSV rows were found to import.')
   
    await importer(records)
  }

  async function handleCsvImport(event: React.ChangeEvent<HTMLInputElement>, importer: (records: Record<string, string>[]) => Promise<void>) {
       const file = event.target.files?.[0]
    if (!file) return
    try {
      await readCsvFileAndImport(file, importer)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to import CSV')
    } finally {
      event.target.value = ''
    }
  }

  async function importFromCsvFile(event: React.ChangeEvent<HTMLInputElement>, importer: (records: Record<string, string>[]) => Promise<void>) {
    return handleCsvImport(event, importer)
  }

  async function deleteInstitute(instShortName: string) {
    if (!window.confirm(`Delete institute ${instShortName}? This action cannot be undone.`)) return
    setBusy(true)
    setError('')
    try {
      await request(`/api/institutes/${encodeURIComponent(instShortName)}`, { method: 'DELETE' })
      setInstitutes(rows => rows.filter(row => row.inst_short_name !== instShortName))
      setNotice('Institute deleted.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete institute')
    } finally {
      setBusy(false)
    }
  }

  function signOut() {
    onLogout()
  }

  const sessionRole = session?.role ?? ''
  const isFaculty = sessionRole === 'FAC'
  const isCollegeAdmin = sessionRole === 'CA'
  const isCentralExaminer = sessionRole === 'CE'
  const profile = isFaculty ? faculty.find(row => row.PAN === session?.user_name) : null

  const facultyDashboard = useMemo(() => {
    const instituteFaculty = session?.role === 'FAC' ? faculty.filter(item => item.inst_short_name === session.institute) : faculty
    const instituteSubjects = session?.role === 'FAC' ? subjects.filter(subject => {
      const courseCodes = courseSubjectMappings.filter(mapping => mapping.subject_code === subject.subject_code).map(mapping => mapping.course_code)
      return courseCodes.some(courseCode => instCourseMappings.some(mapping => mapping.inst_short_name === session.institute && mapping.course_code === courseCode))
    }) : subjects
    const facultySubjectCount = session?.role === 'FAC' ? facultySubjects.filter(item => instituteFaculty.some(f => f.PAN === item.PAN)) : facultySubjects
    const facultySpecCount = session?.role === 'FAC' ? facultySpecs.filter(item => instituteFaculty.some(f => f.PAN === item.PAN)) : facultySpecs
    return {
      totalFaculty: instituteFaculty.length,
      totalSubjects: instituteSubjects.length,
      totalFacultySubjectMappings: facultySubjectCount.length,
      totalFacultySpecializationMappings: facultySpecCount.length,
    }
  }, [session, faculty, subjects, facultySubjects, facultySpecs, courseSubjectMappings, instCourseMappings])

  async function addFacultyRecordFromForm(form: HTMLFormElement) {
    const payload = sanitizeFormPayload(form)
    if (!payload.PAN || !payload.faculty_name) {
      throw new Error('PAN and Faculty Name are required.')
    }
    if (session?.role === 'FAC' && payload.inst_short_name && String(payload.inst_short_name) !== session.institute) {
      throw new Error('College User cannot change the institute.');
    }
    const body = {
      ...payload,
      inst_short_name: session?.role === 'FAC' ? session.institute : payload.inst_short_name,
      faculty_total_exp: payload.faculty_total_exp !== undefined ? Number(payload.faculty_total_exp) : undefined,
      faculty_Email: payload.faculty_Email ?? '',
      faculty_MobileNo: payload.faculty_MobileNo ?? '',
    }
    const saved = await request('/api/faculty', { method: 'POST', body: JSON.stringify(body) })
    setFaculty(rows => [...rows, saved])
    setEditing(null)
    setNotice('Faculty created successfully.')
    await loadData()
  }

  async function updateFacultyRecordFromForm(form: HTMLFormElement, pan: string) {
    const payload = sanitizeFormPayload(form)
    if (session?.role === 'FAC' && payload.inst_short_name && String(payload.inst_short_name) !== session.institute) {
      throw new Error('College User cannot change the institute.')
    }
    const saved = await request(`/api/faculty/${encodeURIComponent(pan)}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...payload,
        inst_short_name: session?.role === 'FAC' ? session.institute : payload.inst_short_name,
        faculty_total_exp: payload.faculty_total_exp !== undefined ? Number(payload.faculty_total_exp) : undefined,
      }),
    })
    setFaculty(rows => rows.map(row => row.PAN === saved.PAN ? saved : row))
    setEditing(null)
    setNotice('Faculty updated successfully.')
    await loadData()
  }

  async function importFacultyData() {
    if (!window.confirm('This will overwrite existing faculty data. Continue?')) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await request('/api/faculty/import-template')
      const url = res.url
      const link = document.createElement('a')
      link.href = url
      link.download = 'faculty-template.csv'
      link.click()
      URL.revokeObjectURL(url)
      setNotice('Faculty data imported successfully.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to import faculty data')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></div>
          <div>
            <p className="font-semibold text-sidebar-foreground">Panel of Examiner Management System</p>
            <p className="text-xs text-sidebar-foreground/80">{roleLabels[session.role]}</p>
          </div>
          <button className="ml-auto lg:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)}><X /></button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-4">
          {navFor[session.role].map(item => (
            <button key={item} onClick={() => { setActive(item); setSidebarOpen(false) }} className={`rounded-lg px-3 py-2.5 text-left text-sm ${active === item ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'}`}>
              {item}
            </button>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4 space-y-2">
          {isCollegeAdmin && (
            <button onClick={() => setShowPasswordChange(true)} className="flex w-full items-center gap-3 rounded-lg p-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground">
              <Key className="size-4" /> Change Password
            </button>
          )}
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg p-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      {sidebarOpen && <button className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="lg:pl-64">
        <header className="flex h-20 items-center justify-between border-b bg-card px-8 text-foreground">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-foreground" onClick={() => setSidebarOpen(true)}><Menu /></button>
            <div>
              <p className="text-xs text-muted-foreground">{session.institute || 'Global'}</p>
              <h1 className="text-lg font-semibold text-foreground">{active}</h1>
            </div>
          </div>
          <UserRound className="size-4 text-foreground" />
        </header>

        <div className="p-8">
          <ErrorAlert msg={error} />
          <SuccessAlert msg={notice} />

          <div className="mb-6">
            <div className="flex gap-2">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
                placeholder={session?.role === 'CE' ? 'Search colleges, courses, subjects or faculty...' : session?.role === 'CA' ? 'Search faculty, courses or subjects in your college...' : 'Search faculty or subjects...'}
                className="flex-1 rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <Button onClick={() => doSearch()} disabled={searching}>{searching ? 'Searching...' : 'Search'}</Button>
              <Button variant="outline" onClick={() => { setQuery(''); setSearchResults(null) }}>{'Clear'}</Button>
            </div>

            {searchResults && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border bg-card p-4">
                  <h3 className="font-semibold">Institutes</h3>
                  <div className="mt-2 space-y-2">
                    {(searchResults.institutes ?? []).length === 0 ? <div className="text-sm text-muted-foreground">No institutes found.</div> : (searchResults.institutes ?? []).map((i: any) => <div key={i.inst_short_name} className="p-2 rounded hover:bg-muted cursor-pointer" onClick={() => openInstituteDetails(i.inst_short_name)}>{i.inst_short_name} — {i.inst_full_name}</div>)}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-lg border bg-card p-4">
                    <h3 className="font-semibold">Courses</h3>
                    <div className="mt-2 space-y-2">{(searchResults.courses ?? []).length === 0 ? <div className="text-sm text-muted-foreground">No courses found.</div> : (searchResults.courses ?? []).map((c: any) => <div key={c.course_code} className="p-2 rounded hover:bg-muted cursor-pointer" onClick={() => openCourseDetails(c.course_code)}>{c.course_code} — {c.course_full_name || c.course_short_name}</div>)}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <h3 className="font-semibold">Subjects</h3>
                    <div className="mt-2 space-y-2">{(searchResults.subjects ?? []).length === 0 ? <div className="text-sm text-muted-foreground">No subjects found.</div> : (searchResults.subjects ?? []).map((s: any) => <div key={s.subject_code} className="p-2 rounded hover:bg-muted cursor-pointer" onClick={() => openSubjectDetails(s.subject_code)}>{s.subject_code} — {s.subject_full_name || s.subject_short_name}</div>)}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <h3 className="font-semibold">Faculty</h3>
                    <div className="mt-2 space-y-2">{(searchResults.faculty ?? []).length === 0 ? <div className="text-sm text-muted-foreground">No faculty found.</div> : (searchResults.faculty ?? []).map((f: any) => <div key={f.PAN} className="p-2 rounded hover:bg-muted cursor-pointer" onClick={() => setSelected(f)}>{f.faculty_name || f.PAN} — {f.PAN} — {f.inst_short_name}</div>)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {isFaculty && active === 'Dashboard' && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-6">
                <h2 className="text-2xl font-bold text-foreground">College User</h2>
                <p className="mt-1 text-sm text-muted-foreground">Institute: {session.institute || 'Not assigned'}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Stat label="Total Faculty" value={facultyDashboard.totalFaculty} icon={Users} />
                <Stat label="Total Subjects" value={facultyDashboard.totalSubjects} icon={BookOpen} />
                <Stat label="Total Faculty-Subject Mappings" value={facultyDashboard.totalFacultySubjectMappings} icon={ClipboardList} />
                <Stat label="Total Faculty-Specialization Mappings" value={facultyDashboard.totalFacultySpecializationMappings} icon={ShieldCheck} />
              </div>
              <div className="rounded-lg border bg-card p-4">
                <h3 className="mb-4 text-lg font-semibold">Quick Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setEditing({ PAN: '', Title: '', faculty_name: '', inst_short_name: session.institute ?? '', faculty_desig: '', faculty_total_exp: 0, faculty_address: '', faculty_Email: '', faculty_MobileNo: '', entered_by: '', entered_on: '' })}><Plus className="size-4" /> Add Faculty</Button>
                  <Button variant="outline" onClick={() => setActive('Faculty')}>Manage Faculty</Button>
                  <Button variant="outline" onClick={() => setActive('Courses')}>Faculty Subject Mapping</Button>
                  <Button variant="outline" onClick={() => setActive('Specializations')}>Faculty Specialization Mapping</Button>
                </div>
              </div>
            </div>
          )}

          {isFaculty && active === 'Faculty' && (
            <div className="rounded-lg border bg-card p-4 text-foreground">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-2xl font-semibold">Faculty Management</h2>
                  <p className="text-sm text-muted-foreground">Institute: {session.institute || 'Not assigned'}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => downloadCsv('faculty.csv', ['PAN', 'Title', 'faculty_name', 'faculty_desig', 'faculty_total_exp', 'faculty_address', 'faculty_Email', 'faculty_MobileNo', 'inst_short_name'], visibleFaculty)}>CSV Export</Button>
                  <Button size="sm" onClick={() => setEditing({ PAN: '', Title: '', faculty_name: '', inst_short_name: session.institute ?? '', faculty_desig: '', faculty_total_exp: 0, faculty_address: '', faculty_Email: '', faculty_MobileNo: '', entered_by: '', entered_on: '' })}><Plus className="size-4" /> Add Faculty</Button>
                </div>
              </div>
              <div className="mb-4 flex gap-2">
                <input value={facultySearch} onChange={e => setFacultySearch(e.target.value)} placeholder="Search faculty by PAN, name, designation, email..." className="flex-1 rounded border border-input bg-background px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
              </div>
              {visibleFaculty.length === 0 ? (
                <div className="rounded border border-dashed p-8 text-center"><p className="text-lg font-medium">No faculty records found.</p></div>
              ) : (
                <div className="space-y-2">
                  {visibleFaculty.map(item => (
                    <div key={item.PAN} className="flex items-center justify-between rounded border p-3">
                      <div>
                        <div className="font-medium">{item.faculty_name || item.PAN}</div>
                        <div className="text-sm text-muted-foreground">{item.PAN} • {item.faculty_desig || 'Designation'} • {item.inst_short_name}</div>
                        <div className="text-xs text-muted-foreground">{item.faculty_Email || 'No email'} • {item.faculty_MobileNo || 'No mobile'}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelected(item)}>View</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditing(item)}>Edit</Button>
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteFaculty(item.PAN)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isFaculty && active === 'Courses' && (
            <div className="rounded-lg border bg-card p-4 text-foreground">
              <div className="mb-4 flex gap-2">
                <input value={courseSearch} onChange={e => setCourseSearch(e.target.value)} placeholder="Search courses..." className="flex-1 rounded border border-input bg-background px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                <Button variant="outline" size="sm" onClick={() => downloadCsv('courses.csv', ['course_code', 'course_short_name', 'course_full_name'], visibleCourses)}>CSV</Button>
                <input id="upload-courses-fac" type="file" accept=".csv" onChange={e => importFromCsvFile(e, importCoursesCsv)} className="hidden" />
                <Button variant="outline" size="sm" onClick={() => document.getElementById('upload-courses-fac')?.click()}>Upload</Button>
                <Button size="sm" onClick={() => setEditingCourse({ course_code: '', course_short_name: '', course_full_name: '' })}>Add</Button>
              </div>
              <div className="space-y-2">
                {visibleCourses.length === 0 ? <p className="text-sm text-muted-foreground">No results found.</p> : visibleCourses.map(item => (
                  <div key={item.course_code} className="flex items-center justify-between rounded border p-3">
                    <div><div className="font-medium font-mono">{item.course_code}</div><div className="text-sm text-muted-foreground">{item.course_full_name || item.course_short_name}</div></div>
                    <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditingCourse(item)}>Edit</Button><Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteCourse(item.course_code)}>Delete</Button></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isFaculty && active === 'Credentials' && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4 text-foreground">
                <h2 className="text-2xl font-semibold">Create Credentials</h2>
                <p className="text-sm text-muted-foreground">Generate login accounts for college admins and faculty members.</p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3 rounded border p-4">
                    <h3 className="font-semibold">College Admin Credential</h3>
                    <select value={caCredential.user_name} onChange={e => setCaCredential(prev => ({ ...prev, user_name: e.target.value }))} className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                      <option value="">Select institute</option>
                      {availableInstitutesForCredential.map(item => (
                        <option key={item.inst_short_name} value={item.inst_short_name}>{item.inst_short_name} — {item.inst_full_name || 'Institute'}</option>
                      ))}
                    </select>
                    <input value={caCredential.password} onChange={e => setCaCredential(prev => ({ ...prev, password: e.target.value }))} type="password" placeholder="Password" className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                    <Button onClick={() => saveCredential('CA', caCredential)}>Create College Admin Credential</Button>
                  </div>

                  <div className="space-y-3 rounded border p-4">
                    <h3 className="font-semibold">Faculty Credential</h3>
                    <select value={facCredential.user_name} onChange={e => setFacCredential(prev => ({ ...prev, user_name: e.target.value }))} className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                      <option value="">Select faculty PAN</option>
                      {availableFacultyForCredential.map(f => (
                        <option key={f.PAN} value={f.PAN}>{f.faculty_name || f.PAN} — {f.PAN}</option>
                      ))}
                    </select>
                    <input value={facCredential.password} onChange={e => setFacCredential(prev => ({ ...prev, password: e.target.value }))} type="password" placeholder="Password" className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                    <Button onClick={() => saveCredential('FAC', facCredential)}>Create Faculty Credential</Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4 text-foreground">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">Existing Credentials</h3>
                  <select value={credentialFilter} onChange={e => setCredentialFilter(e.target.value as 'ALL' | 'CA' | 'FAC')} className="rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                    <option value="ALL">All</option>
                    <option value="CA">College Admin</option>
                    <option value="FAC">Faculty</option>
                  </select>
                </div>
                <div className="space-y-2">
                  {visibleUsers.length === 0 ? <p className="text-sm text-muted-foreground">No credentials created yet.</p> : visibleUsers.map(item => (
                    <div key={`${item.user_name}-${item.role}`} className="flex items-center justify-between rounded border p-3">
                      <div><div className="font-medium">{item.user_name}</div><div className="text-sm text-muted-foreground">{item.role === 'CA' ? 'College Admin' : 'Faculty'} role</div></div>
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteCredential(item.user_name, item.role)}>Revoke</Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isFaculty && (
            <>
              {active === 'Overview' && (
                <div className="grid gap-4 sm:grid-cols-4">
                  <Stat label="Institutes" value={institutes.length} icon={Building2} />
                  <Stat label="Courses" value={courses.length} icon={BookOpen} />
                  <Stat label="Subjects" value={subjects.length} icon={ClipboardList} />
                  <Stat label="Faculty" value={faculty.length} icon={Users} />
                </div>
              )}

              {active === 'My College' && isCollegeAdmin && (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-white p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-blue-900">{session.institute}</h2>
                        <p className="text-sm text-gray-600 mt-1">{institutes.find(item => item.inst_short_name === session.institute)?.inst_full_name || 'College Administration Profile'}</p>
                      </div>
                      <Button onClick={() => setShowInstituteProfileForm(true)} className="bg-blue-600 hover:bg-blue-700">Edit Profile</Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded border p-4 bg-white"><div className="text-xs font-semibold text-gray-500 uppercase">Faculty Count</div><div className="text-3xl font-bold text-blue-600 mt-2">{ownInstituteFaculty.length}</div></div>
                      <div className="rounded border p-4 bg-white"><div className="text-xs font-semibold text-gray-500 uppercase">Courses Offered</div><div className="text-3xl font-bold text-purple-600 mt-2">{visibleInstCourseMappings.length}</div></div>
                      <div className="rounded border p-4 bg-white"><div className="text-xs font-semibold text-gray-500 uppercase">Subjects</div><div className="text-3xl font-bold text-green-600 mt-2">{visibleCourseSubjectMappings.length}</div></div>
                    </div>
                  </div>
                </div>
              )}

              {active === 'Institutes' && isCentralExaminer && (
                <div className="rounded-lg border bg-card p-4 text-foreground">
                  <div className="mb-4 flex gap-2">
                    <input value={instituteSearch} onChange={e => setInstituteSearch(e.target.value)} placeholder="Search institutes..." className="flex-1 rounded border border-input bg-background px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                    <Button variant="outline" size="sm" onClick={() => downloadCsv('institutes.csv', ['inst_short_name', 'inst_full_name', 'inst_District', 'inst_State'], visibleInstitutes)}>CSV</Button>
                    <input id="upload-institutes" type="file" accept=".csv" onChange={e => importFromCsvFile(e, importInstitutesCsv)} className="hidden" />
                    <Button variant="outline" size="sm" onClick={() => document.getElementById('upload-institutes')?.click()}>Upload</Button>
                    <Button size="sm" onClick={() => { setEditingInst(null); setShowInstituteFormForCE(true) }}>Add</Button>
                  </div>
                  <div className="space-y-2">
                    {visibleInstitutes.length === 0 ? <p className="text-sm text-muted-foreground">No results found.</p> : visibleInstitutes.map(item => (
                      <div key={item.inst_short_name} className="flex items-center justify-between rounded border p-3">
                        <div><div className="font-medium">{item.inst_short_name}</div><div className="text-sm text-muted-foreground">{item.inst_full_name}</div></div>
                        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setEditingInst(item); setShowInstituteFormForCE(true) }}>Edit</Button><Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteInstitute(item.inst_short_name)}>Delete</Button></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {active === 'Courses' && (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-card p-4 text-foreground">
                    <div className="mb-4 flex gap-2">
                      <input value={courseSearch} onChange={e => setCourseSearch(e.target.value)} placeholder="Search courses..." className="flex-1 rounded border border-input bg-background px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                      <Button variant="outline" size="sm" onClick={() => downloadCsv('courses.csv', ['course_code', 'course_short_name', 'course_full_name'], visibleCourses)}>CSV</Button>
                      <input id="upload-courses-ce" type="file" accept=".csv" onChange={e => importFromCsvFile(e, importCoursesCsv)} className="hidden" />
                      <Button variant="outline" size="sm" onClick={() => document.getElementById('upload-courses-ce')?.click()}>Upload</Button>
                      <Button size="sm" onClick={() => setEditingCourse({ course_code: '', course_short_name: '', course_full_name: '' })}>Add</Button>
                    </div>
                    <div className="space-y-2">
                      {visibleCourses.length === 0 ? <p className="text-sm text-muted-foreground">No results found.</p> : visibleCourses.map(item => (
                        <div key={item.course_code} className="flex items-center justify-between rounded border p-3">
                          <div><div className="font-medium font-mono">{item.course_code}</div><div className="text-sm text-muted-foreground">{item.course_full_name || item.course_short_name}</div></div>
                          <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditingCourse(item)}>Edit</Button><Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteCourse(item.course_code)}>Delete</Button></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(isCentralExaminer || isCollegeAdmin) && (
                    <div className="rounded-lg border bg-card p-4 text-foreground">
                      <div className="mb-4 flex items-center justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-semibold">Course - Subject Mappings</h3>
                          <p className="text-sm text-muted-foreground">Keep year, semester and college association together in the same mapping.</p>
                        </div>
                        <Button size="sm" onClick={() => openAddMapping()}>Add</Button>
                      </div>
                      <div className="space-y-2">
                        {visibleCourseSubjectMappings.length === 0 ? <p className="text-sm text-muted-foreground">No course-subject mappings found.</p> : visibleCourseSubjectMappings.map(item => (
                          <div key={`${item.course_code}-${item.subject_code}`} className="flex items-center justify-between gap-3 rounded border p-3">
                            <div><div className="font-medium">{item.course_code} → {item.subject_code}</div><div className="text-sm text-muted-foreground">Year: {item.study_year ?? '-'} • Semester: {item.semester ?? '-'} • Colleges: {Array.isArray(item.inst_short_names) && item.inst_short_names.length > 0 ? item.inst_short_names.join(', ') : '—'}</div></div>
                            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => openViewMapping(item)}>View</Button><Button size="sm" variant="outline" onClick={() => openEditMapping(item)}>Edit</Button><Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteCourseSubject(item.course_code, item.subject_code)}>Delete</Button></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(active === 'Faculty' || active === 'Users') && (isCentralExaminer || isCollegeAdmin) && (
                <div className="rounded-lg border bg-card p-4 text-foreground">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-2xl font-semibold">{active === 'Users' ? 'Users' : 'Faculty Management'}</h2>
                      <p className="text-sm text-muted-foreground">Institute: {session.institute || 'All'}</p>
                    </div>
                    {active !== 'Users' && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => downloadCsv('faculty.csv', ['PAN', 'Title', 'faculty_name', 'faculty_desig', 'faculty_total_exp', 'faculty_address', 'faculty_Email', 'faculty_MobileNo', 'inst_short_name'], visibleFaculty)}>CSV Export</Button>
                        <Button size="sm" onClick={() => setEditing({ PAN: '', Title: '', faculty_name: '', inst_short_name: session.institute ?? '', faculty_desig: '', faculty_total_exp: 0, faculty_address: '', faculty_Email: '', faculty_MobileNo: '', entered_by: '', entered_on: '' })}>Add</Button>
                      </div>
                    )}
                  </div>

                  {active === 'Users' ? (
                    <>
                      <div className="mb-4 flex gap-2">
                        <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users..." className="flex-1 rounded border border-input bg-background px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                        <select value={credentialFilter} onChange={e => setCredentialFilter(e.target.value as 'ALL' | 'CA' | 'FAC')} className="rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                          <option value="ALL">All</option>
                          <option value="CA">College Admin</option>
                          <option value="FAC">Faculty</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        {visibleUsers.length === 0 ? <p className="text-sm text-muted-foreground">No users found.</p> : visibleUsers.map(item => (
                          <div key={`${item.user_name}-${item.role}`} className="flex items-center justify-between rounded border p-3">
                            <div><div className="font-medium">{item.user_name}</div><div className="text-sm text-muted-foreground">{item.role === 'CA' ? 'College Admin' : 'Faculty'} • {item.role === 'CA' ? 'Institute Login' : 'Faculty Login'}</div></div>
                            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setUserSearch(item.user_name)}>Search</Button><Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteCredential(item.user_name, item.role)}>Revoke</Button></div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-4 flex gap-2">
                        <input value={facultySearch} onChange={e => setFacultySearch(e.target.value)} placeholder="Search faculty..." className="flex-1 rounded border border-input bg-background px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                      </div>
                      <div className="space-y-2">
                        {visibleFaculty.length === 0 ? <p className="text-sm text-muted-foreground">No faculty records found.</p> : visibleFaculty.map(item => (
                          <div key={item.PAN} className="flex items-center justify-between rounded border p-3">
                            <div><div className="font-medium">{item.faculty_name || item.PAN}</div><div className="text-sm text-muted-foreground">{item.PAN} • {item.faculty_desig || 'Designation'} • {item.inst_short_name}</div></div>
                            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setSelected(item)}>View</Button><Button size="sm" variant="outline" onClick={() => setEditing(item)}>Edit</Button><Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteFaculty(item.PAN)}>Delete</Button></div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {active === 'Specializations' && (
                <div className="rounded-lg border bg-card p-4 text-foreground">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-2xl font-semibold">Specializations</h2>
                      <p className="text-sm text-muted-foreground">Institute: {session.institute || 'All'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => downloadCsv('specializations.csv', ['spec_id', 'spec_name'], visibleSpecializations)}>Download CSV</Button>
                      <input id="upload-specializations-ce" type="file" accept=".csv" onChange={e => importFromCsvFile(e, importSpecializationsCsv)} className="hidden" />
                      <Button variant="outline" size="sm" onClick={() => document.getElementById('upload-specializations-ce')?.click()}>Upload CSV</Button>
                      <Button size="sm" onClick={() => setEditingSpec({ spec_id: 0, spec_name: '' })}>Add</Button>
                    </div>
                  </div>
                  <div className="mb-4 flex gap-2">
                    <input value={specializationSearch} onChange={e => setSpecializationSearch(e.target.value)} placeholder="Search specialization..." className="flex-1 rounded border border-input bg-background px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    {visibleSpecializations.length === 0 ? <p className="text-sm text-muted-foreground">No specialization records found.</p> : visibleSpecializations.map(item => (
                      <div key={item.spec_id} className="flex items-center justify-between rounded border p-3">
                        <div><div className="font-medium">{item.spec_name || `Spec ${item.spec_id}`}</div><div className="text-sm text-muted-foreground">Spec ID: {item.spec_id}</div></div>
                        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setSelectedSpec(item)}>View</Button><Button size="sm" variant="outline" onClick={() => setEditingSpec(item)}>Edit</Button><Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteSpecialization(item.spec_id)}>Delete</Button></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {active === 'Subjects' && (
                <div className="rounded-lg border bg-card p-4 text-foreground">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-2xl font-semibold">Subjects</h2>
                      <p className="text-sm text-muted-foreground">Institute: {session.institute || 'All'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => downloadCsv('subjects.csv', ['subject_code', 'subject_short_name', 'subject_full_name', 'semester', 'spec_id', 'sub_subject_codes'], visibleSubjects)}>Download CSV</Button>
                      <input id="upload-subjects-ce" type="file" accept=".csv" onChange={e => importFromCsvFile(e, importSubjectsCsv)} className="hidden" />
                      <Button variant="outline" size="sm" onClick={() => document.getElementById('upload-subjects-ce')?.click()}>Upload CSV</Button>
                      <Button size="sm" onClick={() => setEditingSubject({ subject_code: '', subject_short_name: '', subject_full_name: '', semester: undefined, spec_id: undefined, sub_subject_codes: '' })}>Add</Button>
                    </div>
                  </div>
                  <div className="mb-4 flex gap-2">
                    <input value={subjectSearch} onChange={e => setSubjectSearch(e.target.value)} placeholder="Search subjects..." className="flex-1 rounded border border-input bg-background px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    {visibleSubjects.length === 0 ? <p className="text-sm text-muted-foreground">No subject records found.</p> : visibleSubjects.map(item => (
                      <div key={item.subject_code} className="flex items-center justify-between rounded border p-3">
                        <div><div className="font-medium">{item.subject_code}</div><div className="text-sm text-muted-foreground">{item.subject_full_name || item.subject_short_name || 'Subject'} • Semester: {item.semester ?? '-'} • Spec ID: {item.spec_id ?? '-'}</div></div>
                        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setSelectedSubject(item)}>View</Button><Button size="sm" variant="outline" onClick={() => setEditingSubject(item)}>Edit</Button><Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteSubject(item.subject_code)}>Delete</Button></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {active === 'Credentials' && (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-card p-4 text-foreground">
                    <h2 className="text-2xl font-semibold">Create Credentials</h2>
                    <p className="text-sm text-muted-foreground">Generate login accounts for college admins and faculty members.</p>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3 rounded border p-4">
                        <h3 className="font-semibold">College Admin Credential</h3>
                        <select value={caCredential.user_name} onChange={e => setCaCredential(prev => ({ ...prev, user_name: e.target.value }))} className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                          <option value="">Select institute</option>
                          {availableInstitutesForCredential.map(item => (
                            <option key={item.inst_short_name} value={item.inst_short_name}>{item.inst_short_name} — {item.inst_full_name || 'Institute'}</option>
                          ))}
                        </select>
                        <input value={caCredential.password} onChange={e => setCaCredential(prev => ({ ...prev, password: e.target.value }))} type="password" placeholder="Password" className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                        <Button onClick={() => saveCredential('CA', caCredential)}>Create College Admin Credential</Button>
                      </div>

                      <div className="space-y-3 rounded border p-4">
                        <h3 className="font-semibold">Faculty Credential</h3>
                        <select value={facCredential.user_name} onChange={e => setFacCredential(prev => ({ ...prev, user_name: e.target.value }))} className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                          <option value="">Select faculty PAN</option>
                          {availableFacultyForCredential.map(f => (
                            <option key={f.PAN} value={f.PAN}>{f.faculty_name || f.PAN} — {f.PAN}</option>
                          ))}
                        </select>
                        <input value={facCredential.password} onChange={e => setFacCredential(prev => ({ ...prev, password: e.target.value }))} type="password" placeholder="Password" className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                        <Button onClick={() => saveCredential('FAC', facCredential)}>Create Faculty Credential</Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-card p-4 text-foreground">
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold">Existing Credentials</h3>
                      <select value={credentialFilter} onChange={e => setCredentialFilter(e.target.value as 'ALL' | 'CA' | 'FAC')} className="rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                        <option value="ALL">All</option>
                        <option value="CA">College Admin</option>
                        <option value="FAC">Faculty</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      {visibleUsers.length === 0 ? <p className="text-sm text-muted-foreground">No credentials created yet.</p> : visibleUsers.map(item => (
                        <div key={`${item.user_name}-${item.role}`} className="flex items-center justify-between rounded border p-3">
                          <div><div className="font-medium">{item.user_name}</div><div className="text-sm text-muted-foreground">{item.role === 'CA' ? 'College Admin' : 'Faculty'} role</div></div>
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteCredential(item.user_name, item.role)}>Revoke</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {selected && <FacultyDialog fac={selected} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null) }} subjects={subjects} courseSubjectMappings={courseSubjectMappings} facultySubjects={facultySubjects} facultySpecs={facultySpecs} specializations={specializations} />}
      {editing && <FacultyForm fac={editing} onClose={() => setEditing(null)} onSubmit={saveFaculty} role={session.role} />}
      {editingCourse && <CourseForm course={editingCourse} onClose={() => setEditingCourse(null)} onSubmit={saveCourse} />}
      {editingSpec && <SpecializationForm item={editingSpec} onClose={() => setEditingSpec(null)} onSubmit={saveSpecialization} />}
      {editingSubject && <SubjectForm item={editingSubject} onClose={() => setEditingSubject(null)} onSubmit={saveSubject} specializations={specializations} />}
      {showCourseDetails && <CourseDetailsModal details={courseDetails} onClose={() => { setShowCourseDetails(false); setCourseDetails(null) }} />}
      {showSubjectDetails && <SubjectDetailsModal details={subjectDetails} onClose={() => { setShowSubjectDetails(false); setSubjectDetails(null) }} />}
      {showInstituteDetails && <InstituteDetailsModal details={instituteDetails} onClose={() => { setShowInstituteDetails(false); setInstituteDetails(null) }} />}
      {showPasswordChange && (
        <PasswordChange
          token={token}
          userName={session.user_name}
          userRole={session.role}
          onClose={() => {
            setShowPasswordChange(false)
            setTimeout(() => signOut(), 1500)
          }}
        />
      )}

      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-2xl rounded-lg border bg-card p-6 shadow-lg">
            <form onSubmit={async (event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              const form = event.currentTarget
              const formData = new FormData(form)
              const courseCode = String(formData.get('course_code') ?? '')
              const subjectCode = String(formData.get('subject_code') ?? '')
              const studyYearRaw = formData.get('study_year')
              const semesterRaw = formData.get('semester')
              const instShortNames = Array.from(formData.getAll('inst_short_names')).map(value => String(value))
              const studyYear = studyYearRaw === null || studyYearRaw === '' ? null : Number(studyYearRaw)
              const semester = semesterRaw === null || semesterRaw === '' ? null : Number(semesterRaw)
              await saveCourseSubject({ course_code: courseCode, subject_code: subjectCode, study_year: studyYear, semester, inst_short_names: instShortNames })
            }}>
              <div className="mb-4 flex justify-between items-start">
                <h2 className="text-lg font-semibold text-foreground">{editingMapping ? 'Edit' : 'Add'} Course - Subject Mapping</h2>
                <button type="button" onClick={() => { setShowMappingModal(false); setEditingMapping(null) }} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="text-sm font-medium text-foreground">Course</span>
                  <select name="course_code" defaultValue={editingMapping?.course_code ?? ''} required disabled={Boolean(editingMapping)} className="mt-1 w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                    <option value="">Select course</option>
                    {courses.map(c => <option key={c.course_code} value={c.course_code}>{c.course_code} — {c.course_full_name || c.course_short_name}</option>)}
                  </select>
                  {editingMapping && <input type="hidden" name="course_code" value={editingMapping.course_code} />}
                </label>

                <label className="block"><span className="text-sm font-medium text-foreground">Subject</span>
                  <select name="subject_code" defaultValue={editingMapping?.subject_code ?? ''} required disabled={Boolean(editingMapping)} className="mt-1 w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                    <option value="">Select subject</option>
                    {subjects.map(s => <option key={s.subject_code} value={s.subject_code}>{s.subject_code} — {s.subject_full_name || s.subject_short_name}</option>)}
                  </select>
                  {editingMapping && <input type="hidden" name="subject_code" value={editingMapping.subject_code} />}
                </label>

                <label className="block"><span className="text-sm font-medium text-foreground">Study Year</span>
                  <select name="study_year" defaultValue={editingMapping?.study_year ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                    <option value="">Not Set</option>
                    <option value="1">1 (First Year)</option>
                    <option value="2">2 (Second Year)</option>
                    <option value="3">3 (Third Year)</option>
                    <option value="4">4 (Fourth Year)</option>
                  </select>
                </label>

                <label className="block"><span className="text-sm font-medium text-foreground">Semester</span>
                  <select name="semester" defaultValue={editingMapping?.semester ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                    <option value="">Not Set</option>
                    {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={String(n)}>{n}</option>)}
                  </select>
                </label>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">Associated College Details</span>
                  <input
                    type="search"
                    value={mappingCollegeSearch}
                    onChange={(event) => setMappingCollegeSearch(event.target.value)}
                    placeholder="Search colleges..."
                    className="w-48 rounded border border-input bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="mb-3 rounded border border-dashed bg-muted/30 p-3 text-xs text-foreground">
                  <div className="mb-1 font-medium text-foreground">Selected colleges</div>
                  <div className="text-muted-foreground">
                    {(editingMapping?.inst_short_names ?? []).length === 0 ? (
                      <span>No college selected yet.</span>
                    ) : (
                      <span>{(editingMapping?.inst_short_names ?? []).map((instShortName) => {
                        const inst = institutes.find(item => item.inst_short_name === instShortName)
                        return inst ? `${inst.inst_short_name} - ${inst.inst_full_name || 'College'}` : instShortName
                      }).join(', ')}</span>
                    )}
                  </div>
                </div>

                <div className="max-h-48 space-y-2 overflow-auto rounded border border-input bg-background p-2">
                  {(session?.role === 'CA' ? institutes.filter(item => item.inst_short_name === session.institute) : institutes)
                    .filter(item => `${item.inst_short_name} ${item.inst_full_name ?? ''}`.toLowerCase().includes(mappingCollegeSearch.toLowerCase()))
                    .length === 0 ? (
                    <div className="text-sm text-muted-foreground">No institutes available.</div>
                  ) : (session?.role === 'CA' ? institutes.filter(item => item.inst_short_name === session.institute) : institutes)
                    .filter(item => `${item.inst_short_name} ${item.inst_full_name ?? ''}`.toLowerCase().includes(mappingCollegeSearch.toLowerCase()))
                    .map((item) => {
                      const checked = (editingMapping?.inst_short_names ?? []).includes(item.inst_short_name)
                      return (
                        <label key={item.inst_short_name} data-institute-option data-label={`${item.inst_short_name} ${item.inst_full_name ?? ''}`} className="flex items-center gap-2 rounded border p-2 text-sm text-foreground">
                          <input type="checkbox" name="inst_short_names" value={item.inst_short_name} defaultChecked={checked} className="h-4 w-4" />
                          <span className="font-medium">{item.inst_short_name}</span>
                          <span className="text-muted-foreground">{item.inst_full_name || 'College details not available'}</span>
                        </label>
                      )
                    })}
                </div>
              </div>

              <div className="mt-5 flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => { setShowMappingModal(false); setEditingMapping(null) }}>Cancel</Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMappingDetails && mappingDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-3xl rounded-lg border bg-card p-6 shadow-lg overflow-auto max-h-[80vh]">
            <div className="mb-4 flex justify-between items-start">
              <h2 className="text-lg font-semibold text-foreground">Course - Subject Mapping Details</h2>
              <button onClick={() => { setShowMappingDetails(false); setMappingDetails(null) }} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">Course</h3>
                <div className="mt-2 rounded border p-2">
                  <div><strong>Code:</strong> {mappingDetails.course?.course_code ?? '-'}</div>
                  <div><strong>Short:</strong> {mappingDetails.course?.course_short_name ?? '-'}</div>
                  <div><strong>Full:</strong> {mappingDetails.course?.course_full_name ?? '-'}</div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Subject</h3>
                <div className="mt-2 rounded border p-2">
                  <div><strong>Code:</strong> {mappingDetails.subject?.subject_code ?? mappingDetails.mapping?.subject_code ?? '-'}</div>
                  <div><strong>Short:</strong> {mappingDetails.subject?.subject_short_name ?? mappingDetails.mapping?.subject?.subject_short_name ?? '-'}</div>
                  <div><strong>Full:</strong> {mappingDetails.subject?.subject_full_name ?? mappingDetails.mapping?.subject?.subject_full_name ?? '-'}</div>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-semibold">Academic Placement</h3>
              <div className="mt-2 rounded border p-2">Study Year: {mappingDetails.mapping?.study_year ?? 'Not Set'} • Semester: {mappingDetails.mapping?.semester ?? 'Not Set'}</div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">Institutes Offering this Course</h3>
                <div className="mt-2 space-y-2">
                  {(mappingDetails.institutes ?? []).length === 0 ? <div className="text-sm text-muted-foreground">No data available</div> : (mappingDetails.institutes ?? []).map((i: any) => (
                    <div key={i.inst_short_name ?? i.institute?.inst_short_name ?? `${i.inst_short_name}-${i.inst_full_name}`} className="rounded border p-2">{i.inst_short_name ?? i.institute?.inst_short_name} — {i.inst_full_name ?? i.institute?.inst_full_name ?? '-'}</div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Faculty Associated</h3>
                <div className="mt-2 space-y-2">
                  {(() => {
                    const rows = (mappingDetails.faculty ?? []).filter((f: any) => {
                      const subjectCode = mappingDetails.mapping?.subject_code ?? mappingDetails.mapping?.subject?.subject_code ?? mappingDetails.subject?.subject_code
                      const subjectList = Array.isArray(f.subjects) ? f.subjects : []
                      if (subjectList.length === 0) return true
                      return subjectList.some((item: any) => {
                        const itemCode = String(item.subject_code ?? item.subject?.subject_code ?? '')
                        return itemCode === subjectCode
                      })
                    })
                    return rows.length === 0 ? <div className="text-sm text-muted-foreground">No data available</div> : rows.map((f: any) => (
                      <div key={f.PAN} className="rounded border p-2">{f.faculty_name || f.PAN} — {f.PAN} — {f.inst_short_name || '-'} — {f.faculty_desig ?? '-'}</div>
                    ))
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase()
}

function matchesSearch<T extends Record<string, any>>(row: T, value: string, fields: Array<keyof T | string>) {
  const normalized = normalizeSearchValue(value)
  if (!normalized) return true

  return fields.some((field) => {
    const fieldValue = row[field as keyof T]
    return String(fieldValue ?? '').toLowerCase().includes(normalized)
  })
}
