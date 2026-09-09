(async () => {
  // End-to-end idempotent test for Examiner Panel
  const API = process.env.API_URL || 'http://localhost:4000'
  const ok = (s) => console.log('\x1b[32mPASS\x1b[0m', s)
  const fail = (s) => { console.error('\x1b[31mFAIL\x1b[0m', s); failures.push(s) }
  const failures = []
  const sleep = ms => new Promise(r => setTimeout(r, ms))

  async function req(path, opts = {}) {
    const res = await fetch(API + path, opts)
    const text = await res.text().catch(() => '')
    let json = null
    try { json = text ? JSON.parse(text) : null } catch (e) { json = text }
    return { status: res.status, body: json, ok: res.ok }
  }

  function result(name, passed, details) {
    if (passed) ok(name)
    else fail(name + (details ? ' - ' + details : ''))
  }

  try {
    console.log('Starting E2E tests against', API)

    // PART 1 — CREDENTIAL LOGIN
    // 1. CE login
    const ceLogin = await req('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_name: 'CENTRAL', role: 'CE', password: 'change-me' })
    })
    result('CE login (CENTRAL/CE/change-me)', ceLogin.ok, JSON.stringify(ceLogin.body))
    if (!ceLogin.ok) throw new Error('CE login failed — aborting tests')
    const ceToken = ceLogin.body.token

    // 2. CE creates or reuses TESTCOL institute
    const instPayload = { inst_short_name: 'TESTCOL', inst_full_name: 'Test College', inst_District: 'TestDist', inst_State: 'TestState' }
    let instCreate = await req('/api/institutes', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` }, body: JSON.stringify(instPayload) })
    if (instCreate.status === 409) ok('TESTCOL institute already exists (reused)')
    else result('Create TESTCOL institute', instCreate.ok, JSON.stringify(instCreate.body))

    // 3. CE creates or resets/reuses TESTCOL / CA / Test@123
    // Attempt to create; if exists, delete+recreate isn't available, so ignore 409.
    const caCred = { user_name: 'TESTCOL', role: 'CA', password: 'Test@123' }
    let caCreate = await req('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` }, body: JSON.stringify(caCred) })
    if (caCreate.status === 409) ok('CA credential TESTCOL already exists (reused)')
    else result('Create CA credential TESTCOL/Test@123', caCreate.ok, JSON.stringify(caCreate.body))

    // 4. Login using CA credentials
    const caLogin = await req('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_name: 'TESTCOL', role: 'CA', password: 'Test@123' }) })
    result('CA login TESTCOL/Test@123', caLogin.ok && caLogin.body?.user?.role === 'CA' && caLogin.body?.user?.institute === 'TESTCOL', JSON.stringify(caLogin.body))
    if (!caLogin.ok) throw new Error('CA login failed — aborting')
    const caToken = caLogin.body.token

    // 5. CA creates or reuses TESTPAN01 faculty belonging to TESTCOL
    const facultyPayload = { PAN: 'TESTPAN01', Title: 'Mr.', faculty_name: 'Test Faculty', inst_short_name: 'TESTCOL', faculty_desig: 'Lecturer', faculty_total_exp: 3, faculty_address: 'Addr', faculty_Email: 'test@t.com', faculty_MobileNo: '9999999999' }
    let facultyCreate = await req('/api/faculty', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` }, body: JSON.stringify(facultyPayload) })
    if (facultyCreate.status === 409) ok('Faculty TESTPAN01 already exists (reused)')
    else result('Create faculty TESTPAN01 under TESTCOL', facultyCreate.ok, JSON.stringify(facultyCreate.body))

    // 6. CA creates or resets/reuses TESTPAN01 / FAC / Faculty@123
    const facCred = { user_name: 'TESTPAN01', role: 'FAC', password: 'Faculty@123' }
    let facCreate = await req('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` }, body: JSON.stringify(facCred) })
    if (facCreate.status === 409) ok('FAC credential TESTPAN01 already exists (reused)')
    else result('Create FAC credential TESTPAN01/Faculty@123', facCreate.ok, JSON.stringify(facCreate.body))

    // 7. Login as FAC
    const facLogin = await req('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_name: 'TESTPAN01', role: 'FAC', password: 'Faculty@123' }) })
    result('FAC login TESTPAN01/Faculty@123', facLogin.ok && facLogin.body?.user?.role === 'FAC' && facLogin.body?.user?.user_name === 'TESTPAN01' || facLogin.body?.user?.user_name === 'TESTPAN01', JSON.stringify(facLogin.body))
    if (!facLogin.ok) throw new Error('FAC login failed — aborting')
    const facToken = facLogin.body.token

    // PART 2 — ENGINEERING COURSES
    // 1. Create or reuse CSE
    const cse = { course_code: 'CSE', course_short_name: 'CSE', course_full_name: 'Computer Science and Engineering' }
    let cseCreate = await req('/api/courses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` }, body: JSON.stringify(cse) })
    if (cseCreate.status === 409) ok('Course CSE already exists (reused)')
    else result('Create course CSE', cseCreate.ok, JSON.stringify(cseCreate.body))

    // 2. Create or reuse IT
    const it = { course_code: 'IT', course_short_name: 'IT', course_full_name: 'Information Technology' }
    let itCreate = await req('/api/courses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` }, body: JSON.stringify(it) })
    if (itCreate.status === 409) ok('Course IT already exists (reused)')
    else result('Create course IT', itCreate.ok, JSON.stringify(itCreate.body))

    // 3. Verify non-engineering course rejected
    const bba = { course_code: 'BBA', course_short_name: 'BBA', course_full_name: 'Business Administration' }
    let bbaCreate = await req('/api/courses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` }, body: JSON.stringify(bba) })
    result('Reject non-engineering course BBA', bbaCreate.status >= 400 && !bbaCreate.ok, JSON.stringify(bbaCreate.body))

    // PART 3 — SUBJECTS
    // 1. Create DS001
    const ds = { subject_code: 'DS001', sub_subject_codes: '', subject_short_name: 'DS', subject_full_name: 'Data Structures', semester: 3, spec_id: 1 }
    let dsCreate = await req('/api/subjects', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` }, body: JSON.stringify(ds) })
    if (dsCreate.status === 409) ok('Subject DS001 already exists (reused)')
    else result('Create subject DS001', dsCreate.ok, JSON.stringify(dsCreate.body))

    // 2. Create DB001
    const dbs = { subject_code: 'DB001', sub_subject_codes: '', subject_short_name: 'DBMS', subject_full_name: 'Database Management Systems', semester: 4, spec_id: 1 }
    let dbCreate = await req('/api/subjects', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` }, body: JSON.stringify(dbs) })
    if (dbCreate.status === 409) ok('Subject DB001 already exists (reused)')
    else result('Create subject DB001', dbCreate.ok, JSON.stringify(dbCreate.body))

    // 3. Verify persisted by GET
    const subjectsList = await req('/api/subjects', { method: 'GET', headers: { Authorization: `Bearer ${ceToken}` } })
    result('Subjects persisted contains DS001 and DB001', subjectsList.ok && Array.isArray(subjectsList.body) && subjectsList.body.some(s => s.subject_code === 'DS001') && subjectsList.body.some(s => s.subject_code === 'DB001'), JSON.stringify(subjectsList.body))

    // PART 4 — COURSE -> SUBJECT
    // 1. CSE -> DS001
    let map1 = await req('/api/course-subjects', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` }, body: JSON.stringify({ course_code: 'CSE', subject_code: 'DS001' }) })
    if (map1.status === 409) ok('Mapping CSE->DS001 already exists (reused)')
    else result('Create mapping CSE->DS001', map1.ok, JSON.stringify(map1.body))

    // 2. CSE -> DB001
    let map2 = await req('/api/course-subjects', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` }, body: JSON.stringify({ course_code: 'CSE', subject_code: 'DB001' }) })
    if (map2.status === 409) ok('Mapping CSE->DB001 already exists (reused)')
    else result('Create mapping CSE->DB001', map2.ok, JSON.stringify(map2.body))

    // 3. GET course-subject mappings
    const csList = await req('/api/course-subjects', { method: 'GET', headers: { Authorization: `Bearer ${ceToken}` } })
    const csBody = csList.body || []
    const hasDS = Array.isArray(csBody) && csBody.some(m => m.course_code === 'CSE' && m.subject_code === 'DS001')
    const hasDB = Array.isArray(csBody) && csBody.some(m => m.course_code === 'CSE' && m.subject_code === 'DB001')
    result('Course-subject mappings include CSE->DS001 and CSE->DB001', hasDS && hasDB, JSON.stringify(csBody))

    // 5. Attempt duplicate mapping and expect rejection
    const dup = await req('/api/course-subjects', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` }, body: JSON.stringify({ course_code: 'CSE', subject_code: 'DS001' }) })
    result('Duplicate mapping rejected', dup.status >= 400 && !dup.ok, JSON.stringify(dup.body))

    // 6. Delete one mapping (CSE->DB001) and verify removal
    const del = await req('/api/course-subjects/CSE/DB001', { method: 'DELETE', headers: { Authorization: `Bearer ${ceToken}` } })
    result('Delete mapping CSE->DB001', del.status === 204 || del.ok, JSON.stringify(del.body))
    const csAfter = await req('/api/course-subjects', { method: 'GET', headers: { Authorization: `Bearer ${ceToken}` } })
    const stillHasDB = Array.isArray(csAfter.body) && csAfter.body.some(m => m.course_code === 'CSE' && m.subject_code === 'DB001')
    result('Mapping CSE->DB001 removed', !stillHasDB, JSON.stringify(csAfter.body))

    // PART 5 — INSTITUTE -> COURSE (Using CA)
    // 1. Add TESTCOL -> CSE
    const instCourse1 = await req('/api/inst-courses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` }, body: JSON.stringify({ inst_short_name: 'TESTCOL', course_code: 'CSE', intake: 60, strength: 55 }) })
    if (instCourse1.status === 409) ok('Inst-course TESTCOL->CSE already exists (reused)')
    else result('Create inst-course TESTCOL->CSE', instCourse1.ok, JSON.stringify(instCourse1.body))

    // 2. Add TESTCOL -> IT
    const instCourse2 = await req('/api/inst-courses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` }, body: JSON.stringify({ inst_short_name: 'TESTCOL', course_code: 'IT', intake: 60, strength: 55 }) })
    if (instCourse2.status === 409) ok('Inst-course TESTCOL->IT already exists (reused)')
    else result('Create inst-course TESTCOL->IT', instCourse2.ok, JSON.stringify(instCourse2.body))

    // 3. Verify CA can only see/manage TESTCOL mappings
    const caInstCourses = await req('/api/inst-courses', { method: 'GET', headers: { Authorization: `Bearer ${caToken}` } })
    const caSeeOnlyTestcol = Array.isArray(caInstCourses.body) && caInstCourses.body.every(m => m.inst_short_name === 'TESTCOL')
    result('CA sees only TESTCOL inst-course mappings', caSeeOnlyTestcol, JSON.stringify(caInstCourses.body))

    // 4. CA cannot modify another institute's mapping (attempt to add mapping for another inst)
    const forbiddenAdd = await req('/api/inst-courses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` }, body: JSON.stringify({ inst_short_name: 'OTHERINST', course_code: 'CSE' }) })
    result('CA cannot add mapping for another institute', forbiddenAdd.status === 403 || !forbiddenAdd.ok, JSON.stringify(forbiddenAdd.body))

    // PART 6 — FACULTY -> SUBJECT (Using FAC)
    // 1. Login as TESTPAN01 was done; use facToken
    // 2. Assign DS001 to TESTPAN01
    const addFacSub = await req('/api/faculty-subjects', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${facToken}` }, body: JSON.stringify({ PAN: 'TESTPAN01', subject_code: 'DS001' }) })
    if (addFacSub.status === 409) ok('Faculty-subject mapping TESTPAN01->DS001 already exists (reused)')
    else result('Add faculty subject TESTPAN01->DS001', addFacSub.ok, JSON.stringify(addFacSub.body))

    // 3. Verify mapping persists via GET
    const facSubs = await req('/api/faculty-subjects', { method: 'GET', headers: { Authorization: `Bearer ${facToken}` } })
    const facHasDS = Array.isArray(facSubs.body) && facSubs.body.some(m => m.PAN === 'TESTPAN01' && m.subject_code === 'DS001')
    result('FAC sees assigned subject DS001', facHasDS, JSON.stringify(facSubs.body))

    // 4. Remove DS001
    const remFac = await req('/api/faculty-subjects/TESTPAN01/DS001', { method: 'DELETE', headers: { Authorization: `Bearer ${facToken}` } })
    result('FAC remove DS001 mapping', remFac.status === 204 || remFac.ok, JSON.stringify(remFac.body))

    // 5. Verify removed
    const facSubsAfter = await req('/api/faculty-subjects', { method: 'GET', headers: { Authorization: `Bearer ${facToken}` } })
    const stillFacHasDS = Array.isArray(facSubsAfter.body) && facSubsAfter.body.some(m => m.PAN === 'TESTPAN01' && m.subject_code === 'DS001')
    result('DS001 removed from FAC mappings', !stillFacHasDS, JSON.stringify(facSubsAfter.body))

    // PART 7 — FACULTY -> SPECIALIZATION
    // 1. Create or reuse a specialization (CE)
    const specPayload = { spec_id: 10, spec_name: 'Test Specialization' }
    const specCreate = await req('/api/specializations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` }, body: JSON.stringify(specPayload) })
    if (specCreate.status === 409) ok('Specialization reused')
    else result('Create specialization', specCreate.ok, JSON.stringify(specCreate.body))

    // 2. Assign it to TESTPAN01 (FAC)
    const addSpec = await req('/api/faculty-specializations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${facToken}` }, body: JSON.stringify({ PAN: 'TESTPAN01', spec_id: 10 }) })
    if (addSpec.status === 409) ok('Faculty specialization mapping already exists (reused)')
    else result('FAC add specialization to self', addSpec.ok, JSON.stringify(addSpec.body))

    // 3. Verify mapping persists
    const facSpecs = await req('/api/faculty-specializations', { method: 'GET', headers: { Authorization: `Bearer ${facToken}` } })
    const hasSpec = Array.isArray(facSpecs.body) && facSpecs.body.some(m => m.PAN === 'TESTPAN01' && m.spec_id === 10)
    result('FAC specialization mapping present', hasSpec, JSON.stringify(facSpecs.body))

    // 4. Remove it
    const remSpec = await req('/api/faculty-specializations/TESTPAN01/10', { method: 'DELETE', headers: { Authorization: `Bearer ${facToken}` } })
    result('FAC remove specialization', remSpec.status === 204 || remSpec.ok, JSON.stringify(remSpec.body))

    // PART 8 — RBAC checks
    // CE: can GET /api/institutes (global)
    const ceGetInst = await req('/api/institutes', { method: 'GET', headers: { Authorization: `Bearer ${ceToken}` } })
    result('CE can access all institutes', ceGetInst.ok, JSON.stringify(ceGetInst.body))

    // CA cannot create CA credential (should return 403)
    const caTryCreateCA = await req('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` }, body: JSON.stringify({ user_name: 'OTHER', role: 'CA', password: 'Password123' }) })
    result('CA cannot create CA credential', caTryCreateCA.status === 403 || !caTryCreateCA.ok, JSON.stringify(caTryCreateCA.body))

    // FAC cannot access another faculty (attempt to GET another PAN record)
    const facTryGetOther = await req('/api/faculty/ABCDE1234F', { method: 'GET', headers: { Authorization: `Bearer ${facToken}` } })
    // If the record belongs to another inst or another PAN, FAC should get 404 or 403
    result('FAC cannot access other faculty record', facTryGetOther.status === 404 || facTryGetOther.status === 403 || !facTryGetOther.ok, JSON.stringify(facTryGetOther.body))

    // PART 9 — Repeatability already respected via 409 handling

    // Final evaluation
    if (failures.length === 0) {
      console.log('\nALL END-TO-END TESTS PASSED')
      process.exit(0)
    } else {
      console.error('\nEND-TO-END TESTS FAILED — summary:')
      failures.forEach(f => console.error('-', f))
      process.exit(2)
    }

  } catch (err) {
    console.error('Fatal test error:', err && err.message ? err.message : err)
    console.error('\nEND-TO-END TESTS ABORTED')
    process.exit(3)
  }
})();
