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
const configuredOrigins = process.env.FRONTEND_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? [];
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production' && configuredOrigins.length > 0 ? configuredOrigins : true,
    credentials: true,
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
app.get('/api/faculty-export', auth, allow('CE', 'CA'), async (req, res) => { const rows = await prisma.faculty.findMany({ where: facultyScope(req) }); const columns = ['PAN', 'Title', 'faculty_name', 'inst_short_name', 'faculty_desig', 'faculty_total_exp', 'faculty_address', 'faculty_Email', 'faculty_MobileNo']; const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => JSON.stringify(row[column] ?? '')).join(','))].join('\n'); res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename="faculty-export.csv"'); return res.send(csv); });
app.use((error, _req, res, _next) => { console.error('[v0] API error', error); return res.status(400).json({ error: error instanceof Error ? error.message : 'Unexpected server error' }); });
app.listen(port, () => console.log(`[v0] Examiner API listening on ${port}`));
