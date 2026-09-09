"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
const port = Number(process.env.PORT ?? 4000);
const jwtSecret = process.env.JWT_SECRET ?? 'development-secret-change-me';
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express_1.default.json({ limit: '1mb' }));
function auth(req, res, next) { const headerToken = req.headers.authorization?.replace('Bearer ', ''); const queryToken = typeof req.query.token === 'string' ? req.query.token : ''; const token = headerToken || queryToken; if (!token)
    return res.status(401).json({ error: 'Authentication required' }); try {
    req.session = jsonwebtoken_1.default.verify(token, jwtSecret);
    next();
}
catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
} }
function allow(...roles) { return (req, res, next) => req.session && roles.includes(req.session.role) ? next() : res.status(403).json({ error: 'Insufficient permissions' }); }
function facultyScope(req) { if (req.session?.role === 'FAC')
    return { PAN: req.session.userName }; if (req.session?.role === 'CE')
    return {}; return { inst_short_name: req.session?.institute }; }
function safe(row) { const copy = { ...row }; delete copy.password; return copy; }
const IPU_ENGINEERING_COURSE_CODES = new Set(['BTE', 'MTE', 'CSE', 'ECE', 'EEE', 'ME', 'CE', 'IT', 'CHE', 'EIE']);
const NON_ENGINEERING_TOKENS = ['bba', 'mba', 'bca', 'ba', 'b.com', 'law', 'pharmacy', 'medical', 'mbbs', 'commerce', 'management'];
function enforceIpuEngineeringCourse(courseCode, courseFullName, courseShortName) {
    const normalizedCode = String(courseCode ?? '').trim().toUpperCase();
    const normalizedName = String(courseFullName ?? courseShortName ?? '').trim().toLowerCase();
    if (!normalizedCode || !IPU_ENGINEERING_COURSE_CODES.has(normalizedCode)) {
        throw new Error('Only IPU engineering courses are supported. Use an engineering course code like BTE, MTE, CSE, ECE, EEE, ME, CE, IT, CHE, or EIE.');
    }
    if (normalizedName && NON_ENGINEERING_TOKENS.some(token => normalizedName.includes(token))) {
        throw new Error('Only engineering programs are supported for this IPU engineering system.');
    }
}
app.post('/api/auth/login', async (req, res) => { const parsed = zod_1.z.object({ user_name: zod_1.z.string().trim().min(1).max(10), role: zod_1.z.enum(['CE', 'CA', 'FAC']), password: zod_1.z.string().min(1) }).safeParse(req.body); if (!parsed.success)
    return res.status(400).json({ error: 'Enter the username, role, and password.' }); const user = await prisma.user.findUnique({ where: { user_name_role: { user_name: parsed.data.user_name.toUpperCase(), role: parsed.data.role } } }); if (!user || !(await bcryptjs_1.default.compare(parsed.data.password, user.password)))
    return res.status(401).json({ error: 'Invalid username, role, or password.' }); const institute = user.role === 'CA' ? user.user_name : undefined; const session = { userName: user.user_name, role: user.role, institute }; return res.json({ token: jsonwebtoken_1.default.sign(session, jwtSecret, { expiresIn: '8h' }), user: { user_name: user.user_name, role: user.role, institute } }); });
app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.session }));
app.post('/api/auth/logout', auth, (_req, res) => res.status(204).send());
app.get('/api/faculty', auth, async (req, res) => { const rows = await prisma.faculty.findMany({ where: facultyScope(req), orderBy: { faculty_name: 'asc' } }); return res.json(rows); });
app.get('/api/faculty/:PAN', auth, async (req, res) => { const row = await prisma.faculty.findUnique({ where: { PAN: String(req.params.PAN) } }); if (!row || (req.session?.role === 'FAC' ? row.PAN !== req.session.userName : req.session?.role === 'CA' && row.inst_short_name !== req.session.institute))
    return res.status(404).json({ error: 'Faculty record not found' }); return res.json(row); });
