import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany()
  console.log('Users in database:')
  users.forEach(u => console.log(`  ${u.user_name} (${u.role})`))
  console.log(`\nTotal: ${users.length} users`)
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
