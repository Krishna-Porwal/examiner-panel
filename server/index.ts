import 'dotenv/config'
import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()
const app = express()
const port = Number(process.env.PORT ?? 4000)
const jwtSecret = process.env.JWT_SECRET ?? 'development-secret-change-me'
type Role = 'CE' | 'CA' | 'FAC'
type Session = { user_name: string; role: Role; institute?: string }
type AuthedRequest = Request & { session?: Session }
app.use(helmet())
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json({ limit: '1mb' }))

function auth(req: AuthedRequest, res: Response, next: NextFunction) { const headerToken = req.headers.authorization?.replace('Bearer ', ''); const queryToken = typeof req.query.token === 'string' ? req.query.token : ''; const token = headerToken || queryToken; if (!token) return res.status(401).json({ error: 'Authentication required' }); try { req.session = jwt.verify(token, jwtSecret) as Session; next() } catch { return res.status(401).json({ error: 'Invalid or expired session' }) } }
function allow(...roles: Role[]) { return (req: AuthedRequest, res: Response, next: NextFunction) => req.session && roles.includes(req.session.role) ? next() : res.status(403).json({ error: 'Insufficient permissions' }) }
function facultyScope(req: AuthedRequest) { if (req.session?.role === 'CE') return {}; if (req.session?.role === 'CA' || req.session?.role === 'FAC') return { inst_short_name: req.session?.institute ?? '' }; return {} }
function canAccessFacultyRecord(req: AuthedRequest, facultyRow: { inst_short_name?: string | null } | null | undefined) {
  if (!facultyRow) return false
  if (req.session?.role === 'CE') return true
  if (!req.session?.institute) return false
  return facultyRow.inst_short_name === req.session.institute
}
function enforceFacultyInstituteScope(req: AuthedRequest, pan: string) {
  if (req.session?.role === 'CE') return
  if (!req.session?.institute) throw new Error('Institute scope is required')
  return { inst_short_name: req.session.institute }
}
function safe(row: Record<string, unknown>) { const copy = { ...row }; delete copy.password; return copy }
function normalizeUserName(value: string) { return value.trim().toUpperCase().replace(/\s+/g, '') }

function normalizeCredentialPayload(payload: { user_name: string; password: string; role: 'CA' | 'FAC' }) {
  const userName = normalizeUserName(payload.user_name)
  const password = payload.password.trim()
  if (!userName) throw new Error('Username is required.')
  if (password.length < 8) throw new Error('Password must be at least 8 characters long.')
  return { user_name: userName, password, role: payload.role }
}

async function findUserByCredential(user_name: string, role: Role) {
  const normalizedUserName = normalizeUserName(user_name)
  const direct = await prisma.user.findUnique({
    where: { user_name_role: { user_name: normalizedUserName, role } }
  })
  if (direct) return direct

  const rows = await prisma.user.findMany({ where: { role } })
  return rows.find(row => normalizeUserName(row.user_name) === normalizedUserName) ?? null
}

async function findFacultyByPan(pan: string) {
  const normalizedPan = normalizeUserName(pan)
  const direct = await prisma.faculty.findUnique({ where: { PAN: normalizedPan } })
  if (direct) return direct

  const rows = await prisma.faculty.findMany()
  return rows.find(row => normalizeUserName(row.PAN ?? '') === normalizedPan) ?? null
}

async function findInstituteByCode(instShortName: string) {
  const normalized = normalizeUserName(instShortName)
  const direct = await prisma.institute.findUnique({ where: { inst_short_name: normalized } })
  if (direct) return direct

  const rows = await prisma.institute.findMany()
  return rows.find(row => normalizeUserName(row.inst_short_name) === normalized) ?? null
}

const IPU_ENGINEERING_COURSE_CODES = new Set(['BTE', 'MTE', 'CSE', 'ECE', 'EEE', 'ME', 'CE', 'IT', 'CHE', 'EIE'])
const NON_ENGINEERING_TOKENS = ['bba', 'mba', 'bca', 'ba', 'b.com', 'law', 'pharmacy', 'medical', 'mbbs', 'commerce', 'management']

