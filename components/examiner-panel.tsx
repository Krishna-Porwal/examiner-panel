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

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
const demoCredentials = [['Central Examiner', 'CENTRAL', 'change-me'], ['College Admin', 'NIT', 'college123'], ['Faculty', 'ABCDE1234F', 'faculty123']] as const
const roleLabels: Record<Role, string> = { CE: 'Central Examiner', CA: 'College Admin', FAC: 'Faculty' }
const navFor: Record<Role, string[]> = { CE: ['Overview', 'Institutes', 'Courses', 'Specializations', 'Subjects', 'Faculty'], CA: ['My College', 'Faculty'], FAC: ['My Profile', 'My Subjects', 'My Specializations'] }

function ErrorAlert({ msg }: { msg: string }) {
  return msg ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{msg}</div> : null
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

function FacultyListTable({ fac, q, setQ, onSel, onExp, onAdd }: any) {
  return <div className="rounded-lg border bg-card"><div className="border-b p-4 flex gap-2"><input placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /><Button variant="outline" size="sm" onClick={onExp}><Download className="size-4" />CSV</Button><Button size="sm" onClick={onAdd}><Plus className="size-4" />Add</Button></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted"><th className="p-2 text-left text-foreground">Name</th><th className="p-2 text-left text-foreground">PAN</th><th className="p-2 text-left text-foreground">Institute</th><th className="p-2 text-right text-foreground">Action</th></tr></thead><tbody>{fac.map((f: Faculty) => <tr key={f.PAN} className="border-b"><td className="p-2 text-foreground">{f.faculty_name}</td><td className="p-2 font-mono text-xs text-foreground">{f.PAN}</td><td className="p-2 text-foreground">{f.inst_short_name}</td><td className="p-2 text-right"><Button size="sm" variant="outline" onClick={() => onSel(f)}>View</Button></td></tr>)}</tbody></table></div></div>
}

function FacultyDialog({ fac, onClose, onEdit }: any) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"><div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg"><div className="mb-4 flex justify-between items-start"><h2 className="text-lg font-semibold text-foreground">{fac?.faculty_name || 'Faculty'}</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button></div><div className="space-y-2 text-sm mb-4 text-foreground"><div><strong>PAN:</strong> {fac?.PAN}</div><div><strong>Email:</strong> {fac?.faculty_Email}</div><div><strong>Designation:</strong> {fac?.faculty_desig}</div><div><strong>Institute:</strong> {fac?.inst_short_name}</div></div><div className="flex gap-2 justify-end"><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={onEdit}>Edit</Button></div></div></div>
}

function FacultyForm({ fac, onClose, onSubmit }: any) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"><form onSubmit={onSubmit} className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg"><div className="mb-4 flex justify-between items-start"><h2 className="text-lg font-semibold text-foreground">{fac?.PAN ? 'Edit' : 'Add'} Faculty</h2><button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button></div><div className="space-y-3 mb-4">{['PAN', 'Title', 'faculty_name', 'inst_short_name', 'faculty_desig', 'faculty_Email'].map(n => <label key={n} className="block"><span className="text-sm font-medium text-foreground">{n}</span><input name={n} defaultValue={fac?.[n] ?? ''} readOnly={n === 'PAN' && fac?.PAN} required={n === 'PAN'} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label>)}</div><div className="flex gap-2 justify-end"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></div></form></div>
}

