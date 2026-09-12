const API = 'http://localhost:4000';
const suffix = String(Date.now()).slice(-4);
const inst = 'RUT' + suffix;
const caUser = inst;
const facPan = 'RFAC' + suffix;
const ceUser = 'CENTRAL';
const cePass = 'change-me';
const caPass = 'Runtime@' + suffix;
const facPass = 'Fac@' + suffix;

async function req(path, opts = {}) {
  const res = await fetch(API + path, opts);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, ok: res.ok, body: json };
}

(async () => {
  const ce = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_name: ceUser, role: 'CE', password: cePass })
  });
  console.log('CE LOGIN', ce.status, ce.ok, ce.body && ce.body.user);
  if (!ce.ok) throw new Error('CE login failed');
  const ceToken = ce.body.token;

  const institute = await req('/api/institutes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` },
    body: JSON.stringify({ inst_short_name: inst, inst_full_name: 'Runtime Test Institute', inst_District: 'Dist', inst_State: 'State' })
  });
  console.log('CREATE INSTITUTE', institute.status, institute.ok, institute.body);

  const caCred = await req('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` },
    body: JSON.stringify({ user_name: caUser, role: 'CA', password: caPass })
  });
  console.log('CREATE CA CRED', caCred.status, caCred.ok, caCred.body);

  const caLogin = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_name: caUser, role: 'CA', password: caPass })
  });
  console.log('CA LOGIN', caLogin.status, caLogin.ok, caLogin.body);
  if (!caLogin.ok) throw new Error('CA login failed');
  const caToken = caLogin.body.token;

  const faculty = await req('/api/faculty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` },
    body: JSON.stringify({ PAN: facPan, Title: 'Dr.', faculty_name: 'Runtime Faculty', inst_short_name: inst, faculty_desig: 'Lecturer', faculty_total_exp: 5, faculty_address: 'Addr', faculty_Email: 'runtime' + suffix + '@test.edu', faculty_MobileNo: '9999999999' })
  });
  console.log('CREATE FACULTY', faculty.status, faculty.ok, faculty.body);

  const facCred = await req('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` },
    body: JSON.stringify({ user_name: facPan, role: 'FAC', password: facPass })
  });
  console.log('CREATE FAC CRED', facCred.status, facCred.ok, facCred.body);

  const facLogin = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_name: facPan, role: 'FAC', password: facPass })
  });
  console.log('FAC LOGIN', facLogin.status, facLogin.ok, facLogin.body);
  if (!facLogin.ok) throw new Error('FAC login failed');
  const facToken = facLogin.body.token;

  const cse = await req('/api/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` },
    body: JSON.stringify({ course_code: 'CSE', course_short_name: 'CSE', course_full_name: 'Computer Science and Engineering' })
  });
  console.log('CREATE CSE', cse.status, cse.ok, cse.body);

  const it = await req('/api/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` },
    body: JSON.stringify({ course_code: 'IT', course_short_name: 'IT', course_full_name: 'Information Technology' })
  });
  console.log('CREATE IT', it.status, it.ok, it.body);

  const subA = await req('/api/subjects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` },
    body: JSON.stringify({ subject_code: 'RDS' + suffix, sub_subject_codes: '', subject_short_name: 'RDS', subject_full_name: 'Runtime Data Structures', semester: 3, spec_id: 1 })
  });
  console.log('CREATE SUBJECT A', subA.status, subA.ok, subA.body);

  const subB = await req('/api/subjects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` },
    body: JSON.stringify({ subject_code: 'RDB' + suffix, sub_subject_codes: '', subject_short_name: 'RDB', subject_full_name: 'Runtime Database Systems', semester: 4, spec_id: 1 })
  });
  console.log('CREATE SUBJECT B', subB.status, subB.ok, subB.body);

  const cs1 = await req('/api/course-subjects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` },
    body: JSON.stringify({ course_code: 'CSE', subject_code: 'RDS' + suffix })
  });
  console.log('MAP CSE->SUBA', cs1.status, cs1.ok, cs1.body);

  const cs2 = await req('/api/course-subjects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` },
    body: JSON.stringify({ course_code: 'IT', subject_code: 'RDB' + suffix })
  });
  console.log('MAP IT->SUBB', cs2.status, cs2.ok, cs2.body);

  const instCourseA = await req('/api/inst-courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` },
    body: JSON.stringify({ inst_short_name: inst, course_code: 'CSE', intake: 60, strength: 55 })
  });
  console.log('MAP INST CSE', instCourseA.status, instCourseA.ok, instCourseA.body);

  const instCourseB = await req('/api/inst-courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` },
    body: JSON.stringify({ inst_short_name: inst, course_code: 'IT', intake: 60, strength: 55 })
  });
  console.log('MAP INST IT', instCourseB.status, instCourseB.ok, instCourseB.body);

  const available = await req('/api/faculty-available-subjects', {
    method: 'GET',
    headers: { Authorization: `Bearer ${facToken}` }
  });
  console.log('AVAILABLE SUBJECTS', available.status, available.ok, available.body);

  const addSub = await req('/api/faculty-subjects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${facToken}` },
    body: JSON.stringify({ PAN: facPan, subject_code: 'RDS' + suffix })
  });
  console.log('ADD FAC SUBJECT', addSub.status, addSub.ok, addSub.body);

  const listSubs = await req('/api/faculty-subjects', {
    method: 'GET',
    headers: { Authorization: `Bearer ${facToken}` }
  });
  console.log('FAC SUBJECT LIST', listSubs.status, listSubs.ok, listSubs.body);

  const delSub = await req('/api/faculty-subjects/' + facPan + '/' + ('RDS' + suffix), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${facToken}` }
  });
  console.log('REMOVE FAC SUBJECT', delSub.status, delSub.ok, delSub.body);

  const specCreate = await req('/api/specializations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` },
    body: JSON.stringify({ spec_id: 99, spec_name: 'Runtime Spec' })
  });
  console.log('CREATE SPEC', specCreate.status, specCreate.ok, specCreate.body);

  const specAdd = await req('/api/faculty-specializations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${facToken}` },
    body: JSON.stringify({ PAN: facPan, spec_id: 99 })
  });
  console.log('ADD FAC SPEC', specAdd.status, specAdd.ok, specAdd.body);

  const facSpecList = await req('/api/faculty-specializations', {
    method: 'GET',
    headers: { Authorization: `Bearer ${facToken}` }
  });
  console.log('FAC SPEC LIST', facSpecList.status, facSpecList.ok, facSpecList.body);

  const delSpec = await req('/api/faculty-specializations/' + facPan + '/99', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${facToken}` }
  });
  console.log('REMOVE FAC SPEC', delSpec.status, delSpec.ok, delSpec.body);

  const profile = await req('/api/faculty/' + facPan, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${facToken}` },
    body: JSON.stringify({ faculty_name: 'Updated Runtime Faculty', faculty_Email: 'updated' + suffix + '@test.edu' })
  });
  console.log('UPDATE FAC PROFILE', profile.status, profile.ok, profile.body);

  const me = await req('/api/auth/me', { method: 'GET', headers: { Authorization: `Bearer ${facToken}` } });
  console.log('ME', me.status, me.ok, me.body);

  const facDenied = await req('/api/faculty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${facToken}` },
    body: JSON.stringify({ PAN: 'NOPE', Title: 'X', faculty_name: 'Nope', inst_short_name: inst, faculty_desig: 'X' })
  });
  console.log('FAC CANNOT CREATE', facDenied.status, facDenied.ok, facDenied.body);

  const caOther = await req('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` },
    body: JSON.stringify({ user_name: 'OTHER', role: 'CA', password: 'Other@123' })
  });
  console.log('CA CANNOT CREATE OTHER CA', caOther.status, caOther.ok, caOther.body);

  console.log('ALL DONE');
})().catch(err => {
  console.error('RUNTIME CHECK ERROR', err);
  process.exit(1);
});