function enforceIpuEngineeringCourse(courseCode: string, courseFullName?: string, courseShortName?: string) {
  const normalizedCode = String(courseCode ?? '').trim().toUpperCase()
  const normalizedName = String(courseFullName ?? courseShortName ?? '').trim().toLowerCase()
  if (!normalizedCode || !IPU_ENGINEERING_COURSE_CODES.has(normalizedCode)) {
    throw new Error('Only IPU engineering courses are supported. Use an engineering course code like BTE, MTE, CSE, ECE, EEE, ME, CE, IT, CHE, or EIE.')
  }
  if (normalizedName && NON_ENGINEERING_TOKENS.some(token => normalizedName.includes(token))) {
    throw new Error('Only engineering programs are supported for this IPU engineering system.')
  }
}

app.post('/api/auth/login', async (req, res) => { 
  const parsed = z.object({ user_name: z.string().trim().min(1).max(10), role: z.enum(['CE', 'CA', 'FAC']), password: z.string().min(1) }).safeParse(req.body); 
  if (!parsed.success) return res.status(400).json({ error: 'Enter the username, role, and password.' }); 
  const user = await findUserByCredential(parsed.data.user_name, parsed.data.role); 
  if (!user || !(await bcrypt.compare(parsed.data.password.trim(), user.password))) return res.status(401).json({ error: 'Invalid username, role, or password.' }); 
  
  let institute: string | undefined
  if (user.role === 'CA') {
    institute = user.user_name
  } else if (user.role === 'FAC') {
    const maybeInstitute = normalizeUserName(user.user_name).replace(/_USER$/, '')
    const instituteRecord = await prisma.institute.findUnique({ where: { inst_short_name: maybeInstitute } })
    institute = instituteRecord?.inst_short_name ?? (maybeInstitute || undefined)
  }
  
  const session: Session = { user_name: user.user_name, role: user.role as Role, institute }; 
  return res.json({ token: jwt.sign(session, jwtSecret, { expiresIn: '8h' }), user: { user_name: user.user_name, role: user.role, institute } }) 
})
app.get('/api/auth/me', auth, (req: AuthedRequest, res) => res.json({ user: req.session }))
app.post('/api/auth/logout', auth, (_req, res) => res.status(204).send())

