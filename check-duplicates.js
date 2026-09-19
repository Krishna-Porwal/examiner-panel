import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany()
  console.log('All users with normalized names:')
  users.forEach(u => {
    const normalized = u.user_name.trim().toUpperCase().replace(/\s+/g, '')
    console.log(`  DB: "${u.user_name}" | Role: ${u.role} | Normalized: "${normalized}"`)
  })
  
  // Check for duplicates by normalized name
  const byNormalized = new Map()
  users.forEach(u => {
    const norm = u.user_name.trim().toUpperCase().replace(/\s+/g, '')
    const key = `${norm}|${u.role}`
    if (!byNormalized.has(key)) {
      byNormalized.set(key, [])
    }
    byNormalized.get(key).push(u)
  })
  
  console.log('\n\nDuplicates by normalized name+role:')
  for (const [key, records] of byNormalized) {
    if (records.length > 1) {
      console.log(`  ${key}: ${records.length} records`)
      records.forEach(r => console.log(`    - "${r.user_name}""`))
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
