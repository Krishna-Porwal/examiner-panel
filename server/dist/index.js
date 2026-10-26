"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const dotenv = __importStar(require("dotenv"));
const node_path_1 = __importDefault(require("node:path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const envPath = node_path_1.default.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });
const LOCAL_MYSQL_URL = 'mysql://root:12345@127.0.0.1:3306/ipu_examiner';
const PRISMA_DATA_PROXY_ENV_KEYS = [
    'PRISMA_GENERATE_DATAPROXY',
    'PRISMA_GENERATE_ACCELERATE',
    'PRISMA_GENERATE_NO_ENGINE',
    'PRISMA_CLIENT_DATA_PROXY_CLIENT_VERSION',
    'PRISMA_CLIENT_ENGINE_TYPE',
];
function sanitizePrismaRuntimeEnvironment() {
    for (const key of PRISMA_DATA_PROXY_ENV_KEYS) {
        delete process.env[key];
    }
    const rawDatabaseUrl = (process.env.DATABASE_URL ?? '').trim();
    const hasPrismaDatasource = /^prisma(?:\+postgres)?:\/\//i.test(rawDatabaseUrl);
    if (!rawDatabaseUrl || hasPrismaDatasource) {
        process.env.DATABASE_URL = LOCAL_MYSQL_URL;
    }
}
sanitizePrismaRuntimeEnvironment();
const prisma = new client_1.PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
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
function facultyScope(req) { if (req.session?.role === 'CE')
    return {}; if (req.session?.role === 'CA' || req.session?.role === 'FAC')
    return { inst_short_name: req.session?.institute ?? '' }; return {}; }
function canAccessFacultyRecord(req, facultyRow) {
    if (!facultyRow)
        return false;
    if (req.session?.role === 'CE')
        return true;
    if (!req.session?.institute)
        return false;
    return facultyRow.inst_short_name === req.session.institute;
}
function enforceFacultyInstituteScope(req, pan) {
    if (req.session?.role === 'CE')
        return;
    if (!req.session?.institute)
        throw new Error('Institute scope is required');
    return { inst_short_name: req.session.institute };
}
function safe(row) { const copy = { ...row }; delete copy.password; return copy; }
function normalizeUserName(value) { return value.trim().toUpperCase().replace(/\s+/g, ''); }
async function resolveInstituteForUser(userName, role) {
    const normalized = normalizeUserName(userName);
    if (role === 'CE')
        return undefined;
    if (role === 'CA') {
        const institute = await findInstituteByCode(normalized);
        return institute?.inst_short_name ?? undefined;
    }
    const faculty = await findFacultyByPan(normalized);
    if (!faculty?.inst_short_name)
        return undefined;
    const institute = await findInstituteByCode(faculty.inst_short_name);
    return institute?.inst_short_name ?? undefined;
}
function normalizeCredentialPayload(payload) {
    const userName = normalizeUserName(payload.user_name);
    const password = payload.password.trim();
    if (!userName)
        throw new Error('Username is required.');
    if (password.length < 8)
        throw new Error('Password must be at least 8 characters long.');
    return { user_name: userName, password, role: payload.role };
}
async function findUserByCredential(user_name, role) {
    const normalizedUserName = normalizeUserName(user_name);
    const direct = await prisma.user.findUnique({
        where: { user_name_role: { user_name: normalizedUserName, role } }
    });
    if (direct)
        return direct;
    const rows = await prisma.user.findMany({ where: { role } });
    return rows.find(row => normalizeUserName(row.user_name) === normalizedUserName) ?? null;
}
async function findFacultyByPan(pan) {
    const normalizedPan = normalizeUserName(pan);
    const direct = await prisma.faculty.findUnique({ where: { PAN: normalizedPan } });
    if (direct)
        return direct;
    const rows = await prisma.faculty.findMany();
    return rows.find(row => normalizeUserName(row.PAN ?? '') === normalizedPan) ?? null;
}
async function findInstituteByCode(instShortName) {
    const normalized = normalizeUserName(instShortName);
    const direct = await prisma.institute.findUnique({ where: { inst_short_name: normalized } });
    if (direct)
        return direct;
    const rows = await prisma.institute.findMany();
    return rows.find(row => normalizeUserName(row.inst_short_name) === normalized) ?? null;
}
function requireInstituteSelection(req, instShortNames) {
    const selected = Array.from(new Set(instShortNames.map(value => String(value ?? '').trim()).filter(Boolean)));
    if (selected.length === 0) {
        if (req.session?.role === 'CA' && req.session.institute)
            return [req.session.institute];
        throw new Error('At least one institute is required.');
    }
    if (req.session?.role === 'CA') {
        const caInstitute = req.session?.institute;
        if (!caInstitute)
            throw new Error('College Admin is not mapped to an institute');
        return selected.filter(inst => inst === caInstitute);
    }
    return selected;
}
const prismaAny = prisma;
async function validateInstituteCourseAssociation(req, instShortName, courseCode) {
    const institute = await findInstituteByCode(instShortName);
    if (!institute)
        throw new Error(`Institute ${instShortName} does not exist`);
    const association = await prisma.instCourse.findUnique({
        where: {
            inst_short_name_course_code: {
                inst_short_name: institute.inst_short_name,
                course_code: courseCode,
            },
        },
    });
    if (!association) {
        if (req?.session?.role === 'CE') {
            return prisma.instCourse.upsert({
                where: {
                    inst_short_name_course_code: {
                        inst_short_name: institute.inst_short_name,
                        course_code: courseCode,
                    },
                },
                create: {
                    inst_short_name: institute.inst_short_name,
                    course_code: courseCode,
                },
                update: {},
            });
        }
        throw new Error(`Institute ${instShortName} is not mapped to course ${courseCode}`);
    }
    return association;
}
app.post('/api/auth/login', async (req, res) => {
    try {
        const parsed = zod_1.z.object({ user_name: zod_1.z.string().trim().min(1).max(10), role: zod_1.z.enum(['CE', 'CA', 'FAC']), password: zod_1.z.string().min(1) }).safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: 'Enter the username, role, and password.' });
        const user = await findUserByCredential(parsed.data.user_name, parsed.data.role);
        if (!user || !(await bcryptjs_1.default.compare(parsed.data.password.trim(), user.password)))
            return res.status(401).json({ error: 'Invalid username, role, or password.' });
        let institute;
        if (user.role === 'CA' || user.role === 'FAC') {
            institute = await resolveInstituteForUser(user.user_name, user.role);
            if (!institute)
                return res.status(401).json({ error: 'This account is not mapped to a valid institute.' });
        }
        const session = { user_name: user.user_name, role: user.role, institute };
        return res.json({ token: jsonwebtoken_1.default.sign(session, jwtSecret, { expiresIn: '8h' }), user: { user_name: user.user_name, role: user.role, institute } });
    }
    catch (error) {
        console.error('Login failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        const isDbIssue = /Authentication failed against the database server|Can't reach database server|Database .* does not exist|ECONNREFUSED|access denied|Client authentication|database/i.test(message);
        return res.status(isDbIssue ? 503 : 500).json({
            error: isDbIssue
                ? 'Database is unavailable. Check MySQL service and credentials.'
                : 'Login failed due to a server error.'
        });
    }
});
app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.session }));
app.post('/api/auth/logout', auth, (_req, res) => res.status(204).send());
app.get('/api/users', auth, allow('CE', 'CA'), async (req, res) => {
    const rows = await prisma.user.findMany({ orderBy: [{ role: 'asc' }, { user_name: 'asc' }] });
    if (req.session?.role === 'CE')
        return res.json(rows.map(row => ({ ...row, password: undefined })));
    const institute = req.session?.institute;
    if (!institute)
        return res.json([]);
    const allowedFaculty = await prisma.faculty.findMany({ where: { inst_short_name: institute }, select: { PAN: true } });
    const allowedPans = new Set(allowedFaculty.map(row => normalizeUserName(row.PAN)));
    const scoped = rows.filter(row => {
        if (row.role === 'CA')
            return row.user_name === institute;
        if (row.role === 'FAC')
            return allowedPans.has(normalizeUserName(row.user_name));
        return false;
    });
    return res.json(scoped.map(row => ({ ...row, password: undefined })));
});
app.post('/api/users', auth, allow('CE', 'CA'), async (req, res) => {
    const parsed = zod_1.z.object({ user_name: zod_1.z.string().trim().min(1).max(10), role: zod_1.z.enum(['CA', 'FAC']), password: zod_1.z.string().min(8) }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Enter the username, role, and password.' });
    const user_name = normalizeUserName(parsed.data.user_name);
    const role = parsed.data.role;
    const password = parsed.data.password.trim();
    if (req.session?.role === 'CA' && role === 'CA')
        return res.status(403).json({ error: 'College Admin cannot create another College Admin credential.' });
    if (role === 'CA') {
        const institute = await findInstituteByCode(user_name);
        if (!institute)
            return res.status(400).json({ error: 'Institute not found for this College Admin credential.' });
        if (req.session?.role === 'CA' && institute.inst_short_name !== req.session.institute)
            return res.status(403).json({ error: 'College Admin can only manage their own institute.' });
    }
    if (role === 'FAC') {
        const facultyRecord = await findFacultyByPan(user_name);
        if (!facultyRecord)
            return res.status(404).json({ error: 'Faculty record not found for this PAN.' });
        if (!facultyRecord.inst_short_name)
            return res.status(400).json({ error: 'Faculty is not assigned to a valid institute.' });
        const institute = await findInstituteByCode(facultyRecord.inst_short_name);
        if (!institute)
            return res.status(400).json({ error: 'Faculty institute does not exist in the system.' });
        if (req.session?.role === 'CA' && institute.inst_short_name !== req.session.institute)
            return res.status(403).json({ error: 'College Admin can only create faculty credentials for their institute.' });
    }
    const existing = await findUserByCredential(user_name, role);
    if (existing)
        return res.status(409).json({ error: 'A credential with this username and role already exists.' });
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    const created = await prisma.user.create({ data: { user_name: user_name, role, password: passwordHash } });
    return res.status(201).json({ user_name: created.user_name, role: created.role });
});
app.delete('/api/users/:user_name/:role', auth, allow('CE', 'CA'), async (req, res) => {
    const user_name = normalizeUserName(String(req.params.user_name));
    const role = String(req.params.role).toUpperCase();
    const validRole = role === 'CA' || role === 'FAC' ? role : null;
    if (!validRole)
        return res.status(400).json({ error: 'Invalid user role.' });
    const existing = await findUserByCredential(user_name, validRole);
    if (!existing)
        return res.status(404).json({ error: 'Credential not found.' });
    if (validRole === 'CA' && req.session?.role === 'CA')
        return res.status(403).json({ error: 'College Admin cannot revoke another College Admin credential.' });
    if (validRole === 'FAC' && req.session?.role === 'CA') {
        const facultyRecord = await findFacultyByPan(user_name);
        if (!facultyRecord || facultyRecord.inst_short_name !== req.session.institute) {
            return res.status(403).json({ error: 'College Admin can only revoke faculty credentials from their institute.' });
        }
    }
    await prisma.user.delete({ where: { user_name_role: { user_name: user_name, role: validRole } } });
    return res.status(204).send();
});
app.get('/api/faculty', auth, async (req, res) => { const rows = await prisma.faculty.findMany({ where: facultyScope(req), orderBy: { faculty_name: 'asc' } }); return res.json(rows); });
app.get('/api/faculty/:PAN', auth, async (req, res) => {
    const row = await prisma.faculty.findUnique({ where: { PAN: String(req.params.PAN) } });
    if (!row || !canAccessFacultyRecord(req, row))
        return res.status(404).json({ error: 'Faculty record not found' });
    return res.json(row);
});
app.post('/api/faculty', auth, allow('CE', 'CA', 'FAC'), async (req, res) => {
    const parsed = zod_1.z.object({ PAN: zod_1.z.string().trim().min(1).max(10), Title: zod_1.z.string().max(10).optional(), faculty_name: zod_1.z.string().max(50).optional(), inst_short_name: zod_1.z.string().max(10).optional(), faculty_desig: zod_1.z.string().max(25).optional(), faculty_total_exp: zod_1.z.coerce.number().int().optional(), faculty_address: zod_1.z.string().max(100).optional(), faculty_Email: zod_1.z.string().email().max(50).optional(), faculty_MobileNo: zod_1.z.string().max(10).optional() }).parse(req.body);
    if (req.session?.role === 'FAC') {
        if (!req.session.institute)
            return res.status(403).json({ error: 'College User is not associated with an institute' });
        if (parsed.inst_short_name && parsed.inst_short_name !== req.session.institute)
            return res.status(403).json({ error: 'College User can only add faculty to their institute' });
    }
    if (req.session?.role === 'CA' && parsed.inst_short_name && parsed.inst_short_name !== req.session.institute)
        return res.status(403).json({ error: 'Faculty must belong to your institute' });
    if (req.session?.role === 'CA' && (!parsed.inst_short_name || parsed.inst_short_name !== req.session.institute))
        return res.status(403).json({ error: 'Faculty must belong to your institute' });
    const existing = await prisma.faculty.findUnique({ where: { PAN: parsed.PAN } });
    if (existing)
        return res.status(409).json({ error: 'A faculty record with this PAN already exists' });
    const targetInstitute = req.session?.role === 'CA' || req.session?.role === 'FAC' ? req.session.institute : parsed.inst_short_name;
    if (!targetInstitute)
        return res.status(400).json({ error: 'Institute is required for this faculty record.' });
    const instituteExists = await findInstituteByCode(targetInstitute);
    if (!instituteExists)
        return res.status(400).json({ error: 'Faculty institute must match a real institute code.' });
    const data = { ...parsed, inst_short_name: targetInstitute, entered_by: req.session?.user_name, entered_on: new Date() };
    return res.status(201).json(await prisma.faculty.create({ data }));
});
app.put('/api/faculty/:PAN', auth, allow('CE', 'CA', 'FAC'), async (req, res) => {
    const pan = String(req.params.PAN);
    const existing = await prisma.faculty.findUnique({ where: { PAN: pan } });
    if (!existing)
        return res.status(404).json({ error: 'Faculty record not found' });
    if (req.session?.role === 'FAC') {
        if (existing.inst_short_name !== req.session.institute)
            return res.status(403).json({ error: 'Faculty not found in your institute' });
        if (req.body?.inst_short_name && String(req.body.inst_short_name) !== (existing.inst_short_name ?? ''))
            return res.status(403).json({ error: 'Your institute is locked and cannot be changed' });
        if (typeof req.body.PAN === 'string' && req.body.PAN !== pan)
            return res.status(403).json({ error: 'Faculty PAN cannot be changed' });
    }
    if (req.session?.role === 'CA' && existing.inst_short_name !== req.session.institute)
        return res.status(403).json({ error: 'Faculty not found in your institute' });
    const parsed = zod_1.z.object({
        Title: zod_1.z.string().max(10).optional(),
        faculty_name: zod_1.z.string().max(50).optional(),
        faculty_desig: zod_1.z.string().max(25).optional(),
        faculty_total_exp: zod_1.z.coerce.number().int().optional(),
        faculty_address: zod_1.z.string().max(100).optional(),
        faculty_Email: zod_1.z.string().email().max(50).optional(),
        faculty_MobileNo: zod_1.z.string().max(10).optional(),
    }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid faculty details', details: parsed.error.issues.map(issue => issue.message) });
    return res.json(await prisma.faculty.update({
        where: { PAN: pan },
        data: { ...parsed.data, entered_by: req.session?.user_name, entered_on: new Date() },
    }));
});
const mappingModels = {
    'institute-courses': 'instCourse',
    'institute-specializations': 'instSpec',
    'course-subjects': 'courseSubject',
    'faculty-subjects': 'facultySubject',
    'faculty-specializations': 'facultySpec',
};
app.get('/api/mappings/:type', auth, async (req, res) => {
    const model = mappingModels[String(req.params.type)];
    if (!model)
        return res.status(404).json({ error: 'Unknown mapping type' });
    const rows = await prisma[model].findMany();
    if (req.session?.role === 'FAC' && req.session.institute) {
        if (model === 'facultySubject' || model === 'facultySpec') {
            const allowed = await prisma.faculty.findMany({ where: { inst_short_name: req.session.institute }, select: { PAN: true } });
            const panSet = new Set(allowed.map(row => row.PAN));
            return res.json(rows.filter((row) => panSet.has(row.PAN)));
        }
        return res.json(rows);
    }
    if (req.session?.role === 'CA' && model.startsWith('faculty'))
        return res.json(rows.filter((row) => row.PAN && false));
    return res.json(rows);
});
app.post('/api/mappings/:type', auth, allow('CE', 'CA', 'FAC'), async (req, res) => {
    const model = mappingModels[String(req.params.type)];
    if (!model)
        return res.status(404).json({ error: 'Unknown mapping type' });
    if (req.session?.role === 'FAC' && !['faculty-subjects', 'faculty-specializations'].includes(String(req.params.type)))
        return res.status(403).json({ error: 'Faculty cannot manage this mapping' });
    if (req.session?.role === 'FAC') {
        const targetPan = String(req.body.PAN ?? '');
        const targetFaculty = await prisma.faculty.findUnique({ where: { PAN: targetPan } });
        if (!targetFaculty || targetFaculty.inst_short_name !== req.session.institute)
            return res.status(403).json({ error: 'Faculty can only manage mappings in their institute' });
    }
    const data = { ...req.body, entered_by: req.session?.user_name, entered_on: new Date() };
    return res.status(201).json(await prisma[model].create({ data }));
});
app.get('/api/faculty-subjects', auth, async (req, res) => {
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
    return res.json(rows);
});
app.post('/api/faculty-subjects', auth, allow('CE', 'CA', 'FAC'), async (req, res) => {
    const parsed = zod_1.z.object({ PAN: zod_1.z.string().trim().min(1).max(10), subject_code: zod_1.z.string().trim().min(1).max(10) }).parse(req.body);
    if (req.session?.role === 'FAC') {
        const facultyRow = await prisma.faculty.findUnique({ where: { PAN: parsed.PAN } });
        if (!facultyRow || facultyRow.inst_short_name !== req.session.institute)
            return res.status(403).json({ error: 'Faculty must belong to your institute' });
    }
    else if (req.session?.role === 'CA') {
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
    if (req.session?.role === 'FAC') {
        const institute = req.session.institute;
        if (!institute || facultyRow.inst_short_name !== institute)
            return res.status(403).json({ error: 'Faculty must belong to your institute' });
        const [directMapping, courseMapping] = await Promise.all([
            prismaAny.instCourseSubject.findFirst({
                where: { inst_short_name: institute, subject_code: parsed.subject_code },
                select: { subject_code: true },
            }),
            prisma.courseSubject.findFirst({
                where: { subject_code: parsed.subject_code, course: { institutes: { some: { inst_short_name: institute } } } },
                select: { subject_code: true },
            }),
        ]);
        if (!directMapping && !courseMapping)
            return res.status(403).json({ error: 'Subject is not assigned to your institute' });
    }
    const existing = await prisma.facultySubject.findUnique({ where: { PAN_subject_code: { PAN: parsed.PAN, subject_code: parsed.subject_code } } });
    if (existing)
        return res.status(409).json({ error: 'Subject mapping already exists' });
    return res.status(201).json(await prisma.facultySubject.create({ data: { PAN: parsed.PAN, subject_code: parsed.subject_code, entered_by: req.session?.user_name ?? parsed.PAN, entered_on: new Date() } }));
});
app.delete('/api/faculty-subjects/:PAN/:subject_code', auth, allow('CE', 'CA', 'FAC'), async (req, res) => {
    const pan = String(req.params.PAN);
    const subjectCode = String(req.params.subject_code);
    if (req.session?.role === 'FAC') {
        const facultyRow = await prisma.faculty.findUnique({ where: { PAN: pan } });
        if (!facultyRow || facultyRow.inst_short_name !== req.session.institute)
            return res.status(403).json({ error: 'Faculty must belong to your institute' });
    }
    else if (req.session?.role === 'CA') {
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
    return res.json(rows);
});
app.post('/api/faculty-specializations', auth, allow('CE', 'CA', 'FAC'), async (req, res) => {
    const parsed = zod_1.z.object({ PAN: zod_1.z.string().trim().min(1).max(10), spec_id: zod_1.z.coerce.number().int().min(1) }).parse(req.body);
    if (req.session?.role === 'FAC') {
        const facultyRow = await prisma.faculty.findUnique({ where: { PAN: parsed.PAN } });
        if (!facultyRow || facultyRow.inst_short_name !== req.session.institute)
            return res.status(403).json({ error: 'Faculty must belong to your institute' });
    }
    else if (req.session?.role === 'CA') {
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
    if (req.session?.role === 'FAC') {
        const institute = req.session.institute;
        if (!institute || facultyRow.inst_short_name !== institute)
            return res.status(403).json({ error: 'Faculty must belong to your institute' });
        const instituteMapping = await prisma.instSpec.findUnique({
            where: { inst_short_name_spec_id: { inst_short_name: institute, spec_id: parsed.spec_id } },
        });
        if (!instituteMapping)
            return res.status(403).json({ error: 'Specialization is not assigned to your institute' });
    }
    const existing = await prisma.facultySpec.findUnique({ where: { PAN_spec_id: { PAN: parsed.PAN, spec_id: parsed.spec_id } } });
    if (existing)
        return res.status(409).json({ error: 'Specialization mapping already exists' });
    return res.status(201).json(await prisma.facultySpec.create({ data: { PAN: parsed.PAN, spec_id: parsed.spec_id, entered_by: req.session?.user_name ?? parsed.PAN, entered_on: new Date() } }));
});
app.delete('/api/faculty-specializations/:PAN/:spec_id', auth, allow('CE', 'CA', 'FAC'), async (req, res) => {
    const pan = String(req.params.PAN);
    const specId = Number(req.params.spec_id);
    if (req.session?.role === 'FAC') {
        const facultyRow = await prisma.faculty.findUnique({ where: { PAN: pan } });
        if (!facultyRow || facultyRow.inst_short_name !== req.session.institute)
            return res.status(403).json({ error: 'Faculty must belong to your institute' });
    }
    else if (req.session?.role === 'CA') {
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
app.delete('/api/faculty/:PAN', auth, allow('CE'), async (req, res) => {
    const pan = String(req.params.PAN);
    const existing = await prisma.faculty.findUnique({ where: { PAN: pan } });
    if (!existing)
        return res.status(404).json({ error: 'Faculty not found' });
    try {
        await prisma.$transaction(async (tx) => {
            await tx.facultySubject.deleteMany({ where: { PAN: pan } });
            await tx.facultySpec.deleteMany({ where: { PAN: pan } });
            await tx.user.deleteMany({ where: { user_name: pan, role: 'FAC' } });
            await tx.faculty.delete({ where: { PAN: pan } });
        });
        return res.status(204).send();
    }
    catch {
        return res.status(400).json({ error: 'Cannot delete faculty at this time' });
    }
});
app.delete('/api/institutes/:inst_short_name', auth, allow('CE'), async (req, res) => {
    const instShortName = String(req.params.inst_short_name);
    const existing = await prisma.institute.findUnique({ where: { inst_short_name: instShortName } });
    if (!existing)
        return res.status(404).json({ error: 'Institute not found' });
    try {
        await prisma.$transaction(async (tx) => {
            const facultyList = await tx.faculty.findMany({ where: { inst_short_name: instShortName } });
            const facultyPanList = facultyList.map(row => row.PAN);
            if (facultyPanList.length > 0) {
                await tx.facultySubject.deleteMany({ where: { PAN: { in: facultyPanList } } });
                await tx.facultySpec.deleteMany({ where: { PAN: { in: facultyPanList } } });
                await tx.user.deleteMany({ where: { user_name: { in: facultyPanList }, role: 'FAC' } });
            }
            await tx.faculty.deleteMany({ where: { inst_short_name: instShortName } });
            await tx.instCourse.deleteMany({ where: { inst_short_name: instShortName } });
            await tx.user.deleteMany({ where: { user_name: instShortName, role: 'CA' } });
            await tx.institute.delete({ where: { inst_short_name: instShortName } });
        });
        return res.status(204).send();
    }
    catch {
        return res.status(400).json({ error: 'Cannot delete institute at this time' });
    }
});
function ensureInstituteAccess(req, institute) {
    if (req.session?.role === 'CE')
        return true;
    if (!req.session?.institute || !institute)
        return false;
    return req.session.institute === institute;
}
app.get('/api/institutes', auth, async (req, res) => {
    const rows = await prisma.institute.findMany({ orderBy: { inst_short_name: 'asc' } });
    if (req.session?.role === 'CA' || req.session?.role === 'FAC') {
        const institute = req.session.institute;
        return res.json(rows.filter(row => row.inst_short_name === institute));
    }
    return res.json(rows);
});
app.post('/api/institutes', auth, allow('CE', 'CA'), async (req, res) => {
    const parsed = zod_1.z.object({
        inst_short_name: zod_1.z.string().trim().min(1).max(10),
        inst_full_name: zod_1.z.string().trim().max(100).optional(),
        inst_Address1: zod_1.z.string().trim().max(100).optional(),
        inst_Address2: zod_1.z.string().trim().max(100).optional(),
        inst_District: zod_1.z.string().trim().max(50).optional(),
        inst_State: zod_1.z.string().trim().max(50).optional(),
        Landline_PhoneNo: zod_1.z.string().trim().max(20).optional(),
        Director_Name: zod_1.z.string().trim().max(50).optional(),
        Director_Desig: zod_1.z.string().trim().max(25).optional(),
        Director_Email: zod_1.z.string().trim().email().max(50).optional(),
        Director_MobileNo: zod_1.z.string().trim().max(10).optional(),
        ExamHead_Name: zod_1.z.string().trim().max(50).optional(),
        ExamHead_Desig: zod_1.z.string().trim().max(25).optional(),
        ExamHead_Email: zod_1.z.string().trim().email().max(50).optional(),
        ExamHead_MobileNo: zod_1.z.string().trim().max(10).optional(),
    }).parse(req.body);
    if (req.session?.role === 'CA') {
        if (!req.session.institute)
            return res.status(403).json({ error: 'College Admin is not mapped to an institute' });
        if (parsed.inst_short_name !== req.session.institute)
            return res.status(403).json({ error: 'College Admin can only manage their own institute' });
    }
    const normalized = normalizeUserName(parsed.inst_short_name);
    const existing = await prisma.institute.findUnique({ where: { inst_short_name: normalized } });
    if (existing)
        return res.status(409).json({ error: 'Institute already exists' });
    const created = await prisma.institute.create({ data: { ...parsed, inst_short_name: normalized } });
    return res.status(201).json(created);
});
app.put('/api/institutes/:inst_short_name', auth, allow('CE', 'CA'), async (req, res) => {
    const instShortName = normalizeUserName(String(req.params.inst_short_name));
    const existing = await prisma.institute.findUnique({ where: { inst_short_name: instShortName } });
    if (!existing)
        return res.status(404).json({ error: 'Institute not found' });
    if (req.session?.role === 'CA' && !ensureInstituteAccess(req, instShortName))
        return res.status(403).json({ error: 'College Admin can only update their institute' });
    const parsed = zod_1.z.object({
        inst_short_name: zod_1.z.string().trim().max(10).optional(),
        inst_full_name: zod_1.z.string().trim().max(100).optional(),
        inst_Address1: zod_1.z.string().trim().max(100).optional(),
        inst_Address2: zod_1.z.string().trim().max(100).optional(),
        inst_District: zod_1.z.string().trim().max(50).optional(),
        inst_State: zod_1.z.string().trim().max(50).optional(),
        Landline_PhoneNo: zod_1.z.string().trim().max(20).optional(),
        Director_Name: zod_1.z.string().trim().max(50).optional(),
        Director_Desig: zod_1.z.string().trim().max(25).optional(),
        Director_Email: zod_1.z.string().trim().email().max(50).optional(),
        Director_MobileNo: zod_1.z.string().trim().max(10).optional(),
        ExamHead_Name: zod_1.z.string().trim().max(50).optional(),
        ExamHead_Desig: zod_1.z.string().trim().max(25).optional(),
        ExamHead_Email: zod_1.z.string().trim().email().max(50).optional(),
        ExamHead_MobileNo: zod_1.z.string().trim().max(10).optional(),
    }).parse(req.body);
    const updateData = { ...parsed };
    if (parsed.inst_short_name)
        updateData.inst_short_name = normalizeUserName(parsed.inst_short_name);
    const updated = await prisma.institute.update({
        where: { inst_short_name: instShortName },
        data: updateData,
    });
    return res.json(updated);
});
app.get('/api/institutes/:inst_short_name', auth, async (req, res) => {
    const instShortName = normalizeUserName(String(req.params.inst_short_name));
    const row = await prisma.institute.findUnique({ where: { inst_short_name: instShortName } });
    if (!row)
        return res.status(404).json({ error: 'Institute not found' });
    if (req.session?.role === 'CA' || req.session?.role === 'FAC') {
        if (!ensureInstituteAccess(req, row.inst_short_name))
            return res.status(404).json({ error: 'Institute not found' });
    }
    return res.json(row);
});
app.get('/api/courses', auth, async (req, res) => {
    let rows = await prisma.course.findMany({ orderBy: { course_code: 'asc' } });
    if (req.session?.role === 'CA' || req.session?.role === 'FAC') {
        const inst = req.session.institute;
        if (!inst)
            return res.json([]);
        const instCourseCodes = new Set((await prisma.instCourse.findMany({ where: { inst_short_name: inst }, select: { course_code: true } })).map(item => item.course_code));
        const instituteCourseSubjectRows = await prismaAny.instCourseSubject.findMany({ where: { inst_short_name: inst }, select: { course_code: true } });
        for (const row of instituteCourseSubjectRows)
            instCourseCodes.add(row.course_code);
        rows = rows.filter(row => instCourseCodes.has(row.course_code));
    }
    return res.json(rows);
});
app.post('/api/courses', auth, allow('CE'), async (req, res) => {
    const parsed = zod_1.z.object({
        course_code: zod_1.z.string().trim().min(1),
        course_short_name: zod_1.z.string().trim().max(10).optional(),
        course_full_name: zod_1.z.string().trim().max(100).optional(),
    }).parse(req.body);
    const courseCode = parsed.course_code.trim().toUpperCase();
    const courseShortName = parsed.course_short_name?.trim();
    const courseFullName = parsed.course_full_name?.trim();
    if (!courseCode)
        return res.status(400).json({ error: 'Course code is required' });
    const existing = await prisma.course.findUnique({ where: { course_code: courseCode } });
    if (existing)
        return res.status(409).json({ error: 'Course already exists' });
    const created = await prisma.course.create({ data: { course_code: courseCode, course_short_name: courseShortName, course_full_name: courseFullName } });
    return res.status(201).json(created);
});
app.put('/api/courses/:course_code', auth, allow('CE'), async (req, res) => {
    const courseCode = String(req.params.course_code).trim().toUpperCase();
    const existing = await prisma.course.findUnique({ where: { course_code: courseCode } });
    if (!existing)
        return res.status(404).json({ error: 'Course not found' });
    const parsed = zod_1.z.object({
        course_code: zod_1.z.string().trim().min(1).optional(),
        course_short_name: zod_1.z.string().trim().max(10).optional(),
        course_full_name: zod_1.z.string().trim().max(100).optional(),
    }).parse(req.body);
    const nextCode = (parsed.course_code ?? courseCode).trim().toUpperCase();
    if (nextCode !== courseCode) {
        const codeConflict = await prisma.course.findUnique({ where: { course_code: nextCode } });
        if (codeConflict)
            return res.status(409).json({ error: 'Course code already exists' });
    }
    const data = { ...parsed, course_code: nextCode, course_short_name: parsed.course_short_name?.trim(), course_full_name: parsed.course_full_name?.trim() };
    const updated = await prisma.course.update({ where: { course_code: courseCode }, data });
    return res.json(updated);
});
app.delete('/api/courses/:course_code', auth, allow('CE'), async (req, res) => {
    const courseCode = String(req.params.course_code).trim().toUpperCase();
    const existing = await prisma.course.findUnique({ where: { course_code: courseCode } });
    if (!existing)
        return res.status(404).json({ error: 'Course not found' });
    await prisma.$transaction(async (tx) => {
        await tx.courseSubject.deleteMany({ where: { course_code: courseCode } });
        await tx.instCourse.deleteMany({ where: { course_code: courseCode } });
        await tx.course.delete({ where: { course_code: courseCode } });
    });
    return res.status(204).send();
});
app.get('/api/subjects', auth, async (req, res) => {
    let rows = await prisma.subject.findMany({ orderBy: { subject_code: 'asc' } });
    if (req.session?.role === 'CA' || req.session?.role === 'FAC') {
        const inst = req.session.institute;
        if (!inst)
            return res.json([]);
        const courseCodes = new Set((await prisma.instCourse.findMany({ where: { inst_short_name: inst }, select: { course_code: true } })).map(item => item.course_code));
        for (const row of await prismaAny.instCourseSubject.findMany({ where: { inst_short_name: inst }, select: { course_code: true } })) {
            courseCodes.add(row.course_code);
        }
        const subjectCodes = new Set((await prisma.courseSubject.findMany({ where: { course_code: { in: [...courseCodes] } }, select: { subject_code: true } })).map(item => item.subject_code));
        for (const row of await prismaAny.instCourseSubject.findMany({ where: { inst_short_name: inst }, select: { subject_code: true } })) {
            subjectCodes.add(row.subject_code);
        }
        rows = rows.filter(row => subjectCodes.has(row.subject_code));
    }
    return res.json(rows);
});
app.post('/api/subjects', auth, allow('CE', 'CA'), async (req, res) => {
    const parsed = zod_1.z.object({
        subject_code: zod_1.z.string().trim().min(1).max(10),
        sub_subject_codes: zod_1.z.string().trim().max(100).optional(),
        subject_short_name: zod_1.z.string().trim().max(10).optional(),
        subject_full_name: zod_1.z.string().trim().max(100).optional(),
        semester: zod_1.z.coerce.number().int().min(1).max(12).optional(),
        spec_id: zod_1.z.coerce.number().int().min(1).max(255).optional(),
    }).parse(req.body);
    if (req.session?.role === 'CA')
        return res.status(403).json({ error: 'College Admin cannot create global subject records.' });
    const subjectCode = parsed.subject_code.trim().toUpperCase();
    const existing = await prisma.subject.findUnique({ where: { subject_code: subjectCode } });
    if (existing)
        return res.status(409).json({ error: 'Subject already exists' });
    const created = await prisma.subject.create({
        data: {
            subject_code: subjectCode,
            sub_subject_codes: parsed.sub_subject_codes?.trim(),
            subject_short_name: parsed.subject_short_name?.trim(),
            subject_full_name: parsed.subject_full_name?.trim(),
            semester: parsed.semester,
            spec_id: parsed.spec_id,
        },
    });
    return res.status(201).json(created);
});
app.put('/api/subjects/:subject_code', auth, allow('CE', 'CA'), async (req, res) => {
    const subjectCode = String(req.params.subject_code).trim().toUpperCase();
    const existing = await prisma.subject.findUnique({ where: { subject_code: subjectCode } });
    if (!existing)
        return res.status(404).json({ error: 'Subject not found' });
    if (req.session?.role === 'CA') {
        const inst = req.session.institute;
        if (!inst)
            return res.status(403).json({ error: 'College Admin is not mapped to an institute' });
        const allowedCourseCodes = (await prisma.instCourse.findMany({ where: { inst_short_name: inst }, select: { course_code: true } })).map(item => item.course_code);
        const courseLinks = await prisma.courseSubject.findMany({ where: { subject_code: subjectCode, course_code: { in: allowedCourseCodes } }, select: { course_code: true } });
        if (courseLinks.length === 0)
            return res.status(403).json({ error: 'College Admin can only edit subjects in their institute' });
    }
    const parsed = zod_1.z.object({
        subject_code: zod_1.z.string().trim().min(1).max(10).optional(),
        sub_subject_codes: zod_1.z.string().trim().max(100).optional(),
        subject_short_name: zod_1.z.string().trim().max(10).optional(),
        subject_full_name: zod_1.z.string().trim().max(100).optional(),
        semester: zod_1.z.coerce.number().int().min(1).max(12).optional(),
        spec_id: zod_1.z.coerce.number().int().min(1).max(255).optional(),
    }).parse(req.body);
    if (req.session?.role === 'CA' && parsed.subject_code && parsed.subject_code.trim().toUpperCase() !== subjectCode)
        return res.status(403).json({ error: 'College Admin cannot change subject code' });
    const nextCode = (parsed.subject_code ?? subjectCode).trim().toUpperCase();
    if (nextCode !== subjectCode) {
        const codeConflict = await prisma.subject.findUnique({ where: { subject_code: nextCode } });
        if (codeConflict)
            return res.status(409).json({ error: 'Subject code already exists' });
    }
    const updated = await prisma.subject.update({ where: { subject_code: subjectCode }, data: { ...parsed, subject_code: nextCode, sub_subject_codes: parsed.sub_subject_codes?.trim(), subject_short_name: parsed.subject_short_name?.trim(), subject_full_name: parsed.subject_full_name?.trim() } });
    return res.json(updated);
});
app.delete('/api/subjects/:subject_code', auth, allow('CE'), async (req, res) => {
    const subjectCode = String(req.params.subject_code).trim().toUpperCase();
    const existing = await prisma.subject.findUnique({ where: { subject_code: subjectCode } });
    if (!existing)
        return res.status(404).json({ error: 'Subject not found' });
    await prisma.$transaction(async (tx) => {
        await tx.facultySubject.deleteMany({ where: { subject_code: subjectCode } });
        await tx.courseSubject.deleteMany({ where: { subject_code: subjectCode } });
        await tx.subject.findMany({ where: { subject_code: subjectCode }, select: { spec_id: true } }).then((rows) => {
            const ids = rows.map(item => item.spec_id).filter((id) => id !== null);
            if (ids.length > 0) {
                return tx.instSpec.deleteMany({ where: { spec_id: { in: ids } } });
            }
            return null;
        });
        await tx.subject.delete({ where: { subject_code: subjectCode } });
    });
    return res.status(204).send();
});
app.get('/api/specializations', auth, async (req, res) => {
    let rows = await prisma.specialization.findMany({ orderBy: { spec_id: 'asc' } });
    if (req.session?.role === 'CA' || req.session?.role === 'FAC') {
        const inst = req.session.institute;
        if (!inst)
            return res.json([]);
        const allowedIds = new Set((await prisma.instSpec.findMany({ where: { inst_short_name: inst }, select: { spec_id: true } })).map(item => item.spec_id));
        rows = rows.filter(row => allowedIds.has(row.spec_id));
    }
    return res.json(rows);
});
app.post('/api/specializations', auth, allow('CE'), async (req, res) => {
    const parsed = zod_1.z.object({ spec_id: zod_1.z.coerce.number().int().min(1).max(255), spec_name: zod_1.z.string().trim().max(30).optional() }).parse(req.body);
    const existing = await prisma.specialization.findUnique({ where: { spec_id: parsed.spec_id } });
    if (existing)
        return res.status(409).json({ error: 'Specialization already exists' });
    const created = await prisma.specialization.create({ data: { spec_id: parsed.spec_id, spec_name: parsed.spec_name?.trim() } });
    return res.status(201).json(created);
});
app.put('/api/specializations/:spec_id', auth, allow('CE', 'CA'), async (req, res) => {
    const specId = Number(req.params.spec_id);
    const existing = await prisma.specialization.findUnique({ where: { spec_id: specId } });
    if (!existing)
        return res.status(404).json({ error: 'Specialization not found' });
    if (req.session?.role === 'CA') {
        const inst = req.session.institute;
        if (!inst)
            return res.status(403).json({ error: 'College Admin is not mapped to an institute' });
        const allowed = await prisma.instSpec.findUnique({ where: { inst_short_name_spec_id: { inst_short_name: inst, spec_id: specId } } });
        if (!allowed)
            return res.status(403).json({ error: 'College Admin can only edit specializations assigned to their institute' });
    }
    const parsed = zod_1.z.object({ spec_id: zod_1.z.coerce.number().int().min(1).max(255).optional(), spec_name: zod_1.z.string().trim().max(30).optional() }).parse(req.body);
    if (req.session?.role === 'CA' && parsed.spec_id !== undefined && parsed.spec_id !== specId)
        return res.status(403).json({ error: 'College Admin cannot change specialization ID' });
    if (parsed.spec_id !== undefined && parsed.spec_id !== specId) {
        const idConflict = await prisma.specialization.findUnique({ where: { spec_id: parsed.spec_id } });
        if (idConflict)
            return res.status(409).json({ error: 'Specialization ID already exists' });
    }
    const updated = await prisma.specialization.update({ where: { spec_id: specId }, data: { spec_name: parsed.spec_name?.trim() ?? existing.spec_name, spec_id: parsed.spec_id ?? specId } });
    return res.json(updated);
});
app.delete('/api/specializations/:spec_id', auth, allow('CE'), async (req, res) => {
    const specId = Number(req.params.spec_id);
    const existing = await prisma.specialization.findUnique({ where: { spec_id: specId } });
    if (!existing)
        return res.status(404).json({ error: 'Specialization not found' });
    await prisma.$transaction(async (tx) => {
        await tx.facultySpec.deleteMany({ where: { spec_id: specId } });
        await tx.instSpec.deleteMany({ where: { spec_id: specId } });
        await tx.subject.updateMany({ where: { spec_id: specId }, data: { spec_id: null } });
        await tx.specialization.delete({ where: { spec_id: specId } });
    });
    return res.status(204).send();
});
app.get('/api/inst-specializations', auth, async (req, res) => {
    let rows = await prisma.instSpec.findMany({ orderBy: [{ inst_short_name: 'asc' }, { spec_id: 'asc' }] });
    if (req.session?.role === 'CA' || req.session?.role === 'FAC') {
        const inst = req.session.institute;
        if (!inst)
            return res.json([]);
        rows = rows.filter(row => row.inst_short_name === inst);
    }
    return res.json(rows);
});
app.post('/api/inst-specializations', auth, allow('CE'), async (req, res) => {
    const parsed = zod_1.z.object({ inst_short_name: zod_1.z.string().trim().min(1).max(10), spec_id: zod_1.z.coerce.number().int().min(1).max(255) }).parse(req.body);
    const institute = await findInstituteByCode(parsed.inst_short_name);
    if (!institute)
        return res.status(400).json({ error: 'Institute does not exist' });
    const specialization = await prisma.specialization.findUnique({ where: { spec_id: parsed.spec_id } });
    if (!specialization)
        return res.status(404).json({ error: 'Specialization not found' });
    const existing = await prisma.instSpec.findUnique({ where: { inst_short_name_spec_id: { inst_short_name: institute.inst_short_name, spec_id: parsed.spec_id } } });
    if (existing)
        return res.status(409).json({ error: 'Institute-specialization mapping already exists' });
    const created = await prisma.instSpec.create({ data: { inst_short_name: institute.inst_short_name, spec_id: parsed.spec_id } });
    return res.status(201).json(created);
});
app.delete('/api/inst-specializations/:inst_short_name/:spec_id', auth, allow('CE'), async (req, res) => {
    const instShortName = normalizeUserName(String(req.params.inst_short_name));
    const specId = Number(req.params.spec_id);
    const existing = await prisma.instSpec.findUnique({ where: { inst_short_name_spec_id: { inst_short_name: instShortName, spec_id: specId } } });
    if (!existing)
        return res.status(404).json({ error: 'Institute-specialization mapping not found' });
    await prisma.instSpec.delete({ where: { inst_short_name_spec_id: { inst_short_name: instShortName, spec_id: specId } } });
    return res.status(204).send();
});
app.get('/api/inst-courses', auth, async (req, res) => {
    let rows = await prisma.instCourse.findMany({ orderBy: [{ inst_short_name: 'asc' }, { course_code: 'asc' }] });
    if (req.session?.role === 'CA' || req.session?.role === 'FAC') {
        const inst = req.session.institute;
        if (!inst)
            return res.json([]);
        rows = rows.filter(row => row.inst_short_name === inst);
    }
    return res.json(rows);
});
app.post('/api/inst-courses', auth, allow('CE', 'CA'), async (req, res) => {
    const parsed = zod_1.z.object({ inst_short_name: zod_1.z.string().trim().min(1).max(10), course_code: zod_1.z.string().trim().min(1), intake: zod_1.z.coerce.number().int().min(0).optional(), strength: zod_1.z.coerce.number().int().min(0).optional() }).parse(req.body);
    if (req.session?.role === 'CA') {
        if (!req.session.institute)
            return res.status(403).json({ error: 'College Admin is not mapped to an institute' });
        if (parsed.inst_short_name !== req.session.institute)
            return res.status(403).json({ error: 'College Admin can only manage their institute' });
    }
    const institute = await findInstituteByCode(parsed.inst_short_name);
    if (!institute)
        return res.status(400).json({ error: 'Institute does not exist' });
    const course = await prisma.course.findUnique({ where: { course_code: parsed.course_code.trim().toUpperCase() } });
    if (!course)
        return res.status(404).json({ error: 'Course not found' });
    const existing = await prisma.instCourse.findUnique({ where: { inst_short_name_course_code: { inst_short_name: institute.inst_short_name, course_code: course.course_code } } });
    if (existing)
        return res.status(409).json({ error: 'Institute-course mapping already exists' });
    const created = await prisma.instCourse.create({ data: { inst_short_name: institute.inst_short_name, course_code: course.course_code, intake: parsed.intake, strength: parsed.strength } });
    return res.status(201).json(created);
});
app.delete('/api/inst-courses/:inst_short_name/:course_code', auth, allow('CE', 'CA'), async (req, res) => {
    const instShortName = normalizeUserName(String(req.params.inst_short_name));
    const courseCode = String(req.params.course_code).trim().toUpperCase();
    if (req.session?.role === 'CA' && !ensureInstituteAccess(req, instShortName))
        return res.status(403).json({ error: 'College Admin can only delete mappings for their institute' });
    const existing = await prisma.instCourse.findUnique({ where: { inst_short_name_course_code: { inst_short_name: instShortName, course_code: courseCode } } });
    if (!existing)
        return res.status(404).json({ error: 'Institute-course mapping not found' });
    await prisma.instCourse.delete({ where: { inst_short_name_course_code: { inst_short_name: instShortName, course_code: courseCode } } });
    return res.status(204).send();
});
app.get('/api/course-subjects', auth, async (req, res) => {
    let rows = await prisma.courseSubject.findMany({
        orderBy: [{ course_code: 'asc' }, { subject_code: 'asc' }],
        include: { subject: true },
    });
    if (req.session?.role === 'CA' || req.session?.role === 'FAC') {
        const inst = req.session.institute;
        if (!inst)
            return res.json([]);
        const allowedCourseCodes = (await prisma.instCourse.findMany({ where: { inst_short_name: inst }, select: { course_code: true } })).map(item => item.course_code);
        rows = rows.filter(row => allowedCourseCodes.includes(row.course_code));
    }
    const associationRows = await prismaAny.instCourseSubject.findMany({
        where: req.session?.role === 'CE' ? {} : { inst_short_name: req.session?.institute ?? '' },
        include: { institute: true },
    });
    const associationMap = new Map();
    for (const row of associationRows) {
        const key = `${row.course_code}|${row.subject_code}`;
        const entry = associationMap.get(key) ?? { inst_short_names: [], institutes: [] };
        entry.inst_short_names.push(row.inst_short_name);
        entry.institutes.push(row.institute);
        associationMap.set(key, entry);
    }
    return res.json(rows.map(row => ({
        ...row,
        subject: row.subject,
        inst_short_names: associationMap.get(`${row.course_code}|${row.subject_code}`)?.inst_short_names ?? [],
        institutes: associationMap.get(`${row.course_code}|${row.subject_code}`)?.institutes ?? [],
    })));
});
app.post('/api/course-subjects', auth, allow('CE', 'CA'), async (req, res) => {
    try {
        const parsed = zod_1.z.object({
            course_code: zod_1.z.string().trim().min(1),
            subject_code: zod_1.z.string().trim().min(1).max(10),
            study_year: zod_1.z.coerce.number().int().min(1).max(8).optional(),
            semester: zod_1.z.coerce.number().int().min(1).max(12).optional(),
            inst_short_names: zod_1.z.array(zod_1.z.string().trim().min(1).max(10)).optional(),
        }).parse(req.body);
        const courseCode = parsed.course_code.trim().toUpperCase();
        const subjectCode = parsed.subject_code.trim().toUpperCase();
        const instShortNames = requireInstituteSelection(req, parsed.inst_short_names ?? []);
        const course = await prisma.course.findUnique({ where: { course_code: courseCode } });
        if (!course)
            return res.status(404).json({ error: 'Course not found' });
        const subject = await prisma.subject.findUnique({ where: { subject_code: subjectCode } });
        if (!subject)
            return res.status(404).json({ error: 'Subject not found' });
        if (req.session?.role === 'CA') {
            const inst = req.session.institute;
            if (!inst)
                return res.status(403).json({ error: 'College Admin is not mapped to an institute' });
            const allowed = await prisma.instCourse.findUnique({ where: { inst_short_name_course_code: { inst_short_name: inst, course_code: courseCode } } });
            if (!allowed)
                return res.status(403).json({ error: 'College Admin can only map subjects for their institute' });
        }
        const existing = await prisma.courseSubject.findUnique({ where: { course_code_subject_code: { course_code: courseCode, subject_code: subjectCode } } });
        if (existing)
            return res.status(409).json({ error: 'Course-subject mapping already exists' });
        const created = await prisma.$transaction(async (tx) => {
            const txAny = tx;
            const mapping = await tx.courseSubject.create({
                data: {
                    course_code: courseCode,
                    subject_code: subjectCode,
                    study_year: parsed.study_year,
                    semester: parsed.semester,
                },
            });
            const institutes = await Promise.all(instShortNames.map(async (instShortName) => {
                await validateInstituteCourseAssociation(req, instShortName, courseCode);
                return { inst_short_name: instShortName, course_code: courseCode, subject_code: subjectCode };
            }));
            if (institutes.length > 0) {
                await txAny.instCourseSubject.createMany({ data: institutes, skipDuplicates: true });
            }
            return { ...mapping, inst_short_names: instShortNames };
        });
        return res.status(201).json(created);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid mapping payload';
        return res.status(400).json({ error: message });
    }
});
app.put('/api/course-subjects/:course_code/:subject_code', auth, allow('CE', 'CA'), async (req, res) => {
    try {
        const courseCode = String(req.params.course_code).trim().toUpperCase();
        const subjectCode = String(req.params.subject_code).trim().toUpperCase();
        const parsed = zod_1.z.object({
            study_year: zod_1.z.coerce.number().int().min(1).max(8).nullable().optional(),
            semester: zod_1.z.coerce.number().int().min(1).max(12).nullable().optional(),
            inst_short_names: zod_1.z.array(zod_1.z.string().trim().min(1).max(10)).optional(),
        }).parse(req.body);
        const existing = await prisma.courseSubject.findUnique({ where: { course_code_subject_code: { course_code: courseCode, subject_code: subjectCode } } });
        if (!existing)
            return res.status(404).json({ error: 'Course-subject mapping not found' });
        if (req.session?.role === 'CA') {
            const inst = req.session.institute;
            if (!inst)
                return res.status(403).json({ error: 'College Admin is not mapped to an institute' });
            const allowed = await prisma.instCourse.findUnique({ where: { inst_short_name_course_code: { inst_short_name: inst, course_code: courseCode } } });
            if (!allowed)
                return res.status(403).json({ error: 'College Admin can only update mappings for their institute' });
        }
        const selectedInstitutes = requireInstituteSelection(req, parsed.inst_short_names ?? []);
        const updated = await prisma.$transaction(async (tx) => {
            const txAny = tx;
            const mapping = await tx.courseSubject.update({
                where: { course_code_subject_code: { course_code: courseCode, subject_code: subjectCode } },
                data: {
                    study_year: parsed.study_year ?? existing.study_year,
                    semester: parsed.semester ?? existing.semester,
                },
            });
            const associations = await Promise.all(selectedInstitutes.map(async (instShortName) => {
                await validateInstituteCourseAssociation(req, instShortName, courseCode);
                return { inst_short_name: instShortName, course_code: courseCode, subject_code: subjectCode };
            }));
            await txAny.instCourseSubject.deleteMany({ where: { course_code: courseCode, subject_code: subjectCode } });
            if (associations.length > 0) {
                await txAny.instCourseSubject.createMany({ data: associations, skipDuplicates: true });
            }
            return { ...mapping, inst_short_names: selectedInstitutes };
        });
        return res.json(updated);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid mapping payload';
        return res.status(400).json({ error: message });
    }
});
app.delete('/api/course-subjects/:course_code/:subject_code', auth, allow('CE', 'CA'), async (req, res) => {
    const courseCode = String(req.params.course_code).trim().toUpperCase();
    const subjectCode = String(req.params.subject_code).trim().toUpperCase();
    if (req.session?.role === 'CA') {
        const inst = req.session.institute;
        if (!inst)
            return res.status(403).json({ error: 'College Admin is not mapped to an institute' });
        const allowed = await prisma.instCourse.findUnique({ where: { inst_short_name_course_code: { inst_short_name: inst, course_code: courseCode } } });
        if (!allowed)
            return res.status(403).json({ error: 'College Admin can only delete mappings for their institute' });
    }
    const existing = await prisma.courseSubject.findUnique({ where: { course_code_subject_code: { course_code: courseCode, subject_code: subjectCode } } });
    if (!existing)
        return res.status(404).json({ error: 'Course-subject mapping not found' });
    await prisma.$transaction(async (tx) => {
        await prismaAny.instCourseSubject.deleteMany({ where: { course_code: courseCode, subject_code: subjectCode } });
        await tx.courseSubject.delete({ where: { course_code_subject_code: { course_code: courseCode, subject_code: subjectCode } } });
    });
    return res.status(204).send();
});
app.get('/api/faculty-available-subjects', auth, async (req, res) => {
    if (req.session?.role !== 'FAC' || !req.session.institute)
        return res.json([]);
    const courseCodes = (await prisma.instCourse.findMany({ where: { inst_short_name: req.session.institute }, select: { course_code: true } })).map(item => item.course_code);
    const assigned = new Set((await prisma.facultySubject.findMany({ where: { PAN: req.session.user_name }, select: { subject_code: true } })).map(item => item.subject_code));
    const rows = await prisma.courseSubject.findMany({ where: { course_code: { in: courseCodes } }, include: { subject: true }, orderBy: [{ course_code: 'asc' }, { subject_code: 'asc' }] });
    return res.json(rows.filter(row => !assigned.has(row.subject_code)).map(row => ({ ...row, subject: row.subject })));
});
// SEARCH ENDPOINT - role-scoped
app.get('/api/search', auth, async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (!q)
        return res.json({ institutes: [], courses: [], subjects: [], faculty: [] });
    try {
        const courseWhere = { OR: [{ course_code: { contains: q } }, { course_short_name: { contains: q } }, { course_full_name: { contains: q } }] };
        const subjectWhere = { OR: [{ subject_code: { contains: q } }, { subject_short_name: { contains: q } }, { subject_full_name: { contains: q } }] };
        const facultyWhereBase = { OR: [{ PAN: { contains: q } }, { faculty_name: { contains: q } }, { faculty_desig: { contains: q } }, { faculty_Email: { contains: q } }] };
        const institutes = await prisma.institute.findMany({ where: { OR: [{ inst_short_name: { contains: q } }, { inst_full_name: { contains: q } }] }, take: 50 });
        const courses = await prisma.course.findMany({ where: courseWhere, take: 50 });
        const subjects = await prisma.subject.findMany({ where: subjectWhere, take: 50 });
        // Faculty must be scoped for CA/FAC
        const facultyWhere = { AND: [facultyWhereBase] };
        if (req.session?.role === 'CA' || req.session?.role === 'FAC')
            facultyWhere.AND.push({ inst_short_name: req.session?.institute });
        const faculty = await prisma.faculty.findMany({ where: facultyWhere, take: 200 });
        return res.json({ institutes, courses, subjects, faculty });
    }
    catch (err) {
        console.error('Search error', err);
        return res.status(500).json({ error: 'Search failed' });
    }
});
// COURSE DETAILS - analytics
app.get('/api/courses/:course_code/details', auth, async (req, res) => {
    const courseCode = String(req.params.course_code);
    const course = await prisma.course.findUnique({ where: { course_code: courseCode } });
    if (!course)
        return res.status(404).json({ error: 'Course not found' });
    // If CA or FAC, restrict to their institute
    const instFilter = req.session?.role === 'CE' ? {} : { inst_short_name: req.session?.institute };
    const institutesOffering = await prisma.instCourse.findMany({ where: { course_code: courseCode, ...instFilter }, include: { institute: true } });
    // return the full course-subject mapping rows including study_year/semester and nested subject
    const subjects = await prisma.courseSubject.findMany({ where: { course_code: courseCode }, include: { subject: true } });
    const subjectCodes = subjects.map(s => s.subject_code);
    // Count distinct faculty teaching any subject in this course
    let facultyRows = [];
    if (subjectCodes.length > 0) {
        facultyRows = await prisma.faculty.findMany({ where: { subjects: { some: { subject_code: { in: subjectCodes } } }, ...(req.session?.role === 'CE' ? {} : { inst_short_name: req.session?.institute }) } });
    }
    // subjects is an array of CourseSubject rows with nested `subject` object and mapping fields
    return res.json({ course, institutesOffering: institutesOffering.map(r => r.institute), subjects, facultyCount: facultyRows.length, faculty: facultyRows });
});
// SUBJECT DETAILS - analytics
app.get('/api/subjects/:subject_code/details', auth, async (req, res) => {
    const subjectCode = String(req.params.subject_code);
    const subject = await prisma.subject.findUnique({ where: { subject_code: subjectCode } });
    if (!subject)
        return res.status(404).json({ error: 'Subject not found' });
    // return full course-subject mapping rows including study_year/semester and nested course
    const courseMappings = await prisma.courseSubject.findMany({ where: { subject_code: subjectCode }, include: { course: true } });
    const courseCodes = courseMappings.map(c => c.course_code);
    // Institutes where those courses are available (respect role scope)
    const instWhere = { course_code: { in: courseCodes } };
    if (req.session?.role !== 'CE')
        instWhere.inst_short_name = req.session?.institute;
    const instCourses = await prisma.instCourse.findMany({ where: instWhere, include: { institute: true } });
    const institutes = instCourses.map(ic => ic.institute);
    // Faculty who teach this subject
    const facultyWhere = { subjects: { some: { subject_code: subjectCode } } };
    if (req.session?.role !== 'CE')
        facultyWhere.inst_short_name = req.session?.institute;
    const facultyRows = await prisma.faculty.findMany({ where: facultyWhere });
    // courses: return mapping rows so frontend can read study_year and semester per subject
    return res.json({ subject, courses: courseMappings, institutes, instituteCount: new Set(institutes.map(i => i.inst_short_name)).size, facultyCount: facultyRows.length, faculty: facultyRows });
});
// INSTITUTE DETAILS - analytics
app.get('/api/institutes/:inst_short_name/details', auth, async (req, res) => {
    const inst = String(req.params.inst_short_name);
    if (req.session?.role === 'CA' && inst !== req.session.institute)
        return res.status(404).json({ error: 'Institute not found' });
    if (req.session?.role === 'FAC' && inst !== req.session.institute)
        return res.status(404).json({ error: 'Institute not found' });
    const institute = await prisma.institute.findUnique({ where: { inst_short_name: inst } });
    if (!institute)
        return res.status(404).json({ error: 'Institute not found' });
    const instCourses = await prisma.instCourse.findMany({ where: { inst_short_name: inst }, include: { course: true } });
    const courseCodes = instCourses.map(ic => ic.course_code);
    // include mapping rows so institute view can show study_year and semester per subject
    const subjects = await prisma.courseSubject.findMany({ where: { course_code: { in: courseCodes } }, include: { subject: true } });
    const facultyRows = await prisma.faculty.findMany({ where: { inst_short_name: inst } });
    const courseStats = await Promise.all(instCourses.map(async (ic) => {
        const subs = await prisma.courseSubject.findMany({ where: { course_code: ic.course_code }, include: { subject: true } });
        const facultyForCourse = await prisma.faculty.findMany({
            where: {
                AND: [
                    { inst_short_name: inst },
                    { subjects: { some: { subject: { courses: { some: { course_code: ic.course_code } } } } } },
                ],
            },
        });
        return { course: ic.course, intake: ic.intake, strength: ic.strength, subjects: subs, facultyCount: facultyForCourse.length, faculty: facultyForCourse };
    }));
    return res.json({ institute, courses: instCourses.map(ic => ic.course), facultyCount: facultyRows.length, subjects: subjects.map(s => s.subject), courseStats });
});
// Catch all errors
process.on('uncaughtException', (error) => {
    console.error('[v0] Uncaught exception:', error);
});
process.on('unhandledRejection', (reason) => {
    console.error('[v0] Unhandled rejection:', reason);
});
// Start the HTTP server
const httpServer = app.listen(port, async () => {
    console.log(`[v0] Examiner API listening on ${port}`);
    try {
        // Try a test query to ensure DB connection is working
        const count = await prisma.user.count();
        console.log(`[v0] Database connected, users count: ${count}`);
    }
    catch (err) {
        console.error('[v0] Database connection error:', err);
    }
});
// Handle server errors
httpServer.on('error', (error) => {
    console.error('[v0] Server error:', error);
});
// Make sure the HTTP server keeps process alive
httpServer.ref();