app.get('/api/faculty', auth, async (req: AuthedRequest, res) => { const rows = await prisma.faculty.findMany({ where: facultyScope(req), orderBy: { faculty_name: 'asc' } }); return res.json(rows) })
app.get('/api/faculty/:PAN', auth, async (req: AuthedRequest, res) => {
  const row = await prisma.faculty.findUnique({ where: { PAN: String(req.params.PAN) } });
  if (!row || !canAccessFacultyRecord(req, row)) return res.status(404).json({ error: 'Faculty record not found' });
  return res.json(row)
})
app.post('/api/faculty', auth, allow('CE', 'CA', 'FAC'), async (req: AuthedRequest, res) => {
  const parsed = z.object({ PAN: z.string().trim().min(1).max(10), Title: z.string().max(10).optional(), faculty_name: z.string().max(50).optional(), inst_short_name: z.string().max(10).optional(), faculty_desig: z.string().max(25).optional(), faculty_total_exp: z.coerce.number().int().optional(), faculty_address: z.string().max(100).optional(), faculty_Email: z.string().email().max(50).optional(), faculty_MobileNo: z.string().max(10).optional() }).parse(req.body)
  if (req.session?.role === 'FAC') {
    if (!req.session.institute) return res.status(403).json({ error: 'College User is not associated with an institute' })
    if (parsed.inst_short_name && parsed.inst_short_name !== req.session.institute) return res.status(403).json({ error: 'College User can only add faculty to their institute' })
  }
  if (req.session?.role === 'CA' && parsed.inst_short_name && parsed.inst_short_name !== req.session.institute) return res.status(403).json({ error: 'Faculty must belong to your institute' })
  if (req.session?.role === 'CA' && (!parsed.inst_short_name || parsed.inst_short_name !== req.session.institute)) return res.status(403).json({ error: 'Faculty must belong to your institute' })
  const existing = await prisma.faculty.findUnique({ where: { PAN: parsed.PAN } }); if (existing) return res.status(409).json({ error: 'A faculty record with this PAN already exists' });
  const targetInstitute = req.session?.role === 'CA' || req.session?.role === 'FAC' ? req.session.institute : parsed.inst_short_name
  const data = { ...parsed, inst_short_name: targetInstitute, entered_by: req.session?.user_name, entered_on: new Date() }
  return res.status(201).json(await prisma.faculty.create({ data }))
})
app.put('/api/faculty/:PAN', auth, allow('CE', 'CA', 'FAC'), async (req: AuthedRequest, res) => { 
  const pan = String(req.params.PAN); 
  const existing = await prisma.faculty.findUnique({ where: { PAN: pan } }); 
  if (!existing) return res.status(404).json({ error: 'Faculty record not found' }); 
  if (req.session?.role === 'FAC') {
    if (existing.inst_short_name !== req.session.institute) return res.status(403).json({ error: 'Faculty not found in your institute' });
    if (req.body?.inst_short_name && String(req.body.inst_short_name) !== (existing.inst_short_name ?? '')) return res.status(403).json({ error: 'Your institute is locked and cannot be changed' });
    if (typeof req.body.PAN === 'string' && req.body.PAN !== pan) return res.status(403).json({ error: 'Faculty PAN cannot be changed' })
  }
  if (req.session?.role === 'CA' && existing.inst_short_name !== req.session.institute) return res.status(403).json({ error: 'Faculty not found in your institute' }); 
  const allowed = ['Title', 'faculty_name', 'faculty_desig', 'faculty_total_exp', 'faculty_address', 'faculty_Email', 'faculty_MobileNo']; 
  const data = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key))); 
  return res.json(await prisma.faculty.update({ where: { PAN: pan }, data: { ...data, entered_by: req.session?.user_name, entered_on: new Date() } })) 
})

