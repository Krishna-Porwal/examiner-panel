const API = 'http://localhost:4000';

async function req(path, opts = {}) {
  const r = await fetch(API + path, opts);
  const text = await r.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: r.status, ok: r.ok, body };
}

(async () => {
  const ce = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_name: 'CENTRAL', role: 'CE', password: 'change-me' })
  });

  if (!ce.ok) {
    console.log('CE_LOGIN', ce.status, JSON.stringify(ce.body));
    process.exit(1);
  }

  const ceToken = ce.body.token;
  const inst = 'RUB' + String(Date.now()).slice(-4);

  await req('/api/institutes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ceToken },
    body: JSON.stringify({ inst_short_name: inst, inst_full_name: 'RBAC Test', inst_District: 'D', inst_State: 'S' })
  });

  await req('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ceToken },
    body: JSON.stringify({ user_name: inst, role: 'CA', password: 'Rbac@1234' })
  });

  const caLogin = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_name: inst, role: 'CA', password: 'Rbac@1234' })
  });

  const caToken = caLogin.body.token;
  const facPan = 'RFB' + String(Date.now()).slice(-4);

  await req('/api/faculty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + caToken },
    body: JSON.stringify({ PAN: facPan, Title: 'Mr.', faculty_name: 'RBAC Faculty', inst_short_name: inst, faculty_desig: 'Lecturer', faculty_total_exp: 2, faculty_address: 'X', faculty_Email: 'rbac@test.edu', faculty_MobileNo: '9999999999' })
  });

  await req('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + caToken },
    body: JSON.stringify({ user_name: facPan, role: 'FAC', password: 'Rbac@1234' })
  });

  const facLogin = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_name: facPan, role: 'FAC', password: 'Rbac@1234' })
  });

  const facToken = facLogin.body.token;
  const facCreate = await req('/api/faculty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + facToken },
    body: JSON.stringify({ PAN: 'BADPAN', Title: 'Mr.', faculty_name: 'Nope', inst_short_name: inst, faculty_desig: 'x' })
  });

  const facSubject = await req('/api/subjects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + facToken },
    body: JSON.stringify({ subject_code: 'RBACX', subject_short_name: 'R', subject_full_name: 'Nope', semester: 1, spec_id: 1 })
  });

  const caOther = await req('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + caToken },
    body: JSON.stringify({ user_name: 'OTHER', role: 'CA', password: 'Other@1234' })
  });

  console.log('RBAC_FAC_CREATE', facCreate.status, JSON.stringify(facCreate.body));
  console.log('RBAC_FAC_SUBJECT', facSubject.status, JSON.stringify(facSubject.body));
  console.log('RBAC_CA_OTHER', caOther.status, JSON.stringify(caOther.body));
})().catch((err) => {
  console.error('RBAC_ERR', err);
  process.exit(1);
});