app.post('/api/faculty', auth, allow('CE', 'CA', 'FAC'), async (req, res) => { const parsed = zod_1.z.object({ PAN: zod_1.z.string().trim().min(1).max(10), Title: zod_1.z.string().max(10).optional(), faculty_name: zod_1.z.string().max(50).optional(), inst_short_name: zod_1.z.string().max(10).optional(), faculty_desig: zod_1.z.string().max(25).optional(), faculty_total_exp: zod_1.z.coerce.number().int().optional(), faculty_address: zod_1.z.string().max(100).optional(), faculty_Email: zod_1.z.string().email().max(50).optional(), faculty_MobileNo: zod_1.z.string().max(10).optional() }).parse(req.body); if (req.session?.role === 'FAC' && parsed.PAN !== req.session.userName)
    return res.status(403).json({ error: 'Faculty can only create their own record' }); if (req.session?.role === 'CA' && parsed.inst_short_name && parsed.inst_short_name !== req.session.institute)
    return res.status(403).json({ error: 'Faculty must belong to your institute' }); const existing = await prisma.faculty.findUnique({ where: { PAN: parsed.PAN } }); if (existing)
    return res.status(409).json({ error: 'A faculty record with this PAN already exists' }); const data = { ...parsed, inst_short_name: req.session?.role === 'CA' ? req.session.institute : parsed.inst_short_name, entered_by: req.session?.userName, entered_on: new Date() }; return res.status(201).json(await prisma.faculty.create({ data })); });
app.put('/api/faculty/:PAN', auth, allow('CE', 'CA', 'FAC'), async (req, res) => { const existing = await prisma.faculty.findUnique({ where: { PAN: String(req.params.PAN) } }); if (!existing || (req.session?.role === 'FAC' && existing.PAN !== req.session.userName) || (req.session?.role === 'CA' && existing.inst_short_name !== req.session.institute))
    return res.status(404).json({ error: 'Faculty record not found' }); const allowed = ['Title', 'faculty_name', 'inst_short_name', 'faculty_desig', 'faculty_total_exp', 'faculty_address', 'faculty_Email', 'faculty_MobileNo']; const data = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key))); if (req.session?.role === 'FAC')
    delete data.inst_short_name; return res.json(await prisma.faculty.update({ where: { PAN: String(req.params.PAN) }, data: { ...data, entered_by: req.session?.userName, entered_on: new Date() } })); });
app.get('/api/users', auth, allow('CE'), async (_req, res) => res.json((await prisma.user.findMany()).map(safe)));
app.post('/api/users', auth, allow('CE', 'CA'), async (req, res) => { const parsed = zod_1.z.object({ user_name: zod_1.z.string().min(1).max(10), password: zod_1.z.string().min(8), role: zod_1.z.enum(['CA', 'FAC']) }).parse(req.body); if (req.session?.role === 'CA' && parsed.role !== 'FAC')
    return res.status(403).json({ error: 'College Admin can only create Faculty credentials' }); if (req.session?.role === 'CA') {
    const faculty = await prisma.faculty.findUnique({ where: { PAN: parsed.user_name } });
    if (!faculty || faculty.inst_short_name !== req.session.institute)
        return res.status(403).json({ error: 'Faculty must belong to your institute' });
} const row = await prisma.user.create({ data: { user_name: parsed.user_name, role: parsed.role, password: await bcryptjs_1.default.hash(parsed.password, 12) } }); return res.status(201).json(safe(row)); });
const mappingModels = { 'institute-courses': 'instCourse', 'course-subjects': 'courseSubject', 'faculty-subjects': 'facultySubject', 'faculty-specializations': 'facultySpec' };
app.get('/api/mappings/:type', auth, async (req, res) => { const model = mappingModels[String(req.params.type)]; if (!model)
    return res.status(404).json({ error: 'Unknown mapping type' }); const rows = await prisma[model].findMany(); if (req.session?.role === 'FAC')
    return res.json(rows.filter((row) => row.PAN === req.session?.userName)); if (req.session?.role === 'CA' && model.startsWith('faculty'))
    return res.json(rows.filter((row) => row.PAN && false)); return res.json(rows); });