function InstituteForm({ inst, onClose, onSubmit }: any) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"><form onSubmit={onSubmit} className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg"><div className="mb-4 flex justify-between items-start"><h2 className="text-lg font-semibold text-foreground">Edit Institute</h2><button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button></div><div className="space-y-3 mb-4">{['inst_short_name', 'inst_full_name', 'inst_District', 'inst_State', 'Director_Name', 'Director_Email'].map(n => <label key={n} className="block"><span className="text-sm font-medium text-foreground">{n}</span><input name={n} defaultValue={inst?.[n] ?? ''} readOnly={n === 'inst_short_name' && !!inst?.inst_short_name} required={n === 'inst_short_name'} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground" /></label>)}</div><div className="flex gap-2 justify-end"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></div></form></div>
}

export default function ExaminerPanel() {
  const [session, setSession] = useState<Session | null>(null)
  const [login, setLogin] = useState({ user_name: '', role: 'CA' as Role, password: '' })
  const [error, setError] = useState('')
  const [active, setActive] = useState('Overview')
  const [faculty, setFaculty] = useState<Faculty[]>([])
  const [institutes, setInstitutes] = useState<Institute[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [specializations, setSpecializations] = useState<Specialization[]>([])
  const [selected, setSelected] = useState<Faculty | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Faculty | null>(null)
  const [editingInst, setEditingInst] = useState<Institute | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [busy, setBusy] = useState(false)

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
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'Request failed')
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
      const [fac, inst, crs, sub, spec] = await Promise.all([
        request('/api/faculty').catch(() => []),
        session?.role !== 'FAC' ? request('/api/institutes').catch(() => []) : Promise.resolve([]),
        session?.role !== 'FAC' ? request('/api/courses').catch(() => []) : Promise.resolve([]),
        session?.role !== 'FAC' ? request('/api/subjects').catch(() => []) : Promise.resolve([]),
        session?.role !== 'FAC' ? request('/api/specializations').catch(() => []) : Promise.resolve([]),
      ])
      setFaculty(fac ?? [])
      if (inst?.length) setInstitutes(inst)
      if (crs?.length) setCourses(crs)
      if (sub?.length) setSubjects(sub)
      if (spec?.length) setSpecializations(spec)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    }
  }

  const filtered = useMemo(
    () => faculty.filter(row => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(query.toLowerCase()))),
    [faculty, query]
  )

  async function signIn(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save')
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
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <ShieldCheck />
              </div>
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
              <Button type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
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
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    {username} / {password}
                  </p>
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
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-sidebar-foreground">Examiner</p>
            <p className="text-xs text-sidebar-foreground/80">{roleLabels[session.role]}</p>
          </div>
          <button className="ml-auto lg:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {navFor[session.role].map(item => (
            <button
              key={item}
              onClick={() => {
                setActive(item)
                setSidebarOpen(false)
              }}
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
            <button className="lg:hidden text-foreground" onClick={() => setSidebarOpen(true)}>
              <Menu />
            </button>
            <div>
              <p className="text-xs text-muted-foreground">{session.institute || 'Global'}</p>
              <h1 className="text-lg font-semibold text-foreground">{active}</h1>
            </div>
          </div>
          <UserRound className="size-4 text-foreground" />
        </header>

        <div className="p-8">
          <ErrorAlert msg={error} />

          {isFaculty ? (
            <div>
              <h2 className="mb-6 text-2xl font-semibold text-foreground">My Profile</h2>
              {active === 'My Profile' && (
                <div className="rounded-lg border bg-card p-4 text-foreground">
                  {profile ? (
                    <>
                      <div className="flex justify-between mb-4">
                        <div>
                          <div className="font-semibold text-foreground">
                            {profile.Title} {profile.faculty_name}
                          </div>
                          <div className="text-sm text-muted-foreground">PAN: {profile.PAN}</div>
                        </div>
                        <Button onClick={() => setEditing(profile)} size="sm">
                          Edit
                        </Button>
                      </div>
                      <div className="grid gap-2 text-sm text-foreground">
                        <div>
                          <strong>Email:</strong> {profile.faculty_Email}
                        </div>
                        <div>
                          <strong>Institute:</strong> {profile.inst_short_name}
                        </div>
                        <div>
                          <strong>Designation:</strong> {profile.faculty_desig}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-foreground">No profile</p>
                  )}
                </div>
              )}
            </div>
          ) : session.role === 'CA' ? (
            <div>
              <h2 className="mb-6 text-2xl font-semibold text-foreground">My Institute</h2>
              {active === 'My College' && (
                <div className="rounded-lg border bg-card p-4 mb-4 text-foreground">
                  <Button onClick={() => setEditingInst(institutes[0])} className="mb-4">
                    Edit
                  </Button>
                  <div className="grid gap-2">
                    <div>
                      <strong>{institutes[0]?.inst_full_name}</strong>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {institutes[0]?.inst_District}, {institutes[0]?.inst_State}
                    </div>
                  </div>
                </div>
              )}
              {active === 'Faculty' && <FacultyListTable fac={filtered} q={query} setQ={setQuery} onSel={setSelected} onExp={() => window.open(`${API}/api/faculty-export?token=${sessionToken()}`, '_blank')} onAdd={() => setEditing({ PAN: '', inst_short_name: institutes[0]?.inst_short_name })} />}
            </div>
          ) : (
            <div>
              <h2 className="mb-6 text-2xl font-semibold text-foreground">Global Workspace</h2>
              {active === 'Overview' && (
                <div className="grid gap-4 sm:grid-cols-4">
                  <Stat label="Institutes" value={institutes.length} icon={Building2} />
                  <Stat label="Courses" value={courses.length} icon={BookOpen} />
                  <Stat label="Subjects" value={subjects.length} icon={ClipboardList} />
                  <Stat label="Faculty" value={filtered.length} icon={Users} />
                </div>
              )}
              {active === 'Institutes' && (
                <div className="rounded-lg border bg-card p-4 text-foreground">
                  <Button onClick={() => setEditingInst({ inst_short_name: '' })} className="mb-4">
                    <Plus className="size-4" />
                    Add
                  </Button>
                  <div className="space-y-2">
                    {institutes.map(i => (
                      <div key={i.inst_short_name} className="border-b border-border p-2">
                        <div className="font-mono text-sm text-foreground">{i.inst_short_name}</div>
                        <div className="text-sm text-muted-foreground">{i.inst_full_name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {active === 'Courses' && (
                <div className="rounded-lg border bg-card p-4 text-foreground">
                  <div className="space-y-2">
                    {courses.map(c => (
                      <div key={c.course_code} className="border-b border-border p-2">
                        <div className="font-mono text-sm text-foreground">{c.course_code}</div>
                        <div className="text-sm text-muted-foreground">{c.course_full_name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {active === 'Specializations' && (
                <div className="rounded-lg border bg-card p-4 text-foreground">
                  <div className="space-y-2">
                    {specializations.map(s => (
                      <div key={s.spec_id} className="border-b border-border p-2 text-sm text-foreground">
                        <span className="font-mono">{s.spec_id}</span> - <span>{s.spec_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {active === 'Subjects' && (
                <div className="rounded-lg border bg-card p-4 text-foreground">
                  <div className="space-y-2">
                    {subjects.map(s => (
                      <div key={s.subject_code} className="border-b border-border p-2">
                        <div className="font-mono text-sm text-foreground">{s.subject_code}</div>
                        <div className="text-sm text-muted-foreground">{s.subject_full_name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {active === 'Faculty' && <FacultyListTable fac={filtered} q={query} setQ={setQuery} onSel={setSelected} onExp={() => window.open(`${API}/api/faculty-export?token=${sessionToken()}`, '_blank')} onAdd={() => setEditing({ PAN: '' })} />}
            </div>
          )}
        </div>
      </main>

      {selected && <FacultyDialog fac={selected} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null) }} />}
      {editing && <FacultyForm fac={editing} onClose={() => setEditing(null)} onSubmit={saveFaculty} />}
      {editingInst && <InstituteForm inst={editingInst} onClose={() => setEditingInst(null)} onSubmit={saveInstitute} />}
    </div>
  )
}