const mappingModels: Record<string, 'instCourse' | 'courseSubject' | 'facultySubject' | 'facultySpec'> = { 'institute-courses': 'instCourse', 'course-subjects': 'courseSubject', 'faculty-subjects': 'facultySubject', 'faculty-specializations': 'facultySpec' }
app.get('/api/mappings/:type', auth, async (req: AuthedRequest, res) => {
  const model = mappingModels[String(req.params.type)]; if (!model) return res.status(404).json({ error: 'Unknown mapping type' });
  const rows = await (prisma as any)[model].findMany();
  if (req.session?.role === 'FAC' && req.session.institute) {
    if (model === 'facultySubject' || model === 'facultySpec') {
      const allowed = await prisma.faculty.findMany({ where: { inst_short_name: req.session.institute }, select: { PAN: true } })
      const panSet = new Set(allowed.map(row => row.PAN));
      return res.json(rows.filter((row: any) => panSet.has(row.PAN)))
    }
    return res.json(rows)
  }
  if (req.session?.role === 'CA' && model.startsWith('faculty')) return res.json(rows.filter((row: any) => row.PAN && false));
  return res.json(rows)
})
app.post('/api/mappings/:type', auth, allow('CE', 'CA', 'FAC'), async (req: AuthedRequest, res) => {
  const model = mappingModels[String(req.params.type)]; if (!model) return res.status(404).json({ error: 'Unknown mapping type' });
  if (req.session?.role === 'FAC' && !['faculty-subjects', 'faculty-specializations'].includes(String(req.params.type))) return res.status(403).json({ error: 'Faculty cannot manage this mapping' });
  if (req.session?.role === 'FAC') {
    const targetPan = String(req.body.PAN ?? '');
    const targetFaculty = await prisma.faculty.findUnique({ where: { PAN: targetPan } });
    if (!targetFaculty || targetFaculty.inst_short_name !== req.session.institute) return res.status(403).json({ error: 'Faculty can only manage mappings in their institute' });
  }
  const data = { ...req.body, entered_by: req.session?.user_name, entered_on: new Date() }; return res.status(201).json(await (prisma as any)[model].create({ data }))
})
app.get('/api/faculty-subjects', auth, async (req: AuthedRequest, res) => {
  const rows = await prisma.facultySubject.findMany();
  if (req.session?.role === 'FAC' && req.session.institute) {
    const allowed = await prisma.faculty.findMany({ where: { inst_short_name: req.session.institute }, select: { PAN: true } });
    const panSet = new Set(allowed.map(row => row.PAN));
    return res.json(rows.filter(row => panSet.has(row.PAN)));
  }
  if (req.session?.role === 'CA') {
    const allowed = await prisma.faculty.findMany({ where: { inst_short_name: req.session.institute }, select: { PAN: true } });
    const panSet = new Set(allowed.map(row => row.PAN));
    return res.json(rows.filter(row => panSet.has(row.PAN)));
  }
  return res.json(rows)
})
app.post('/api/faculty-subjects', auth, allow('CE', 'CA', 'FAC'), async (req: AuthedRequest, res) => {
  const parsed = z.object({ PAN: z.string().trim().min(1).max(10), subject_code: z.string().trim().min(1).max(10) }).parse(req.body);
  if (req.session?.role === 'FAC') {
    const facultyRow = await prisma.faculty.findUnique({ where: { PAN: parsed.PAN } });
    if (!facultyRow || facultyRow.inst_short_name !== req.session.institute) return res.status(403).json({ error: 'Faculty must belong to your institute' });
  } else if (req.session?.role === 'CA') {
    const facultyRow = await prisma.faculty.findUnique({ where: { PAN: parsed.PAN } });
    if (!facultyRow || facultyRow.inst_short_name !== req.session.institute) return res.status(403).json({ error: 'Faculty must belong to your institute' });
  }
  const facultyRow = await prisma.faculty.findUnique({ where: { PAN: parsed.PAN } });
  if (!facultyRow) return res.status(404).json({ error: 'Faculty not found' });
  const subject = await prisma.subject.findUnique({ where: { subject_code: parsed.subject_code } });
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  const existing = await prisma.facultySubject.findUnique({ where: { PAN_subject_code: { PAN: parsed.PAN, subject_code: parsed.subject_code } } });
  if (existing) return res.status(409).json({ error: 'Subject mapping already exists' });
  return res.status(201).json(await prisma.facultySubject.create({ data: { PAN: parsed.PAN, subject_code: parsed.subject_code, entered_by: req.session?.user_name ?? parsed.PAN, entered_on: new Date() } }))
})
app.delete('/api/faculty-subjects/:PAN/:subject_code', auth, allow('CE', 'CA', 'FAC'), async (req: AuthedRequest, res) => {
  const pan = String(req.params.PAN);
  const subjectCode = String(req.params.subject_code);
  if (req.session?.role === 'FAC') {
    const facultyRow = await prisma.faculty.findUnique({ where: { PAN: pan } });
    if (!facultyRow || facultyRow.inst_short_name !== req.session.institute) return res.status(403).json({ error: 'Faculty must belong to your institute' });
  } else if (req.session?.role === 'CA') {
    const facultyRow = await prisma.faculty.findUnique({ where: { PAN: pan } });
    if (!facultyRow || facultyRow.inst_short_name !== req.session.institute) return res.status(403).json({ error: 'Faculty must belong to your institute' });
  }
  try { await prisma.facultySubject.delete({ where: { PAN_subject_code: { PAN: pan, subject_code: subjectCode } } }); return res.status(204).send(); }
  catch { return res.status(404).json({ error: 'Mapping not found' }); }
})
app.get('/api/faculty-specializations', auth, async (req: AuthedRequest, res) => {
  const rows = await prisma.facultySpec.findMany();
  if (req.session?.role === 'FAC' && req.session.institute) {
    const allowed = await prisma.faculty.findMany({ where: { inst_short_name: req.session.institute }, select: { PAN: true } });
    const panSet = new Set(allowed.map(row => row.PAN));
    return res.json(rows.filter(row => panSet.has(row.PAN)));
  }
  if (req.session?.role === 'CA') {
    const allowed = await prisma.faculty.findMany({ where: { inst_short_name: req.session.institute }, select: { PAN: true } });
    const panSet = new Set(allowed.map(row => row.PAN));
    return res.json(rows.filter(row => panSet.has(row.PAN)));
  }
  return res.json(rows)
})
app.post('/api/faculty-specializations', auth, allow('CE', 'CA', 'FAC'), async (req: AuthedRequest, res) => {
  const parsed = z.object({ PAN: z.string().trim().min(1).max(10), spec_id: z.coerce.number().int().min(1) }).parse(req.body);
  if (req.session?.role === 'FAC') {
    const facultyRow = await prisma.faculty.findUnique({ where: { PAN: parsed.PAN } });
    if (!facultyRow || facultyRow.inst_short_name !== req.session.institute) return res.status(403).json({ error: 'Faculty must belong to your institute' });
  } else if (req.session?.role === 'CA') {
    const facultyRow = await prisma.faculty.findUnique({ where: { PAN: parsed.PAN } });
    if (!facultyRow || facultyRow.inst_short_name !== req.session.institute) return res.status(403).json({ error: 'Faculty must belong to your institute' });
  }
  const facultyRow = await prisma.faculty.findUnique({ where: { PAN: parsed.PAN } });
  if (!facultyRow) return res.status(404).json({ error: 'Faculty not found' });
  const specialization = await prisma.specialization.findUnique({ where: { spec_id: parsed.spec_id } });
  if (!specialization) return res.status(404).json({ error: 'Specialization not found' });
  const existing = await prisma.facultySpec.findUnique({ where: { PAN_spec_id: { PAN: parsed.PAN, spec_id: parsed.spec_id } } });
  if (existing) return res.status(409).json({ error: 'Specialization mapping already exists' });
  return res.status(201).json(await prisma.facultySpec.create({ data: { PAN: parsed.PAN, spec_id: parsed.spec_id, entered_by: req.session?.user_name ?? parsed.PAN, entered_on: new Date() } }))
})
app.delete('/api/faculty-specializations/:PAN/:spec_id', auth, allow('CE', 'CA', 'FAC'), async (req: AuthedRequest, res) => {
  const pan = String(req.params.PAN);
  const specId = Number(req.params.spec_id);
  if (req.session?.role === 'FAC') {
    const facultyRow = await prisma.faculty.findUnique({ where: { PAN: pan } });
    if (!facultyRow || facultyRow.inst_short_name !== req.session.institute) return res.status(403).json({ error: 'Faculty must belong to your institute' });
  } else if (req.session?.role === 'CA') {
    const facultyRow = await prisma.faculty.findUnique({ where: { PAN: pan } });
    if (!facultyRow || facultyRow.inst_short_name !== req.session.institute) return res.status(403).json({ error: 'Faculty must belong to your institute' });
  }
  try { await prisma.facultySpec.delete({ where: { PAN_spec_id: { PAN: pan, spec_id: specId } } }); return res.status(204).send(); }
  catch { return res.status(404).json({ error: 'Mapping not found' }); }
})
app.delete('/api/faculty/:PAN', auth, allow('CE'), async (req: AuthedRequest, res) => {
  const pan = String(req.params.PAN);
  const existing = await prisma.faculty.findUnique({ where: { PAN: pan } });
  if (!existing) return res.status(404).json({ error: 'Faculty not found' });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.facultySubject.deleteMany({ where: { PAN: pan } });
      await tx.facultySpec.deleteMany({ where: { PAN: pan } });
      await tx.user.deleteMany({ where: { user_name: pan, role: 'FAC' } });
      await tx.faculty.delete({ where: { PAN: pan } });
    })
    return res.status(204).send();
  } catch {
    return res.status(400).json({ error: 'Cannot delete faculty at this time' });
  }
})
app.delete('/api/institutes/:inst_short_name', auth, allow('CE'), async (req: AuthedRequest, res) => {
  const instShortName = String(req.params.inst_short_name);
  const existing = await prisma.institute.findUnique({ where: { inst_short_name: instShortName } });
  if (!existing) return res.status(404).json({ error: 'Institute not found' });
  try {
    await prisma.$transaction(async (tx) => {
      const facultyList = await tx.faculty.findMany({ where: { inst_short_name: instShortName } });
      const facultyPanList = facultyList.map(row => row.PAN)
      if (facultyPanList.length > 0) {
        await tx.facultySubject.deleteMany({ where: { PAN: { in: facultyPanList } } });
        await tx.facultySpec.deleteMany({ where: { PAN: { in: facultyPanList } } });
        await tx.user.deleteMany({ where: { user_name: { in: facultyPanList }, role: 'FAC' } });
      }
      await tx.faculty.deleteMany({ where: { inst_short_name: instShortName } });
      await tx.instCourse.deleteMany({ where: { inst_short_name: instShortName } });
      await tx.user.deleteMany({ where: { user_name: instShortName, role: 'CA' } });
      await tx.institute.delete({ where: { inst_short_name: instShortName } });
    })
    return res.status(204).send();
  } catch {
    return res.status(400).json({ error: 'Cannot delete institute at this time' });
  }
})

