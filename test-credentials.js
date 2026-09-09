(async () => {
  const API = 'http://localhost:4000'
  const run = async (label, fn) => {
    try {
      console.log(`-- ${label}`)
      const r = await fn()
      console.log(JSON.stringify(r, null, 2))
      return r
    } catch (err) {
      console.error(`ERROR during ${label}:`, err && err.message ? err.message : err)
      process.exitCode = 1
      throw err
    }
  }

  // 1. seed (runs prisma/seed.ts via npm script)
  const { execSync } = require('child_process')
  console.log('Running prisma seed...')
  execSync('npm run prisma:seed', { stdio: 'inherit' })

  // 2. CE login
  const ce = await run('CE login', async () => {
    const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_name: 'CENTRAL', role: 'CE', password: 'change-me' }) })
    if (!res.ok) throw new Error(`CE login failed ${res.status}`)
    return res.json()
  })
  const ceToken = ce.token

  // 3. Create institute TESTCOL
  await run('Create institute TESTCOL', async () => {
    const res = await fetch(`${API}/api/institutes`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` }, body: JSON.stringify({ inst_short_name: 'TESTCOL', inst_full_name: 'Test College', inst_District: 'TestDist', inst_State: 'TestState' }) })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Create institute failed ${res.status} ${txt}`)
    }
    return res.json()
  })

  // 4. Create CA credential
  await run('Create CA credential TESTCOL/Test@123', async () => {
    const res = await fetch(`${API}/api/users`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` }, body: JSON.stringify({ user_name: 'TESTCOL', role: 'CA', password: 'Test@123' }) })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Create CA failed ${res.status} ${txt}`)
    }
    return res.json()
  })

  // 5. CA login
  const ca = await run('CA login', async () => {
    const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_name: 'TESTCOL', role: 'CA', password: 'Test@123' }) })
    if (!res.ok) throw new Error(`CA login failed ${res.status}`)
    return res.json()
  })
  const caToken = ca.token

  // 6. CA create faculty record
  await run('CA create faculty TESTPAN01', async () => {
    const res = await fetch(`${API}/api/faculty`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` }, body: JSON.stringify({ PAN: 'TESTPAN01', Title: 'Mr.', faculty_name: 'Test Faculty', inst_short_name: 'TESTCOL', faculty_desig: 'Lecturer', faculty_total_exp: 3, faculty_address: 'Addr', faculty_Email: 'test@t.com', faculty_MobileNo: '9999999999' }) })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Create faculty failed ${res.status} ${txt}`)
    }
    return res.json()
  })

  // 7. CA create FAC credential
  await run('CA create FAC credential TESTPAN01/Faculty@123', async () => {
    const res = await fetch(`${API}/api/users`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` }, body: JSON.stringify({ user_name: 'TESTPAN01', role: 'FAC', password: 'Faculty@123' }) })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Create FAC credential failed ${res.status} ${txt}`)
    }
    return res.json()
  })

  // 8. FAC login
  await run('FAC login', async () => {
    const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_name: 'TESTPAN01', role: 'FAC', password: 'Faculty@123' }) })
    if (!res.ok) throw new Error(`FAC login failed ${res.status}`)
    return res.json()
  })

  console.log('All tests completed successfully')
})().catch(err => { console.error('Script failed', err); process.exit(1) })
