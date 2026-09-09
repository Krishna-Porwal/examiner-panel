import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const credentials = [
    { user_name: 'CENTRAL', role: 'CE' as const, password: 'change-me' },
    { user_name: 'NIT', role: 'CA' as const, password: 'college123' },
    { user_name: 'ABCDE1234F', role: 'FAC' as const, password: 'faculty123' },
  ]
  for (const credential of credentials) {
    const password = await bcrypt.hash(credential.password, 12)
    await prisma.user.upsert({ where: { user_name_role: { user_name: credential.user_name, role: credential.role } }, update: { password }, create: { user_name: credential.user_name, role: credential.role, password } })
  }
  await prisma.institute.upsert({ where: { inst_short_name: 'NIT' }, update: {}, create: { inst_short_name: 'NIT', inst_full_name: 'Northbridge Institute of Technology', inst_District: 'Central', inst_State: 'Maharashtra', Director_Name: 'Dr. R. Sen', ExamHead_Name: 'Aarav Menon' } })
  await prisma.institute.upsert({ where: { inst_short_name: 'WCE' }, update: {}, create: { inst_short_name: 'WCE', inst_full_name: 'Westfield College of Engineering', inst_District: 'West', inst_State: 'Karnataka', Director_Name: 'Dr. P. Shah' } })
  await prisma.course.upsert({ where: { course_code: 'BCA' }, update: {}, create: { course_code: 'BCA', course_short_name: 'BCA', course_full_name: 'Bachelor of Computer Applications' } })
  await prisma.course.upsert({ where: { course_code: 'BTE' }, update: {}, create: { course_code: 'BTE', course_short_name: 'B.Tech', course_full_name: 'Bachelor of Technology' } })
  await prisma.specialization.upsert({ where: { spec_id: 1 }, update: {}, create: { spec_id: 1, spec_name: 'Computer Science' } })
  await prisma.subject.upsert({ where: { subject_code: 'CS101' }, update: {}, create: { subject_code: 'CS101', subject_short_name: 'PROG', subject_full_name: 'Programming Fundamentals', semester: 1, spec_id: 1 } })
  await prisma.instCourse.upsert({ where: { inst_short_name_course_code: { inst_short_name: 'NIT', course_code: 'BCA' } }, update: {}, create: { inst_short_name: 'NIT', course_code: 'BCA', intake: 120, strength: 108 } })
  await prisma.faculty.upsert({ where: { PAN: 'ABCDE1234F' }, update: {}, create: { PAN: 'ABCDE1234F', Title: 'Dr.', faculty_name: 'Anita Sharma', inst_short_name: 'NIT', faculty_desig: 'Professor', faculty_total_exp: 12, faculty_Email: 'anita.sharma@example.edu', entered_by: 'CENTRAL', entered_on: new Date() } })
}

main().finally(() => prisma.$disconnect())
