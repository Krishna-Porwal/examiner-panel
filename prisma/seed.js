"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const password = yield bcryptjs_1.default.hash('change-me', 12);
        yield prisma.user.upsert({ where: { user_name_role: { user_name: 'CENTRAL', role: 'CE' } }, update: { password }, create: { user_name: 'CENTRAL', role: 'CE', password } });
        yield prisma.institute.upsert({ where: { inst_short_name: 'NIT' }, update: {}, create: { inst_short_name: 'NIT', inst_full_name: 'Northbridge Institute of Technology', inst_District: 'Central', inst_State: 'Maharashtra', Director_Name: 'Dr. R. Sen', ExamHead_Name: 'Aarav Menon' } });
        yield prisma.institute.upsert({ where: { inst_short_name: 'WCE' }, update: {}, create: { inst_short_name: 'WCE', inst_full_name: 'Westfield College of Engineering', inst_District: 'West', inst_State: 'Karnataka', Director_Name: 'Dr. P. Shah' } });
        yield prisma.course.upsert({ where: { course_code: 'BCA' }, update: {}, create: { course_code: 'BCA', course_short_name: 'BCA', course_full_name: 'Bachelor of Computer Applications' } });
        yield prisma.course.upsert({ where: { course_code: 'BTE' }, update: {}, create: { course_code: 'BTE', course_short_name: 'B.Tech', course_full_name: 'Bachelor of Technology' } });
        yield prisma.specialization.upsert({ where: { spec_id: 1 }, update: {}, create: { spec_id: 1, spec_name: 'Computer Science' } });
        yield prisma.subject.upsert({ where: { subject_code: 'CS101' }, update: {}, create: { subject_code: 'CS101', subject_short_name: 'Programming', subject_full_name: 'Programming Fundamentals', semester: 1, spec_id: 1 } });
        yield prisma.instCourse.upsert({ where: { inst_short_name_course_code: { inst_short_name: 'NIT', course_code: 'BCA' } }, update: {}, create: { inst_short_name: 'NIT', course_code: 'BCA', intake: 120, strength: 108 } });
        yield prisma.faculty.upsert({ where: { PAN: 'ABCDE1234F' }, update: {}, create: { PAN: 'ABCDE1234F', Title: 'Dr.', faculty_name: 'Anita Sharma', inst_short_name: 'NIT', faculty_desig: 'Professor', faculty_total_exp: 12, faculty_Email: 'anita.sharma@example.edu', entered_by: 'CENTRAL', entered_on: new Date() } });
    });
}
main().finally(() => prisma.$disconnect());