app.post('/api/mappings/:type', auth, allow('CE', 'CA', 'FAC'), async (req, res) => { const model = mappingModels[String(req.params.type)]; if (!model)
    return res.status(404).json({ error: 'Unknown mapping type' }); if (req.session?.role === 'FAC' && !['faculty-subjects', 'faculty-specializations'].includes(String(req.params.type)))
    return res.status(403).json({ error: 'Faculty cannot manage this mapping' }); if (req.session?.role === 'FAC' && req.body.PAN !== req.session.userName)
    return res.status(403).json({ error: 'Faculty can only manage their own mappings' }); const data = { ...req.body, entered_by: req.session?.userName, entered_on: new Date() }; return res.status(201).json(await prisma[model].create({ data })); });
// INSTITUTE ENDPOINTS
app.get('/api/institutes', auth, allow('CE', 'CA'), async (req, res) => { const rows = req.session?.role === 'CA' ? await prisma.institute.findMany({ where: { inst_short_name: req.session.institute } }) : await prisma.institute.findMany(); return res.json(rows); });
app.get('/api/institutes/:inst_short_name', auth, allow('CE', 'CA'), async (req, res) => { const row = await prisma.institute.findUnique({ where: { inst_short_name: String(req.params.inst_short_name) } }); if (!row || (req.session?.role === 'CA' && row.inst_short_name !== req.session.institute))
    return res.status(404).json({ error: 'Institute not found' }); return res.json(row); });
app.post('/api/institutes', auth, allow('CE'), async (req, res) => { const parsed = zod_1.z.object({ inst_short_name: zod_1.z.string().trim().min(1).max(10), inst_full_name: zod_1.z.string().max(100).optional(), inst_Address1: zod_1.z.string().max(100).optional(), inst_Address2: zod_1.z.string().max(100).optional(), inst_District: zod_1.z.string().max(50).optional(), inst_State: zod_1.z.string().max(50).optional(), Landline_PhoneNo: zod_1.z.string().max(20).optional(), Director_Name: zod_1.z.string().max(50).optional(), Director_Desig: zod_1.z.string().max(25).optional(), Director_Email: zod_1.z.string().email().max(50).optional(), Director_MobileNo: zod_1.z.string().max(10).optional(), ExamHead_Name: zod_1.z.string().max(50).optional(), ExamHead_Desig: zod_1.z.string().max(25).optional(), ExamHead_Email: zod_1.z.string().email().max(50).optional(), ExamHead_MobileNo: zod_1.z.string().max(10).optional() }).parse(req.body); const existing = await prisma.institute.findUnique({ where: { inst_short_name: parsed.inst_short_name } }); if (existing)
    return res.status(409).json({ error: 'Institute already exists' }); return res.status(201).json(await prisma.institute.create({ data: parsed })); });
app.put('/api/institutes/:inst_short_name', auth, allow('CE', 'CA'), async (req, res) => { const instShortName = String(req.params.inst_short_name); if (req.session?.role === 'CA' && instShortName !== req.session.institute)
    return res.status(403).json({ error: 'You can only edit your own institute' }); const existing = await prisma.institute.findUnique({ where: { inst_short_name: instShortName } }); if (!existing)
    return res.status(404).json({ error: 'Institute not found' }); const allowed = ['inst_full_name', 'inst_Address1', 'inst_Address2', 'inst_District', 'inst_State', 'Landline_PhoneNo', 'Director_Name', 'Director_Desig', 'Director_Email', 'Director_MobileNo', 'ExamHead_Name', 'ExamHead_Desig', 'ExamHead_Email', 'ExamHead_MobileNo']; const data = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key))); return res.json(await prisma.institute.update({ where: { inst_short_name: instShortName }, data })); });