// SEARCH ENDPOINT - role-scoped
app.get('/api/search', auth, async (req: AuthedRequest, res) => {
  const q = String(req.query.q ?? '').trim()
  if (!q) return res.json({ institutes: [], courses: [], subjects: [], faculty: [] })

  try {
    const courseWhere = { OR: [{ course_code: { contains: q } }, { course_short_name: { contains: q } }, { course_full_name: { contains: q } }] }
    const subjectWhere = { OR: [{ subject_code: { contains: q } }, { subject_short_name: { contains: q } }, { subject_full_name: { contains: q } }] }
    const facultyWhereBase = { OR: [{ PAN: { contains: q } }, { faculty_name: { contains: q } }, { faculty_desig: { contains: q } }, { faculty_Email: { contains: q } }] }

    const institutes = await prisma.institute.findMany({ where: { OR: [{ inst_short_name: { contains: q } }, { inst_full_name: { contains: q } }] }, take: 50 })
    const courses = await prisma.course.findMany({ where: courseWhere, take: 50 })
    const subjects = await prisma.subject.findMany({ where: subjectWhere, take: 50 })

    // Faculty must be scoped for CA/FAC
    const facultyWhere: any = { AND: [facultyWhereBase] }
    if (req.session?.role === 'CA' || req.session?.role === 'FAC') facultyWhere.AND.push({ inst_short_name: req.session?.institute })
    const faculty = await prisma.faculty.findMany({ where: facultyWhere, take: 200 })

    return res.json({ institutes, courses, subjects, faculty })
  } catch (err) {
    console.error('Search error', err)
    return res.status(500).json({ error: 'Search failed' })
  }
})

