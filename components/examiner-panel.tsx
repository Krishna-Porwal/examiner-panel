'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { BookOpen, Building2, ClipboardList, Download, LogOut, Menu, Plus, ShieldCheck, UserRound, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Role = 'CE' | 'CA' | 'FAC'
type Session = { userName: string; role: Role; institute?: string }
type Faculty = { PAN: string; Title?: string; faculty_name?: string; inst_short_name?: string; faculty_desig?: string; faculty_total_exp?: number; faculty_address?: string; faculty_Email?: string; faculty_MobileNo?: string; entered_by?: string; entered_on?: string }
type Institute = { inst_short_name: string; inst_full_name?: string; inst_Address1?: string; inst_Address2?: string; inst_District?: string; inst_State?: string; Landline_PhoneNo?: string; Director_Name?: string; Director_Desig?: string; Director_Email?: string; Director_MobileNo?: string; ExamHead_Name?: string; ExamHead_Desig?: string; ExamHead_Email?: string; ExamHead_MobileNo?: string }
type Course = { course_code: string; course_short_name?: string; course_full_name?: string }
type Subject = { subject_code: string; subject_short_name?: string; subject_full_name?: string; semester?: number; spec_id?: number; sub_subject_codes?: string }
type Specialization = { spec_id: number; spec_name?: string }
type FacultySubjectMap = { PAN: string; subject_code: string; entered_by?: string; entered_on?: string }
type FacultySpecMap = { PAN: string; spec_id: number; entered_by?: string; entered_on?: string }
type InstCourseMap = { inst_short_name: string; course_code: string; intake?: number; strength?: number }
type CourseSubjectMap = { course_code: string; subject_code: string }

type UserPayload = { user_name: string; password: string; role: 'CA' | 'FAC' }

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
const demoCredentials = [['Central Examiner', 'CENTRAL', 'change-me'], ['College Admin', 'NIT', 'college123'], ['Faculty', 'ABCDE1234F', 'faculty123']] as const
const roleLabels: Record<Role, string> = { CE: 'Central Examiner', CA: 'College Admin', FAC: 'Faculty' }
const navFor: Record<Role, string[]> = { CE: ['Overview', 'Institutes', 'Courses', 'Specializations', 'Subjects', 'Faculty'], CA: ['My College', 'Faculty'], FAC: ['My Profile', 'My Subjects', 'My Specializations'] }
const IPU_ENGINEERING_COURSE_CODES = new Set(['BTE', 'MTE', 'CSE', 'ECE', 'EEE', 'ME', 'CE', 'IT', 'CHE', 'EIE'])
const NON_ENGINEERING_COURSE_TOKENS = ['bba', 'mba', 'bca', 'ba', 'b.com', 'law', 'pharmacy', 'medical', 'mbbs', 'commerce', 'management']

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

function FacultyDialog({ fac, onClose, onEdit }: any) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"><div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg"><div className="mb-4 flex justify-between items-start"><h2 className="text-lg font-semibold text-foreground">{fac?.faculty_name || 'Faculty'}</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button></div><div className="space-y-2 text-sm mb-4 text-foreground"><div><strong>PAN:</strong> {fac?.PAN}</div><div><strong>Email:</strong> {fac?.faculty_Email}</div><div><strong>Designation:</strong> {fac?.faculty_desig}</div><div><strong>Institute:</strong> {fac?.inst_short_name}</div><div><strong>Experience:</strong> {fac?.faculty_total_exp ?? '-'} years</div><div><strong>Mobile:</strong> {fac?.faculty_MobileNo ?? '-'}</div></div><div className="flex gap-2 justify-end"><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={onEdit}>Edit</Button></div></div></div>
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
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"><form onSubmit={onSubmit} className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg"><div className="mb-4 flex justify-between items-start"><h2 className="text-lg font-semibold text-foreground">{course?.course_code ? 'Edit' : 'Add'} Course</h2><button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button></div><div className="space-y-3 mb-4"><label className="block"><span className="text-sm font-medium text-foreground">Course Code</span><input name="course_code" defaultValue={course?.course_code ?? ''} required readOnly={Boolean(course?.course_code)} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70" /></label><label className="block"><span className="text-sm font-medium text-foreground">Course Short Name</span><input name="course_short_name" defaultValue={course?.course_short_name ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label><label className="block"><span className="text-sm font-medium text-foreground">Course Full Name</span><input name="course_full_name" defaultValue={course?.course_full_name ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label></div><div className="flex gap-2 justify-end"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></div></form></div>
}