// COURSE ENDPOINTS
app.get('/api/courses', auth, async (_req, res) => res.json(await prisma.course.findMany({ orderBy: { course_code: 'asc' } })));
app.get('/api/courses/:course_code', auth, async (req, res) => { const row = await prisma.course.findUnique({ where: { course_code: String(req.params.course_code) } }); if (!row)
    return res.status(404).json({ error: 'Course not found' }); return res.json(row); });
app.post('/api/courses', auth, allow('CE'), async (req, res) => { const parsed = zod_1.z.object({ course_code: zod_1.z.string().trim().min(1).max(3), course_short_name: zod_1.z.string().max(10).optional(), course_full_name: zod_1.z.string().max(100).optional() }).parse(req.body); const normalized = { ...parsed, course_code: parsed.course_code.toUpperCase() }; enforceIpuEngineeringCourse(normalized.course_code, normalized.course_full_name, normalized.course_short_name); const existing = await prisma.course.findUnique({ where: { course_code: normalized.course_code } }); if (existing)
    return res.status(409).json({ error: 'Course already exists' }); return res.status(201).json(await prisma.course.create({ data: normalized })); });
app.put('/api/courses/:course_code', auth, allow('CE'), async (req, res) => { const courseCode = String(req.params.course_code); const existing = await prisma.course.findUnique({ where: { course_code: courseCode } }); if (!existing)
    return res.status(404).json({ error: 'Course not found' }); const allowed = ['course_short_name', 'course_full_name']; const data = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key))); const courseShortName = typeof data.course_short_name === 'string' ? data.course_short_name : undefined; const courseFullName = typeof data.course_full_name === 'string' ? data.course_full_name : undefined; enforceIpuEngineeringCourse(courseCode.toUpperCase(), courseFullName, courseShortName); return res.json(await prisma.course.update({ where: { course_code: courseCode }, data })); });
app.delete('/api/courses/:course_code', auth, allow('CE'), async (req, res) => { try {
    await prisma.course.delete({ where: { course_code: String(req.params.course_code) } });
    return res.status(204).send();
}
catch {
    return res.status(400).json({ error: 'Cannot delete course with existing mappings' });
} });
// SPECIALIZATION ENDPOINTS
app.get('/api/specializations', auth, async (_req, res) => res.json(await prisma.specialization.findMany({ orderBy: { spec_id: 'asc' } })));
app.get('/api/specializations/:spec_id', auth, async (req, res) => { const specId = Number(Array.isArray(req.params.spec_id) ? req.params.spec_id[0] : req.params.spec_id); const row = await prisma.specialization.findUnique({ where: { spec_id: specId } }); if (!row)
    return res.status(404).json({ error: 'Specialization not found' }); return res.json(row); });
app.post('/api/specializations', auth, allow('CE'), async (req, res) => { const parsed = zod_1.z.object({ spec_id: zod_1.z.number().int().min(1), spec_name: zod_1.z.string().max(30).optional() }).parse(req.body); const existing = await prisma.specialization.findUnique({ where: { spec_id: parsed.spec_id } }); if (existing)
    return res.status(409).json({ error: 'Specialization already exists' }); return res.status(201).json(await prisma.specialization.create({ data: parsed })); });
app.put('/api/specializations/:spec_id', auth, allow('CE'), async (req, res) => { const specId = Number(Array.isArray(req.params.spec_id) ? req.params.spec_id[0] : req.params.spec_id); const existing = await prisma.specialization.findUnique({ where: { spec_id: specId } }); if (!existing)
    return res.status(404).json({ error: 'Specialization not found' }); const allowed = ['spec_name']; const data = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key))); return res.json(await prisma.specialization.update({ where: { spec_id: specId }, data })); });
app.delete('/api/specializations/:spec_id', auth, allow('CE'), async (req, res) => { try {
    const specId = Number(Array.isArray(req.params.spec_id) ? req.params.spec_id[0] : req.params.spec_id);
    await prisma.specialization.delete({ where: { spec_id: specId } });
    return res.status(204).send();
}
catch {
    return res.status(400).json({ error: 'Cannot delete specialization with existing mappings' });
} });
// SUBJECT ENDPOINTS
app.get('/api/subjects', auth, async (_req, res) => res.json(await prisma.subject.findMany({ orderBy: { subject_code: 'asc' } })));
app.get('/api/subjects/:subject_code', auth, async (req, res) => { const row = await prisma.subject.findUnique({ where: { subject_code: String(req.params.subject_code) } }); if (!row)
    return res.status(404).json({ error: 'Subject not found' }); return res.json(row); });