// COURSE DETAILS - analytics
app.get('/api/courses/:course_code/details', auth, async (req: AuthedRequest, res) => {
  const courseCode = String(req.params.course_code)
  const course = await prisma.course.findUnique({ where: { course_code: courseCode } })
  if (!course) return res.status(404).json({ error: 'Course not found' })

  // If CA or FAC, restrict to their institute
  const instFilter = req.session?.role === 'CE' ? {} : { inst_short_name: req.session?.institute }

  const institutesOffering = await prisma.instCourse.findMany({ where: { course_code: courseCode, ...instFilter }, include: { institute: true } })
  // return the full course-subject mapping rows including study_year/semester and nested subject
  const subjects = await prisma.courseSubject.findMany({ where: { course_code: courseCode }, include: { subject: true } })
  const subjectCodes = subjects.map(s => s.subject_code)

  // Count distinct faculty teaching any subject in this course
  let facultyRows: any[] = []
  if (subjectCodes.length > 0) {
    facultyRows = await prisma.faculty.findMany({ where: { subjects: { some: { subject_code: { in: subjectCodes } } }, ...(req.session?.role === 'CE' ? {} : { inst_short_name: req.session?.institute }) } })
  }

  // subjects is an array of CourseSubject rows with nested `subject` object and mapping fields
  return res.json({ course, institutesOffering: institutesOffering.map(r => r.institute), subjects, facultyCount: facultyRows.length, faculty: facultyRows })
})

