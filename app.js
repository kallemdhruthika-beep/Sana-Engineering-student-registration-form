/* ============================================================
   SANA ENGINEERING COLLEGE — Student Registration Portal
   Frontend logic. Talks only to the Google Apps Script Web App
   below, which reads/writes the Google Sheet.
   ============================================================ */

// ⚠️ REQUIRED: paste your deployed Apps Script Web App URL here.
// It looks like: https://script.google.com/macros/s/AKfycb.../exec
// See README.md, Step 6, for how to get this URL.
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwOwCc2J70i03fDH_LgMX9H6HJ951yAikm1P9wTdVinQ4pofz4880wjsL1HviC9dnN0pw/exec';

// ----------------------------------------------------------------
// Low-level API helper
// ----------------------------------------------------------------

/**
 * Calls the Apps Script backend. Uses text/ain as the request content
 * type on purpose: it keeps the browser from splending a CORS preflight
 * request, which Apps Script Web Apps do not handle.
 */
async function callApi(action, payload) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('PASTE_YOUR') === 0) {
    throw new Error(
      'The Apps Script Web App URL has not been set yet. Open app.js and set APPS_SCRIPT_URL.'
    );
  }

  const body = Object.assign({ action: action }, payload);

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error('Network error (HTTP ' + response.status + ')');
  }

  return response.json();
}

// ----------------------------------------------------------------
// View switching
// ----------------------------------------------------------------

const views = {
  register: document.getElementById('viewRegister'),
  success: document.getElementById('viewSuccess'),
  adminLogin: document.getElementById('viewAdminLogin'),
  adminDashboard: document.getElementById('viewAdminDashboard')
};

function showView(name) {
  Object.keys(views).forEach(function (key) {
    views[key].classList.toggle('hidden', key !== name);
  });
  document.getElementById('navHome').classList.toggle('active', name === 'register' || name === 'success');
  document.getElementById('navAdmin').classList.toggle('active', name === 'adminLogin' || name === 'adminDashboard');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('navHome').addEventListener('click', function () {
  showView('register');
});

document.getElementById('navAdmin').addEventListener('click', function () {
  if (sessionStorage.getItem('sanaAdminToken')) {
    showView('adminDashboard');
    loadStudents();
  } else {
    showView('adminLogin');
  }
});

// ==================================================================
// STUDENT REGISTRATION FORM
// ==================================================================

const registrationForm = document.getElementById('registrationForm');
const submitBtn = document.getElementById('submitBtn');
const formStatus = document.getElementById('formStatus');

const validators = {
  fullName: function (v) {
    return v.trim().length >= 3 ? '' : 'Enter the student\'s full name.';
  },
  dob: function (v) {
    if (!v) return 'Date of birth is required.';
    const dob = new Date(v);
    const today = new Date();
    const minAge = new Date(today.getFullYear() - 14, today.getMonth(), today.getDate());
    if (dob > today) return 'Date of birth cannot be in the future.';
    if (dob > minAge) return 'Student must be at least 14 years old.';
    return '';
  },
  gender: function (v) { return v ? '' : 'Select a gender.'; },
  guardianName: function (v) { return v.trim().length >= 3 ? '' : 'Enter the guardian\'s name.'; },
  mobile: function (v) { return /^[0-9]{10}$/.test(v.trim()) ? '' : 'Enter a valid 10-digit mobile number.'; },
  email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter a valid email address.'; },
  address: function (v) { return v.trim().length >= 5 ? '' : 'Enter the full address.'; },
  city: function (v) { return v.trim().length >= 2 ? '' : 'Enter a city.'; },
  state: function (v) { return v.trim().length >= 2 ? '' : 'Enter a state.'; },
  pincode: function (v) { return /^[0-9]{6}$/.test(v.trim()) ? '' : 'Enter a valid 6-digit PIN code.'; },
  course: function (v) { return v ? '' : 'Select a course.'; },
  branch: function (v) { return v ? '' : 'Select a branch.'; },
  academicYear: function (v) { return v ? '' : 'Select an academic year.'; }
};

function showFieldError(fieldName, message) {
  const input = registrationForm.elements[fieldName];
  const errorEl = registrationForm.querySelector('.error-msg[data-for="' + fieldName + '"]');
  if (input) input.classList.toggle('invalid', !!message);
  if (errorEl) errorEl.textContent = message;
}

function validateField(fieldName) {
  const input = registrationForm.elements[fieldName];
  const message = validators[fieldName](input.value);
  showFieldError(fieldName, message);
  return message === '';
}

Object.keys(validators).forEach(function (fieldName) {
  const input = registrationForm.elements[fieldName];
  if (!input) return;
  input.addEventListener('blur', function () { validateField(fieldName); });
});

// Digit-only inputs
['mobile', 'pincode'].forEach(function (fieldName) {
  registrationForm.elements[fieldName].addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });
});

registrationForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  let isValid = true;
  Object.keys(validators).forEach(function (fieldName) {
    if (!validateField(fieldName)) isValid = false;
  });

  if (!isValid) {
    formStatus.textContent = 'Please fix the highlighted fields before submitting.';
    formStatus.classList.remove('ok');
    return;
  }

  const data = {
    fullName: registrationForm.elements.fullName.value.trim(),
    dob: registrationForm.elements.dob.value,
    gender: registrationForm.elements.gender.value,
    guardianName: registrationForm.elements.guardianName.value.trim(),
    mobile: registrationForm.elements.mobile.value.trim(),
    email: registrationForm.elements.email.value.trim(),
    address: registrationForm.elements.address.value.trim(),
    city: registrationForm.elements.city.value.trim(),
    state: registrationForm.elements.state.value.trim(),
    pincode: registrationForm.elements.pincode.value.trim(),
    course: registrationForm.elements.course.value,
    branch: registrationForm.elements.branch.value,
    academicYear: registrationForm.elements.academicYear.value
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';
  formStatus.textContent = '';

  try {
    const result = await callApi('register', { data: data });

    if (result.success) {
      document.getElementById('sName').textContent = data.fullName;
      document.getElementById('sRegId').textContent = result.registrationId;
      document.getElementById('sCourse').textContent = data.course;
      document.getElementById('sBranch').textContent = data.branch;
      document.getElementById('sDate').textContent = result.registrationDate;
      registrationForm.reset();
      Object.keys(validators).forEach(function (fieldName) { showFieldError(fieldName, ''); });
      showView('success');
    } else {
      formStatus.textContent = result.message || 'Registration failed. Please try again.';
      formStatus.classList.remove('ok');
    }
  } catch (err) {
    formStatus.textContent = err.message || 'Could not reach the server. Please try again.';
    formStatus.classList.remove('ok');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit registration';
  }
});

document.getElementById('printBtn').addEventListener('click', function () {
  window.print();
});

document.getElementById('newRegBtn').addEventListener('click', function () {
  showView('register');
});

// ==================================================================
// ADMIN LOGIN
// ==================================================================

const adminLoginForm = document.getElementById('adminLoginForm');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminLoginStatus = document.getElementById('adminLoginStatus');

adminLoginForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  const username = document.getElementById('adminUsername').value.trim();
  const password = document.getElementById('adminPassword').value;

  if (!username || !password) {
    adminLoginStatus.textContent = 'Enter both username and password.';
    return;
  }

  adminLoginBtn.disabled = true;
  adminLoginBtn.textContent = 'Logging in…';
  adminLoginStatus.textContent = '';

  try {
    const result = await callApi('adminLogin', { username: username, password: password });
    if (result.success) {
      sessionStorage.setItem('sanaAdminToken', result.token);
      adminLoginForm.reset();
      showView('adminDashboard');
      loadStudents();
    } else {
      adminLoginStatus.textContent = result.message || 'Login failed.';
    }
  } catch (err) {
    adminLoginStatus.textContent = err.message || 'Could not reach the server.';
  } finally {
    adminLoginBtn.disabled = false;
    adminLoginBtn.textContent = 'Log in';
  }
});

document.getElementById('logoutBtn').addEventListener('click', function () {
  sessionStorage.removeItem('sanaAdminToken');
  showView('register');
});

// ==================================================================
// ADMIN DASHBOARD
// ==================================================================

let allStudents = [];