app.post('/api/subjects', auth, allow('CE'), async (req, res) => { const parsed = zod_1.z.object({ subject_code: zod_1.z.string().trim().min(1).max(10), sub_subject_codes: zod_1.z.string().max(100).optional(), subject_short_name: zod_1.z.string().max(10).optional(), subject_full_name: zod_1.z.string().max(100).optional(), semester: zod_1.z.number().int().optional(), spec_id: zod_1.z.number().int().optional() }).parse(req.body); const existing = await prisma.subject.findUnique({ where: { subject_code: parsed.subject_code } }); if (existing)
    return res.status(409).json({ error: 'Subject already exists' }); return res.status(201).json(await prisma.subject.create({ data: parsed })); });
app.put('/api/subjects/:subject_code', auth, allow('CE'), async (req, res) => { const subjectCode = String(req.params.subject_code); const existing = await prisma.subject.findUnique({ where: { subject_code: subjectCode } }); if (!existing)
    return res.status(404).json({ error: 'Subject not found' }); const allowed = ['sub_subject_codes', 'subject_short_name', 'subject_full_name', 'semester', 'spec_id']; const data = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key))); return res.json(await prisma.subject.update({ where: { subject_code: subjectCode }, data })); });
app.delete('/api/subjects/:subject_code', auth, allow('CE'), async (req, res) => { try {
    await prisma.subject.delete({ where: { subject_code: String(req.params.subject_code) } });
    return res.status(204).send();
}
catch {
    return res.status(400).json({ error: 'Cannot delete subject with existing mappings' });
} });
// INST_COURSE MAPPING ENDPOINTS
app.get('/api/inst-courses', auth, async (req, res) => { const rows = req.session?.role === 'CA' ? await prisma.instCourse.findMany({ where: { inst_short_name: req.session.institute } }) : await prisma.instCourse.findMany(); return res.json(rows); });
app.post('/api/inst-courses', auth, allow('CE', 'CA'), async (req, res) => { const parsed = zod_1.z.object({ inst_short_name: zod_1.z.string().max(10), course_code: zod_1.z.string().max(3), intake: zod_1.z.number().int().optional(), strength: zod_1.z.number().int().optional() }).parse(req.body); if (req.session?.role === 'CA' && parsed.inst_short_name !== req.session.institute)
    return res.status(403).json({ error: 'You can only add courses to your institute' }); const data = { inst_short_name: parsed.inst_short_name, course_code: parsed.course_code, intake: parsed.intake, strength: parsed.strength }; return res.status(201).json(await prisma.instCourse.create({ data })); });
app.put('/api/inst-courses/:inst_short_name/:course_code', auth, allow('CE', 'CA'), async (req, res) => { const inst = String(req.params.inst_short_name); const course = String(req.params.course_code); if (req.session?.role === 'CA' && inst !== req.session.institute)
    return res.status(403).json({ error: 'You can only edit your institute courses' }); const allowed = ['intake', 'strength']; const data = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key))); return res.json(await prisma.instCourse.update({ where: { inst_short_name_course_code: { inst_short_name: inst, course_code: course } }, data })); });