// SUBJECT DETAILS - analytics
app.get('/api/subjects/:subject_code/details', auth, async (req: AuthedRequest, res) => {
  const subjectCode = String(req.params.subject_code)
  const subject = await prisma.subject.findUnique({ where: { subject_code: subjectCode } })
  if (!subject) return res.status(404).json({ error: 'Subject not found' })

  // return full course-subject mapping rows including study_year/semester and nested course
  const courseMappings = await prisma.courseSubject.findMany({ where: { subject_code: subjectCode }, include: { course: true } })
  const courseCodes = courseMappings.map(c => c.course_code)

  // Institutes where those courses are available (respect role scope)
  const instWhere: any = { course_code: { in: courseCodes } }
  if (req.session?.role !== 'CE') instWhere.inst_short_name = req.session?.institute
  const instCourses = await prisma.instCourse.findMany({ where: instWhere, include: { institute: true } })
  const institutes = instCourses.map(ic => ic.institute)

  // Faculty who teach this subject
  const facultyWhere: any = { subjects: { some: { subject_code: subjectCode } } }
  if (req.session?.role !== 'CE') facultyWhere.inst_short_name = req.session?.institute
  const facultyRows = await prisma.faculty.findMany({ where: facultyWhere })

  // courses: return mapping rows so frontend can read study_year/semester and nested course
  return res.json({ subject, courses: courseMappings, institutes, instituteCount: new Set(institutes.map(i => i.inst_short_name)).size, facultyCount: facultyRows.length, faculty: facultyRows })
})

// INSTITUTE DETAILS - analytics
app.get('/api/institutes/:inst_short_name/details', auth, async (req: AuthedRequest, res) => {
  const inst = String(req.params.inst_short_name)
  if (req.session?.role === 'CA' && inst !== req.session.institute) return res.status(404).json({ error: 'Institute not found' })
  if (req.session?.role === 'FAC' && inst !== req.session.institute) return res.status(404).json({ error: 'Institute not found' })

  const institute = await prisma.institute.findUnique({ where: { inst_short_name: inst } })
  if (!institute) return res.status(404).json({ error: 'Institute not found' })

  const instCourses = await prisma.instCourse.findMany({ where: { inst_short_name: inst }, include: { course: true } })
  const courseCodes = instCourses.map(ic => ic.course_code)
  // include mapping rows so institute view can show study_year and semester per subject
  const subjects = await prisma.courseSubject.findMany({ where: { course_code: { in: courseCodes } }, include: { subject: true } })
  const facultyRows = await prisma.faculty.findMany({ where: { inst_short_name: inst } })

  const courseStats = await Promise.all(instCourses.map(async (ic) => {
    const subs = await prisma.courseSubject.findMany({ where: { course_code: ic.course_code }, include: { subject: true } })
    const facultyForCourse = await prisma.faculty.findMany({ where: { subjects: { some: { subject: { courses: { some: { course_code: ic.course_code } } } } }, inst_short_name: inst } })
    return { course: ic.course, intake: ic.intake, strength: ic.strength, subjects: subs, facultyCount: facultyForCourse.length, faculty: facultyForCourse }
  }))

  return res.json({ institute, courses: instCourses.map(ic => ic.course), facultyCount: facultyRows.length, subjects: subjects.map(s => s.subject), courseStats })
})

// Catch all errors
process.on('uncaughtException', (error) => {
  console.error('[v0] Uncaught exception:', error)
})

process.on('unhandledRejection', (reason) => {
  console.error('[v0] Unhandled rejection:', reason)
})

// Start the HTTP server
const httpServer = app.listen(port, async () => {
  console.log(`[v0] Examiner API listening on ${port}`)
  try {
    // Try a test query to ensure DB connection is working
    const count = await prisma.user.count()
    console.log(`[v0] Database connected, users count: ${count}`)
  } catch (err) {
    console.error('[v0] Database connection error:', err)
  }
})

// Handle server errors
httpServer.on('error', (error) => {
  console.error('[v0] Server error:', error)
})

// Make sure the HTTP server keeps process alive
httpServer.ref()