async function loadStudents() {
  const tbody = document.getElementById('studentsTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Loading registrations…</td></tr>';

  const token = sessionStorage.getItem('sanaAdminToken');
  if (!token) {
    showView('adminLogin');
    return;
  }

  try {
    const result = await callApi('getStudents', { token: token });

    if (!result.success) {
      if (result.message && result.message.toLowerCase().indexOf('session') !== -1) {
        sessionStorage.removeItem('sanaAdminToken');
        showView('adminLogin');
        adminLoginStatus.textContent = result.message;
        return;
      }
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">' + escapeHtml(result.message || 'Could not load data.') + '</td></tr>';
      return;
    }

    allStudents = result.students || [];
    populateFilterOptions(allStudents);
    updateStats(allStudents);
    renderStudentsTable();
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">' + escapeHtml(err.message || 'Network error.') + '</td></tr>';
  }
}

function populateFilterOptions(students) {
  const courseSelect = document.getElementById('filterCourse');
  const branchSelect = document.getElementById('filterBranch');
  const currentCourse = courseSelect.value;
  const currentBranch = branchSelect.value;

  const courses = Array.from(new Set(students.map(function (s) { return s.course; }))).sort();
  const branches = Array.from(new Set(students.map(function (s) { return s.branch; }))).sort();

  courseSelect.innerHTML = '<option value="">All courses</option>' +
    courses.map(function (c) { return '<option value="' + escapeAttr(c) + '">' + escapeHtml(c) + '</option>'; }).join('');
  branchSelect.innerHTML = '<option value="">All branches</option>' +
    branches.map(function (b) { return '<option value="' + escapeAttr(b) + '">' + escapeHtml(b) + '</option>'; }).join('');

  courseSelect.value = currentCourse;
  branchSelect.value = currentBranch;
}

function updateStats(students) {
  document.getElementById('statTotal').textContent = students.length;

  const todayStr = formatDateOnly(new Date());
  const todayCount = students.filter(function (s) {
    return String(s.registrationDate || '').indexOf(todayStr) === 0;
  }).length;
  document.getElementById('statToday').textContent = todayCount;

  let latest = '—';
  if (students.length > 0) {
    const sorted = students.slice().sort(function (a, b) {
      return parseRegDate(b.registrationDate) - parseRegDate(a.registrationDate);
    });
    latest = sorted[0].registrationId;
  }
  document.getElementById('statLatest').textContent = latest;
}

function formatDateOnly(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return dd + '-' + mm + '-' + yyyy;
}

function parseRegDate(str) {
  // Expected format: dd-MM-yyyy HH:mm:ss
  if (!str) return 0;
  const parts = String(str).split(/[\s:-]/); // [dd, MM, yyyy, HH, mm, ss]
  if (parts.length < 3) return 0;
  const [dd, mm, yyyy, HH, mi, ss] = parts;
  return new Date(yyyy, mm - 1, dd, HH || 0, mi || 0, ss || 0).getTime();
}

function renderStudentsTable() {
  const tbody = document.getElementById('studentsTableBody');

  const regId = document.getElementById('searchRegId').value.trim().toLowerCase();
  const name = document.getElementById('searchName').value.trim().toLowerCase();
  const mobile = document.getElementById('searchMobile').value.trim();
  const course = document.getElementById('filterCourse').value;
  const branch = document.getElementById('filterBranch').value;
  const sortOrder = document.getElementById('sortOrder').value;

  let filtered = allStudents.filter(function (s) {
    if (regId && String(s.registrationId).toLowerCase().indexOf(regId) === -1) return false;
    if (name && String(s.studentName).toLowerCase().indexOf(name) === -1) return false;
    if (mobile && String(s.mobile).indexOf(mobile) === -1) return false;
    if (course && s.course !== course) return false;
    if (branch && s.branch !== branch) return false;
    return true;
  });

  filtered.sort(function (a, b) {
    const diff = parseRegDate(a.registrationDate) - parseRegDate(b.registrationDate);
    return sortOrder === 'asc' ? diff : -diff;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No registrations match these filters.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function (s) {
    return '<tr>' +
      '<td>' + escapeHtml(s.registrationId) + '</td>' +
      '<td>' + escapeHtml(s.studentName) + '</td>' +
      '<td>' + escapeHtml(s.mobile) + '</td>' +
      '<td>' + escapeHtml(s.course) + '</td>' +
      '<td>' + escapeHtml(s.branch) + '</td>' +
      '<td>' + escapeHtml(s.academicYear) + '</td>' +
      '<td>' + escapeHtml(s.registrationDate) + '</td>' +
      '<td><span class="status-pill">' + escapeHtml(s.status || 'Confirmed') + '</span></td>' +
      '</tr>';
  }).join('');
}

['searchRegId', 'searchName', 'searchMobile'].forEach(function (id) {
  document.getElementById(id).addEventListener('input', renderStudentsTable);
});
['filterCourse', 'filterBranch', 'sortOrder'].forEach(function (id) {
  document.getElementById(id).addEventListener('change', renderStudentsTable);
});
document.getElementById('refreshBtn').addEventListener('click', loadStudents);

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function escapeAttr(str) { return escapeHtml(str); }

// ==================================================================
// INIT
// ==================================================================

document.getElementById('year').textContent = new Date().getFullYear();
showView('register');