function SpecializationForm({ item, onClose, onSubmit }: any) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"><form onSubmit={onSubmit} className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg"><div className="mb-4 flex justify-between items-start"><h2 className="text-lg font-semibold text-foreground">{item?.spec_id ? 'Edit' : 'Add'} Specialization</h2><button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button></div><div className="space-y-3 mb-4"><label className="block"><span className="text-sm font-medium text-foreground">spec_id</span><input name="spec_id" type="number" defaultValue={item?.spec_id ?? ''} required readOnly={Boolean(item?.spec_id)} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70" /></label><label className="block"><span className="text-sm font-medium text-foreground">spec_name</span><input name="spec_name" defaultValue={item?.spec_name ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label></div><div className="flex gap-2 justify-end"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></div></form></div>
}

function SubjectForm({ item, onClose, onSubmit, specializations }: any) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"><form onSubmit={onSubmit} className="w-full max-w-xl rounded-lg border bg-card p-6 shadow-lg"><div className="mb-4 flex justify-between items-start"><h2 className="text-lg font-semibold text-foreground">{item?.subject_code ? 'Edit' : 'Add'} Subject</h2><button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button></div><div className="grid gap-3 md:grid-cols-2 mb-4"><label className="block"><span className="text-sm font-medium text-foreground">Subject Code</span><input name="subject_code" defaultValue={item?.subject_code ?? ''} required readOnly={Boolean(item?.subject_code)} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70" /></label><label className="block"><span className="text-sm font-medium text-foreground">Sub Subject Codes</span><input name="sub_subject_codes" defaultValue={item?.sub_subject_codes ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label><label className="block"><span className="text-sm font-medium text-foreground">Short Name</span><input name="subject_short_name" defaultValue={item?.subject_short_name ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label><label className="block"><span className="text-sm font-medium text-foreground">Full Name</span><input name="subject_full_name" defaultValue={item?.subject_full_name ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label><label className="block"><span className="text-sm font-medium text-foreground">Semester</span><input name="semester" type="number" defaultValue={item?.semester ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label><label className="block"><span className="text-sm font-medium text-foreground">Specialization</span><select name="spec_id" defaultValue={item?.spec_id ?? ''} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground"><option value="">Select specialization</option>{specializations.map((s: Specialization) => <option key={s.spec_id} value={String(s.spec_id)}>{s.spec_name || s.spec_id}</option>)}</select></label></div><div className="flex gap-2 justify-end"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></div></form></div>
}

export default function ExaminerPanel() {
  const [session, setSession] = useState<Session | null>(null)
  const [login, setLogin] = useState({ user_name: '', role: 'CA' as Role, password: '' })
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
  const [selected, setSelected] = useState<Faculty | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Faculty | null>(null)
  const [editingInst, setEditingInst] = useState<Institute | null>(null)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [editingSpec, setEditingSpec] = useState<Specialization | null>(null)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [caCredential, setCaCredential] = useState<UserPayload>({ user_name: '', password: '', role: 'CA' })
  const [facCredential, setFacCredential] = useState<UserPayload>({ user_name: '', password: '', role: 'FAC' })

  const sessionToken = () => typeof window === 'undefined' ? '' : sessionStorage.getItem('examiner-token') ?? ''

  const request = async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${sessionToken()}` } : {}),
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
    const raw = typeof window !== 'undefined' ? sessionStorage.getItem('examiner-session') : null
    if (raw) setSession(JSON.parse(raw))
  }, [])

  useEffect(() => {
    if (!session) return
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
      setFaculty(Array.isArray(facultyRows) ? facultyRows : [])
      setInstitutes(Array.isArray(instituteRows) ? instituteRows : [])
      setCourses(Array.isArray(courseRows) ? courseRows : [])
      setSubjects(Array.isArray(subjectRows) ? subjectRows : [])
      setSpecializations(Array.isArray(specRows) ? specRows : [])
      setFacultySubjects(Array.isArray(facultySubjectRows) ? facultySubjectRows : [])
      setFacultySpecs(Array.isArray(facultySpecRows) ? facultySpecRows : [])
      setInstCourseMappings(Array.isArray(instCourseRows) ? instCourseRows : [])
      setCourseSubjectMappings(Array.isArray(courseSubjectRows) ? courseSubjectRows : [])
      if (session?.role === 'CA' && institutes.length === 0 && instituteRows?.length) {
        setCaCredential((prev) => ({ ...prev, user_name: instituteRows[0]?.inst_short_name ?? '' }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    }
  }

  const filtered = useMemo(
    () => faculty.filter(row => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(query.toLowerCase()))),
    [faculty, query]
  )

  const mySubjects = facultySubjects.filter(item => item.PAN === session?.userName)
  const mySpecializations = facultySpecs.filter(item => item.PAN === session?.userName)
  const ownInstituteFaculty = faculty.filter(row => row.inst_short_name === session?.institute)

  async function signIn(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...login, user_name: login.user_name.trim().toUpperCase() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Unable to sign in')
      sessionStorage.setItem('examiner-token', data.token)
      const nextSession = { userName: data.user.user_name, role: data.user.role as Role, institute: data.user.institute }
      sessionStorage.setItem('examiner-session', JSON.stringify(nextSession))
      setSession(nextSession)
      setActive(nextSession.role === 'FAC' ? 'My Profile' : 'Overview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in')
    } finally {
      setBusy(false)
    }
  }

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

  async function saveInstitute(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingInst) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = sanitizeFormPayload(e.currentTarget)
      const isCreate = !editingInst.inst_short_name
      if (isCreate && (!payload.inst_short_name || String(payload.inst_short_name).trim().length === 0)) {
        throw new Error('Institute short name is required.')
      }
      const saved = await request(isCreate ? '/api/institutes' : `/api/institutes/${encodeURIComponent(editingInst.inst_short_name)}`, {
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
      const courseShortName = typeof payload.course_short_name === 'string' ? payload.course_short_name : undefined
      const courseFullName = typeof payload.course_full_name === 'string' ? payload.course_full_name : undefined
      validateEngineeringCourse(courseCode, courseFullName, courseShortName)
      const isCreate = !editingCourse || !editingCourse.course_code
      const saved = await request(isCreate ? '/api/courses' : `/api/courses/${encodeURIComponent(editingCourse!.course_code)}`, {
        method: isCreate ? 'POST' : 'PUT',
        body: JSON.stringify({ ...payload, course_code: courseCode }),
      })
      setCourses(rows => (isCreate ? [...rows, saved] : rows.map(row => (row.course_code === saved.course_code ? saved : row))))
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
      setSpecializations(rows => (isCreate ? [...rows, saved] : rows.map(row => (row.spec_id === saved.spec_id ? saved : row))))
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
      setSubjects(rows => (isCreate ? [...rows, saved] : rows.map(row => (row.subject_code === saved.subject_code ? saved : row))))
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
        body: JSON.stringify({ PAN: session.userName, subject_code: subjectCode }),
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
      await request(`/api/faculty-subjects/${encodeURIComponent(session.userName)}/${encodeURIComponent(subjectCode)}`, { method: 'DELETE' })
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
        body: JSON.stringify({ PAN: session.userName, spec_id: Number(specId) }),
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
      await request(`/api/faculty-specializations/${encodeURIComponent(session.userName)}/${encodeURIComponent(String(specId))}`, { method: 'DELETE' })
      setNotice('Specialization removed.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to remove specialization')
    } finally {
      setBusy(false)
    }
  }

  async function saveCredential(type: 'CA' | 'FAC', payload: UserPayload) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const body = { user_name: payload.user_name.trim().toUpperCase(), role: type, password: payload.password }
      await request('/api/users', { method: 'POST', body: JSON.stringify(body) })
      setNotice(`${type === 'CA' ? 'College Admin' : 'Faculty'} credential created successfully.`)
      setCaCredential({ user_name: '', password: '', role: 'CA' })
      setFacCredential({ user_name: '', password: '', role: 'FAC' })
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create credential')
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

  async function saveCourseSubject(req: { course_code: string; subject_code: string }) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request('/api/course-subjects', {
        method: 'POST',
        body: JSON.stringify({ course_code: req.course_code, subject_code: req.subject_code }),
      })
      setNotice('Course-subject mapping created.')
      await loadData()
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
    sessionStorage.clear()
    setSession(null)
    setFaculty([])
  }

  if (!session)
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-5">
        <div className="grid w-full max-w-4xl gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <form onSubmit={signIn} className="w-full rounded-2xl border border-border bg-card p-7 shadow-sm">
            <div className="mb-7 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck /></div>
              <div>
                <p className="font-semibold text-foreground">Examiner Panel</p>
                <p className="text-sm text-muted-foreground">Secure academic administration</p>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
                Username
                <input required maxLength={10} value={login.user_name} onChange={e => setLogin({ ...login, user_name: e.target.value })} className="h-10 rounded-lg border border-input bg-background px-3 font-normal text-foreground placeholder:text-muted-foreground" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
                Role
                <select value={login.role} onChange={e => setLogin({ ...login, role: e.target.value as Role })} className="h-10 rounded-lg border border-input bg-background px-3 font-normal text-foreground">
                  <option value="CA">College Admin</option>
                  <option value="FAC">Faculty</option>
                  <option value="CE">Central Examiner</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
                Password
                <input required type="password" value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} className="h-10 rounded-lg border border-input bg-background px-3 font-normal text-foreground placeholder:text-muted-foreground" />
              </label>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
            </div>
          </form>

          <section className="rounded-2xl border border-border bg-card p-7">
            <p className="text-sm font-medium text-primary">Demo access</p>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">Use a seeded account</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose a role and copy credentials.</p>
            <div className="mt-6 flex flex-col gap-3">
              {demoCredentials.map(([label, username, password]) => (
                <button
                  type="button"
                  key={username}
                  onClick={() => setLogin({ user_name: username, role: label === 'Central Examiner' ? 'CE' : label === 'College Admin' ? 'CA' : 'FAC', password })}
                  className="rounded-xl border border-border bg-background p-4 text-left text-foreground transition-colors hover:bg-muted"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground">{label}</span>
                    <span className="text-xs text-primary">Use</span>
                  </div>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">{username} / {password}</p>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    )

  const isFaculty = session.role === 'FAC'
  const profile = isFaculty ? faculty.find(row => row.PAN === session.userName) : null

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></div>
          <div>
            <p className="font-semibold text-sidebar-foreground">Examiner</p>
            <p className="text-xs text-sidebar-foreground/80">{roleLabels[session.role]}</p>
          </div>
          <button className="ml-auto lg:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)}><X /></button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {navFor[session.role].map(item => (
            <button
              key={item}
              onClick={() => { setActive(item); setSidebarOpen(false) }}
              className={`rounded-lg px-3 py-2.5 text-left text-sm ${active === item ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'}`}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg p-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground">
            <LogOut className="size-4" />
            Sign out
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

          {isFaculty ? (
            <div>
              {active === 'My Profile' && (
                <div className="rounded-lg border bg-card p-4 text-foreground">
                  {profile ? (
                    <>
                      <div className="mb-4 flex justify-between">
                        <div>
                          <div className="font-semibold text-foreground">{profile.Title} {profile.faculty_name}</div>
                          <div className="text-sm text-muted-foreground">PAN: {profile.PAN}</div>
                        </div>
                        <Button onClick={() => setEditing(profile)} size="sm">Edit</Button>
                      </div>
                      <div className="grid gap-3 text-sm md:grid-cols-2">
                        <div><strong>Email:</strong> {profile.faculty_Email || '-'}</div>
                        <div><strong>Institute:</strong> {profile.inst_short_name || '-'}</div>
                        <div><strong>Designation:</strong> {profile.faculty_desig || '-'}</div>
                        <div><strong>Experience:</strong> {profile.faculty_total_exp ?? '-'} years</div>
                        <div className="md:col-span-2"><strong>Address:</strong> {profile.faculty_address || '-'}</div>
                        <div><strong>Mobile:</strong> {profile.faculty_MobileNo || '-'}</div>
                      </div>
                    </>
                  ) : (
                    <p className="text-foreground">No profile</p>
                  )}
                </div>
              )}

              {active === 'My Subjects' && (
                <div className="rounded-lg border bg-card p-4 text-foreground">
                  <div className="mb-4 flex gap-2">
                    <select id="faculty-subject-select" className="flex-1 rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                      <option value="">Select a subject</option>
                      {subjects.filter(item => !mySubjects.some(m => m.subject_code === item.subject_code)).map(item => (
                        <option key={item.subject_code} value={item.subject_code}>{item.subject_code} - {item.subject_full_name || item.subject_short_name || ''}</option>
                      ))}
                    </select>
                    <Button onClick={addFacultySubject}>Add Subject</Button>
                  </div>
                  <div className="space-y-2">
                    {mySubjects.length === 0 ? <p className="text-sm text-muted-foreground">No subject assignments yet.</p> : mySubjects.map(item => {
                      const subject = subjects.find(s => s.subject_code === item.subject_code)
                      return <div key={`${item.PAN}-${item.subject_code}`} className="flex items-center justify-between rounded border p-3">
                        <div>
                          <div className="font-medium">{item.subject_code}</div>
                          <div className="text-sm text-muted-foreground">{subject?.subject_full_name || subject?.subject_short_name || 'Subject record'}</div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => removeFacultySubject(item.subject_code)}>Remove</Button>
                      </div>
                    })}
                  </div>
                </div>
              )}

              {active === 'My Specializations' && (
                <div className="rounded-lg border bg-card p-4 text-foreground">
                  <div className="mb-4 flex gap-2">
                    <select id="faculty-spec-select" className="flex-1 rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                      <option value="">Select a specialization</option>
                      {specializations.filter(item => !mySpecializations.some(m => m.spec_id === item.spec_id)).map(item => (
                        <option key={item.spec_id} value={String(item.spec_id)}>{item.spec_id} - {item.spec_name || 'Specialization'}</option>
                      ))}
                    </select>
                    <Button onClick={addFacultySpec}>Add</Button>
                  </div>
                  <div className="space-y-2">
                    {mySpecializations.length === 0 ? <p className="text-sm text-muted-foreground">No specialization assignments yet.</p> : mySpecializations.map(item => {
                      const spec = specializations.find(s => s.spec_id === item.spec_id)
                      return <div key={`${item.PAN}-${item.spec_id}`} className="flex items-center justify-between rounded border p-3">
                        <div>
                          <div className="font-medium">{spec?.spec_name || `Spec ${item.spec_id}`}</div>
                          <div className="text-sm text-muted-foreground">SPEC ID: {item.spec_id}</div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => removeFacultySpec(item.spec_id)}>Remove</Button>
                      </div>
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : session.role === 'CA' ? (
            <div>
              {active === 'My College' && (
                <div className="rounded-lg border bg-card p-4 mb-4 text-foreground">
                  {institutes[0] ? (
                    <>
                      <div className="mb-4 flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-foreground">{institutes[0].inst_full_name}</div>
                          <div className="text-sm text-muted-foreground">{institutes[0].inst_short_name}</div>
                        </div>
                        <Button onClick={() => setEditingInst(institutes[0])}>Edit</Button>
                      </div>
                      <div className="grid gap-3 text-sm md:grid-cols-2">
                        <div><strong>Address 1:</strong> {institutes[0].inst_Address1 || '-'}</div>
                        <div><strong>Address 2:</strong> {institutes[0].inst_Address2 || '-'}</div>
                        <div><strong>District:</strong> {institutes[0].inst_District || '-'}</div>
                        <div><strong>State:</strong> {institutes[0].inst_State || '-'}</div>
                        <div><strong>Landline:</strong> {institutes[0].Landline_PhoneNo || '-'}</div>
                        <div><strong>Director:</strong> {institutes[0].Director_Name || '-'}</div>
                        <div><strong>Director Designation:</strong> {institutes[0].Director_Desig || '-'}</div>
                        <div><strong>Director Email:</strong> {institutes[0].Director_Email || '-'}</div>
                        <div><strong>Director Mobile:</strong> {institutes[0].Director_MobileNo || '-'}</div>
                        <div><strong>Exam Head:</strong> {institutes[0].ExamHead_Name || '-'}</div>
                        <div><strong>Exam Head Designation:</strong> {institutes[0].ExamHead_Desig || '-'}</div>
                        <div><strong>Exam Head Email:</strong> {institutes[0].ExamHead_Email || '-'}</div>
                        <div><strong>Exam Head Mobile:</strong> {institutes[0].ExamHead_MobileNo || '-'}</div>
                      </div>
                    </>
                  ) : <p>No institute assigned.</p>}
                </div>
              )}

              {active === 'Faculty' && (
                <div className="space-y-4">
                  <FacultyListTable fac={filtered} q={query} setQ={setQuery} onSel={setSelected} onExp={() => window.open(`${API}/api/faculty-export?token=${sessionToken()}`, '_blank')} onAdd={() => setEditing({ PAN: '', inst_short_name: session.institute ?? '' })} onCreateCredential={() => {}} canCreateCredential={false} canDelete={session?.role === 'CE'} onDelete={deleteFaculty} />

                  <div className="rounded-lg border bg-card p-4">
                    <h3 className="mb-3 text-lg font-semibold text-foreground">Create Faculty Credential</h3>
                    <div className="flex flex-col gap-3 md:flex-row">
                      <select
                        value={facCredential.user_name}
                        onChange={e => setFacCredential({ ...facCredential, user_name: e.target.value })}
                        className="flex-1 rounded border border-input bg-background px-2 py-2 text-sm text-foreground"
                      >
                        <option value="">Select Faculty PAN</option>
                        {faculty.map(f => <option key={f.PAN} value={f.PAN}>{f.PAN} - {f.faculty_name || 'Faculty'}</option>)}
                      </select>
                      <input
                        value={facCredential.password}
                        onChange={e => setFacCredential({ ...facCredential, password: e.target.value })}
                        placeholder="Password"
                        type="password"
                        className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground md:max-w-48"
                      />
                      <Button onClick={() => saveCredential('FAC', facCredential)} disabled={!facCredential.user_name || facCredential.password.length < 8}>Create</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              {active === 'Overview' && (
                <div className="grid gap-4 sm:grid-cols-4">
                  <Stat label="Institutes" value={institutes.length} icon={Building2} />
                  <Stat label="Courses" value={courses.length} icon={BookOpen} />
                  <Stat label="Subjects" value={subjects.length} icon={ClipboardList} />
                  <Stat label="Faculty" value={faculty.length} icon={Users} />
                </div>
              )}

              {active === 'Institutes' && (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-card p-4 text-foreground">
                    <Button onClick={() => setEditingInst({ inst_short_name: '' })} className="mb-4"><Plus className="size-4" />Add Institute</Button>
                    <div className="space-y-2">
                      {institutes.map(i => (
                        <div key={i.inst_short_name} className="flex items-center justify-between border-b border-border p-2">
                          <div>
                            <div className="font-mono text-sm text-foreground">{i.inst_short_name}</div>
                            <div className="text-sm text-muted-foreground">{i.inst_full_name}</div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditingInst(i)}>Edit</Button>
                            <Button variant="outline" size="sm" onClick={() => setCaCredential({ ...caCredential, user_name: i.inst_short_name })}>CA Credential</Button>
                            {session?.role === 'CE' && <Button variant="outline" size="sm" className="text-red-600" onClick={() => deleteInstitute(i.inst_short_name)}>Delete</Button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-card p-4 text-foreground">
                    <h3 className="mb-3 text-lg font-semibold text-foreground">Create College Admin Credential</h3>
                    <div className="flex flex-col gap-3 md:flex-row">
                      <select
                        value={caCredential.user_name}
                        onChange={e => setCaCredential({ ...caCredential, user_name: e.target.value })}
                        className="flex-1 rounded border border-input bg-background px-2 py-2 text-sm text-foreground"
                      >
                        <option value="">Select institute</option>
                        {institutes.map(i => <option key={i.inst_short_name} value={i.inst_short_name}>{i.inst_short_name} - {i.inst_full_name}</option>)}
                      </select>
                      <input
                        value={caCredential.password}
                        onChange={e => setCaCredential({ ...caCredential, password: e.target.value })}
                        placeholder="Password"
                        type="password"
                        className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground md:max-w-48"
                      />
                      <Button onClick={() => saveCredential('CA', caCredential)} disabled={!caCredential.user_name || caCredential.password.length < 8}>Create</Button>
                    </div>
                  </div>
                </div>
              )}

              {active === 'Courses' && (
                <div className="rounded-lg border bg-card p-4 text-foreground">
                  <Button onClick={() => setEditingCourse({ course_code: '', course_short_name: '', course_full_name: '' })} className="mb-4"><Plus className="size-4" />Add Course</Button>
                  <div className="space-y-2">
                    {courses.map(c => (
                      <div key={c.course_code} className="flex items-center justify-between border-b border-border p-2">
                        <div>
                          <div className="font-mono text-sm text-foreground">{c.course_code}</div>
                          <div className="text-sm text-muted-foreground">{c.course_full_name}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingCourse(c)}>Edit</Button>
                          <Button variant="outline" size="sm" onClick={() => deleteCourse(c.course_code)}>Delete</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {active === 'Specializations' && (
                <div className="rounded-lg border bg-card p-4 text-foreground">
                  <Button onClick={() => setEditingSpec({ spec_id: 0, spec_name: '' })} className="mb-4"><Plus className="size-4" />Add Specialization</Button>
                  <div className="space-y-2">
                    {specializations.map(s => (
                      <div key={s.spec_id} className="flex items-center justify-between border-b border-border p-2">
                        <div>
                          <div className="font-mono text-sm text-foreground">{s.spec_id}</div>
                          <div className="text-sm text-muted-foreground">{s.spec_name}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingSpec(s)}>Edit</Button>
                          <Button variant="outline" size="sm" onClick={() => deleteSpecialization(s.spec_id)}>Delete</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {active === 'Subjects' && (
                <div className="rounded-lg border bg-card p-4 text-foreground">
                  <Button onClick={() => setEditingSubject({ subject_code: '', subject_short_name: '', subject_full_name: '', semester: undefined, spec_id: undefined })} className="mb-4"><Plus className="size-4" />Add Subject</Button>
                  <div className="space-y-2">
                    {subjects.map(s => (
                      <div key={s.subject_code} className="flex items-center justify-between border-b border-border p-2">
                        <div>
                          <div className="font-mono text-sm text-foreground">{s.subject_code}</div>
                          <div className="text-sm text-muted-foreground">{s.subject_full_name}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingSubject(s)}>Edit</Button>
                          <Button variant="outline" size="sm" onClick={() => deleteSubject(s.subject_code)}>Delete</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {active === 'Faculty' && (
                <div className="space-y-4">
                  <FacultyListTable fac={filtered} q={query} setQ={setQuery} onSel={setSelected} onExp={() => window.open(`${API}/api/faculty-export?token=${sessionToken()}`, '_blank')} onAdd={() => setEditing({ PAN: '', inst_short_name: '' })} onCreateCredential={() => {}} canCreateCredential={false} />

                  <div className="rounded-lg border bg-card p-4">
                    <h3 className="mb-3 text-lg font-semibold text-foreground">Create Faculty Credential</h3>
                    <div className="flex flex-col gap-3 md:flex-row">
                      <select
                        value={facCredential.user_name}
                        onChange={e => setFacCredential({ ...facCredential, user_name: e.target.value })}
                        className="flex-1 rounded border border-input bg-background px-2 py-2 text-sm text-foreground"
                      >
                        <option value="">Select Faculty PAN</option>
                        {faculty.map(f => <option key={f.PAN} value={f.PAN}>{f.PAN} - {f.faculty_name || 'Faculty'}</option>)}
                      </select>
                      <input
                        value={facCredential.password}
                        onChange={e => setFacCredential({ ...facCredential, password: e.target.value })}
                        placeholder="Password"
                        type="password"
                        className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground md:max-w-48"
                      />
                      <Button onClick={() => saveCredential('FAC', facCredential)} disabled={!facCredential.user_name || facCredential.password.length < 8}>Create</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {session.role !== 'FAC' && (
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border bg-card p-4 text-foreground">
                <h3 className="mb-3 text-lg font-semibold text-foreground">Institute-Course Mapping</h3>
                <div className="space-y-3">
                  <select id="inst-course-institute" className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                    <option value="">Select Institute</option>
                    {institutes.map(i => <option key={i.inst_short_name} value={i.inst_short_name}>{i.inst_short_name}</option>)}
                  </select>
                  <select id="inst-course-course" className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                    <option value="">Select Course</option>
                    {courses.map(c => <option key={c.course_code} value={c.course_code}>{c.course_code}</option>)}
                  </select>
                  <input id="inst-course-intake" type="number" placeholder="Intake" className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground" />
                  <input id="inst-course-strength" type="number" placeholder="Strength" className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground" />
                  <Button onClick={() => {
                    const inst = (document.getElementById('inst-course-institute') as HTMLSelectElement | null)?.value ?? ''
                    const course = (document.getElementById('inst-course-course') as HTMLSelectElement | null)?.value ?? ''
                    const intake = (document.getElementById('inst-course-intake') as HTMLInputElement | null)?.value ?? ''
                    const strength = (document.getElementById('inst-course-strength') as HTMLInputElement | null)?.value ?? ''
                    if (!inst || !course) return
                    saveInstCourse({ inst_short_name: inst, course_code: course, intake, strength })
                  }}>Create Mapping</Button>
                </div>
                <div className="mt-4 space-y-2">
                  {instCourseMappings.map(item => (
                    <div key={`${item.inst_short_name}-${item.course_code}`} className="flex items-center justify-between rounded border p-2">
                      <div className="text-sm">
                        <div className="font-medium">{item.inst_short_name} / {item.course_code}</div>
                        <div className="text-muted-foreground">Intake: {item.intake ?? '-'} | Strength: {item.strength ?? '-'}</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => deleteInstCourse(item.inst_short_name, item.course_code)}>Remove</Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4 text-foreground">
                <h3 className="mb-3 text-lg font-semibold text-foreground">Course-Subject Mapping</h3>
                <div className="space-y-3">
                  <select id="course-subject-course" className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                    <option value="">Select Course</option>
                    {courses.map(c => <option key={c.course_code} value={c.course_code}>{c.course_code}</option>)}
                  </select>
                  <select id="course-subject-subject" className="w-full rounded border border-input bg-background px-2 py-2 text-sm text-foreground">
                    <option value="">Select Subject</option>
                    {subjects.map(s => <option key={s.subject_code} value={s.subject_code}>{s.subject_code}</option>)}
                  </select>
                  <Button onClick={() => {
                    const course = (document.getElementById('course-subject-course') as HTMLSelectElement | null)?.value ?? ''
                    const subject = (document.getElementById('course-subject-subject') as HTMLSelectElement | null)?.value ?? ''
                    if (!course || !subject) return
                    saveCourseSubject({ course_code: course, subject_code: subject })
                  }}>Create Mapping</Button>
                </div>
                <div className="mt-4 space-y-2">
                  {courseSubjectMappings.map(item => (
                    <div key={`${item.course_code}-${item.subject_code}`} className="flex items-center justify-between rounded border p-2">
                      <div className="text-sm"><span className="font-medium">{item.course_code}</span> / {item.subject_code}</div>
                      <Button variant="outline" size="sm" onClick={() => deleteCourseSubject(item.course_code, item.subject_code)}>Remove</Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {selected && <FacultyDialog fac={selected} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null) }} />}
      {editing && <FacultyForm fac={editing} onClose={() => setEditing(null)} onSubmit={saveFaculty} role={session.role} />}
      {editingInst && <InstituteForm inst={editingInst} onClose={() => setEditingInst(null)} onSubmit={saveInstitute} role={session.role} />}
      {editingCourse && <CourseForm course={editingCourse} onClose={() => setEditingCourse(null)} onSubmit={saveCourse} />}
      {editingSpec && <SpecializationForm item={editingSpec} onClose={() => setEditingSpec(null)} onSubmit={saveSpecialization} />}
      {editingSubject && <SubjectForm item={editingSubject} onClose={() => setEditingSubject(null)} onSubmit={saveSubject} specializations={specializations} />}
    </div>
  )
}

function validateEngineeringCourse(courseCode: string, courseFullName?: string, courseShortName?: string) {
  const normalizedCode = String(courseCode ?? '').trim().toUpperCase()
  const normalizedName = String(courseFullName ?? courseShortName ?? '').trim().toLowerCase()
  if (!normalizedCode || !IPU_ENGINEERING_COURSE_CODES.has(normalizedCode)) {
    throw new Error('Only IPU engineering course codes are supported (BTE, MTE, CSE, ECE, EEE, ME, CE, IT, CHE, EIE).')
  }
  if (normalizedName && NON_ENGINEERING_COURSE_TOKENS.some(token => normalizedName.includes(token))) {
    throw new Error('Only engineering courses are supported for this IPU engineering system.')
  }
}
