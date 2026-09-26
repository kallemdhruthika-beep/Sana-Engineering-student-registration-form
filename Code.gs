/**
 * SANA ENGINEERING COLLEGE — Student Registration System
 * Backend: Google Apps Script
 * Database: Google Sheets
 *
 * Paste this entire file into Extensions → Apps Script (see README.md for
 * full deployment steps). No other backend, database, or server is used.
 */

// ----------------------------------------------------------------------
// CONFIG
// ----------------------------------------------------------------------

var SHEET_NAME = 'Registrations';
var COLLEGE_CODE = 'SANA';
var ADMIN_TOKEN_TTL_SECONDS = 3600; // admin session length: 1 hour

var SHEET_HEADERS = [
  'S.No', 'Registration ID', 'Student Name', 'Date of Birth', 'Gender',
  'Guardian Name', 'Mobile', 'Email', 'Address', 'City', 'State',
  'PIN Code', 'Course', 'Branch', 'Academic Year', 'Registration Date', 'Status'
];

// ----------------------------------------------------------------------
// ENTRY POINTS
// ----------------------------------------------------------------------

function doGet(e) {
  return jsonResponse({
    success: true,
    message: 'SANA Engineering College Registration API is running.'
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, message: 'No request body received.' });
    }

    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    switch (action) {
      case 'register':
        return jsonResponse(handleRegister(body.data || {}));
      case 'adminLogin':
        return jsonResponse(handleAdminLogin(body.username, body.password));
      case 'getStudents':
        return jsonResponse(handleGetStudents(body.token));
      default:
        return jsonResponse({ success: false, message: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, message: 'Server error: ' + err.message });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ----------------------------------------------------------------------
// SHEET HELPERS
// ----------------------------------------------------------------------

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SHEET_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ----------------------------------------------------------------------
// REGISTRATION
// ----------------------------------------------------------------------

function handleRegister(data) {
  var required = [
    'fullName', 'dob', 'gender', 'guardianName', 'mobile', 'email',
    'address', 'city', 'state', 'pincode', 'course', 'branch', 'academicYear'
  ];

  for (var i = 0; i < required.length; i++) {
    var field = required[i];
    if (!data[field] || String(data[field]).trim() === '') {
      return { success: false, message: 'Missing required field: ' + field };
    }
  }

  if (!/^[0-9]{10}$/.test(String(data.mobile).trim())) {
    return { success: false, message: 'Mobile number must be exactly 10 digits.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim())) {
    return { success: false, message: 'Please enter a valid email address.' };
  }
  if (!/^[0-9]{6}$/.test(String(data.pincode).trim())) {
    return { success: false, message: 'PIN code must be exactly 6 digits.' };
  }

  // A script lock guarantees only one registration writes to the sheet at a
  // time, so two students submitting at the same moment can never receive
  // the same Registration ID.
  var lock = LockService.getScriptLock();
  var gotLock = lock.tryLock(30000);
  if (!gotLock) {
    return { success: false, message: 'Server is busy, please try submitting again.' };
  }

  try {
    var sheet = getSheet();
    var registrationId = generateNextRegistrationId(sheet);
    var serial = sheet.getLastRow(); // header occupies row 1, so this is the new row's serial number
    var timeZone = Session.getScriptTimeZone();
    var registrationDate = Utilities.formatDate(new Date(), timeZone, 'dd-MM-yyyy HH:mm:ss');

    sheet.appendRow([
      serial,
      registrationId,
      String(data.fullName).trim(),
      String(data.dob).trim(),
      String(data.gender).trim(),
      String(data.guardianName).trim(),
      String(data.mobile).trim(),
      String(data.email).trim(),
      String(data.address).trim(),
      String(data.city).trim(),
      String(data.state).trim(),
      String(data.pincode).trim(),
      String(data.course).trim(),
      String(data.branch).trim(),
      String(data.academicYear).trim(),
      registrationDate,
      'Confirmed'
    ]);

    return {
      success: true,
      registrationId: registrationId,
      registrationDate: registrationDate
    };
  } catch (err) {
    return { success: false, message: 'Could not save registration: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

function generateNextRegistrationId(sheet) {
  var year = new Date().getFullYear();
  var prefix = COLLEGE_CODE + year;
  var lastRow = sheet.getLastRow();
  var maxSeq = 0;

  if (lastRow > 1) {
    var ids = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); // column B = Registration ID
    for (var i = 0; i < ids.length; i++) {
      var id = String(ids[i][0]);
      if (id.indexOf(prefix) === 0) {
        var seq = parseInt(id.substring(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
  }

  var nextSeq = maxSeq + 1;
  var seqStr = ('0000' + nextSeq).slice(-4);
  return prefix + seqStr;
}

// ----------------------------------------------------------------------
// ADMIN AUTH
// ----------------------------------------------------------------------

function handleAdminLogin(username, password) {
  if (!username || !password) {
    return { success: false, message: 'Username and password are required.' };
  }

  var props = PropertiesService.getScriptProperties();
  var adminUser = 'janipasha';
  var adminPass  = 'sana@2026';

  if (String(username).trim() === adminUser && String(password) === adminPass) {
    var token = Utilities.getUuid();
    CacheService.getScriptCache().put('admin_token_' + token, 'valid', ADMIN_TOKEN_TTL_SECONDS);
    return { success: true, token: token };
  }

  return { success: false, message: 'Invalid username or password.' };
}

function verifyAdminToken(token) {
  if (!token) return false;
  var cache = CacheService.getScriptCache();
  return cache.get('admin_token_' + token) === 'valid';
}

// ----------------------------------------------------------------------
// ADMIN DATA
// ----------------------------------------------------------------------

function handleGetStudents(token) {
  if (!verifyAdminToken(token)) {
    return { success: false, message: 'Session expired. Please log in again.' };
  }

  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { success: true, students: [] };
  }

  var numRows = lastRow - 1;
  var values = sheet.getRange(2, 1, numRows, SHEET_HEADERS.length).getValues();
  var timeZone = Session.getScriptTimeZone();

  var students = values.map(function (row) {
    return {
      serial: row[0],
      registrationId: row[1],
      studentName: row[2],
      dob: formatIfDate(row[3], timeZone),
      gender: row[4],
      guardianName: row[5],
      mobile: row[6],
      email: row[7],
      address: row[8],
      city: row[9],
      state: row[10],
      pincode: row[11],
      course: row[12],
      branch: row[13],
      academicYear: row[14],
      registrationDate: formatIfDate(row[15], timeZone),
      status: row[16]
    };
  });

  return { success: true, students: students };
}

function formatIfDate(value, timeZone) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, timeZone, 'dd-MM-yyyy HH:mm:ss');
  }
  return value;
}