app.delete('/api/inst-courses/:inst_short_name/:course_code', auth, allow('CE', 'CA'), async (req, res) => { const inst = String(req.params.inst_short_name); const course = String(req.params.course_code); if (req.session?.role === 'CA' && inst !== req.session.institute)
    return res.status(403).json({ error: 'You can only delete your institute courses' }); try {
    await prisma.instCourse.delete({ where: { inst_short_name_course_code: { inst_short_name: inst, course_code: course } } });
    return res.status(204).send();
}
catch {
    return res.status(400).json({ error: 'Cannot delete mapping' });
} });
// COURSE_SUBJECT MAPPING ENDPOINTS
app.get('/api/course-subjects', auth, async (_req, res) => res.json(await prisma.courseSubject.findMany()));
app.post('/api/course-subjects', auth, allow('CE'), async (req, res) => { const parsed = zod_1.z.object({ course_code: zod_1.z.string().max(3), subject_code: zod_1.z.string().max(10) }).parse(req.body); const data = { course_code: parsed.course_code, subject_code: parsed.subject_code }; return res.status(201).json(await prisma.courseSubject.create({ data })); });
app.delete('/api/course-subjects/:course_code/:subject_code', auth, allow('CE'), async (req, res) => { try {
    await prisma.courseSubject.delete({ where: { course_code_subject_code: { course_code: String(req.params.course_code), subject_code: String(req.params.subject_code) } } });
    return res.status(204).send();
}
catch {
    return res.status(400).json({ error: 'Cannot delete mapping' });
} });
app.get('/api/faculty-export', auth, allow('CE', 'CA'), async (req, res) => { const rows = await prisma.faculty.findMany({ where: facultyScope(req) }); const columns = ['PAN', 'Title', 'faculty_name', 'inst_short_name', 'faculty_desig', 'faculty_total_exp', 'faculty_address', 'faculty_Email', 'faculty_MobileNo']; const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => JSON.stringify(row[column] ?? '')).join(','))].join('\n'); res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename="faculty-export.csv"'); return res.send(csv); });
app.get('/api/faculty-subjects', auth, async (req, res) => {
    const rows = await prisma.facultySubject.findMany();
    if (req.session?.role === 'FAC')
        return res.json(rows.filter(row => row.PAN === req.session?.userName));
    if (req.session?.role === 'CA') {
        const allowed = await prisma.faculty.findMany({ where: { inst_short_name: req.session.institute }, select: { PAN: true } });
        const panSet = new Set(allowed.map(row => row.PAN));
        return res.json(rows.filter(row => panSet.has(row.PAN)));
    }
    return res.json(rows);
});
app.post('/api/faculty-subjects', auth, allow('CE', 'CA', 'FAC'), async (req, res) => {
    const parsed = zod_1.z.object({ PAN: zod_1.z.string().trim().min(1).max(10), subject_code: zod_1.z.string().trim().min(1).max(10) }).parse(req.body);
    if (req.session?.role === 'FAC' && parsed.PAN !== req.session.userName)
        return res.status(403).json({ error: 'Faculty can only manage its own subjects' });
    if (req.session?.role === 'CA') {
        const facultyRow = await prisma.faculty.findUnique({ where: { PAN: parsed.PAN } });
        if (!facultyRow || facultyRow.inst_short_name !== req.session.institute)
            return res.status(403).json({ error: 'Faculty must belong to your institute' });
    }
    const facultyRow = await prisma.faculty.findUnique({ where: { PAN: parsed.PAN } });
    if (!facultyRow)
        return res.status(404).json({ error: 'Faculty not found' });
    const subject = await prisma.subject.findUnique({ where: { subject_code: parsed.subject_code } });
    if (!subject)
        return res.status(404).json({ error: 'Subject not found' });
    const existing = await prisma.facultySubject.findUnique({ where: { PAN_subject_code: { PAN: parsed.PAN, subject_code: parsed.subject_code } } });
    if (existing)
        return res.status(409).json({ error: 'Subject mapping already exists' });
    return res.status(201).json(await prisma.facultySubject.create({ data: { PAN: parsed.PAN, subject_code: parsed.subject_code, entered_by: req.session?.userName ?? parsed.PAN, entered_on: new Date() } }));
});
app.delete('/api/faculty-subjects/:PAN/:subject_code', auth, allow('CE', 'CA', 'FAC'), async (req, res) => {
    const pan = String(req.params.PAN);
    const subjectCode = String(req.params.subject_code);
    if (req.session?.role === 'FAC' && pan !== req.session.userName)
        return res.status(403).json({ error: 'Faculty can only remove its own subject mappings' });
    if (req.session?.role === 'CA') {
        const facultyRow = await prisma.faculty.findUnique({ where: { PAN: pan } });
        if (!facultyRow || facultyRow.inst_short_name !== req.session.institute)
            return res.status(403).json({ error: 'Faculty must belong to your institute' });
    }
    try {
        await prisma.facultySubject.delete({ where: { PAN_subject_code: { PAN: pan, subject_code: subjectCode } } });
        return res.status(204).send();
    }
    catch {
        return res.status(404).json({ error: 'Mapping not found' });
    }
});
app.get('/api/faculty-specializations', auth, async (req, res) => {
    const rows = await prisma.facultySpec.findMany();
    if (req.session?.role === 'FAC')
        return res.json(rows.filter(row => row.PAN === req.session?.userName));
    if (req.session?.role === 'CA') {
        const allowed = await prisma.faculty.findMany({ where: { inst_short_name: req.session.institute }, select: { PAN: true } });
        const panSet = new Set(allowed.map(row => row.PAN));
        return res.json(rows.filter(row => panSet.has(row.PAN)));
    }
    return res.json(rows);
});
app.post('/api/faculty-specializations', auth, allow('CE', 'CA', 'FAC'), async (req, res) => {
    const parsed = zod_1.z.object({ PAN: zod_1.z.string().trim().min(1).max(10), spec_id: zod_1.z.coerce.number().int().min(1) }).parse(req.body);
    if (req.session?.role === 'FAC' && parsed.PAN !== req.session.userName)
        return res.status(403).json({ error: 'Faculty can only manage its own specializations' });
    if (req.session?.role === 'CA') {
        const facultyRow = await prisma.faculty.findUnique({ where: { PAN: parsed.PAN } });
        if (!facultyRow || facultyRow.inst_short_name !== req.session.institute)
            return res.status(403).json({ error: 'Faculty must belong to your institute' });
    }
    const facultyRow = await prisma.faculty.findUnique({ where: { PAN: parsed.PAN } });
    if (!facultyRow)
        return res.status(404).json({ error: 'Faculty not found' });
    const specialization = await prisma.specialization.findUnique({ where: { spec_id: parsed.spec_id } });
    if (!specialization)
        return res.status(404).json({ error: 'Specialization not found' });
    const existing = await prisma.facultySpec.findUnique({ where: { PAN_spec_id: { PAN: parsed.PAN, spec_id: parsed.spec_id } } });
    if (existing)
        return res.status(409).json({ error: 'Specialization mapping already exists' });
    return res.status(201).json(await prisma.facultySpec.create({ data: { PAN: parsed.PAN, spec_id: parsed.spec_id, entered_by: req.session?.userName ?? parsed.PAN, entered_on: new Date() } }));
});
app.delete('/api/faculty-specializations/:PAN/:spec_id', auth, allow('CE', 'CA', 'FAC'), async (req, res) => {
    const pan = String(req.params.PAN);
    const specId = Number(req.params.spec_id);
    if (req.session?.role === 'FAC' && pan !== req.session.userName)
        return res.status(403).json({ error: 'Faculty can only remove its own specialization mappings' });
    if (req.session?.role === 'CA') {
        const facultyRow = await prisma.faculty.findUnique({ where: { PAN: pan } });
        if (!facultyRow || facultyRow.inst_short_name !== req.session.institute)
            return res.status(403).json({ error: 'Faculty must belong to your institute' });
    }
    try {
        await prisma.facultySpec.delete({ where: { PAN_spec_id: { PAN: pan, spec_id: specId } } });
        return res.status(204).send();
    }
    catch {
        return res.status(404).json({ error: 'Mapping not found' });
    }
});
app.use((error, _req, res, _next) => { console.error('[v0] API error', error); return res.status(400).json({ error: error instanceof Error ? error.message : 'Unexpected server error' }); });
app.listen(port, () => console.log(`[v0] Examiner API listening on ${port}`));
