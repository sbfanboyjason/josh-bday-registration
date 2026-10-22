/**
 * ============================================================
 *  TEAM DASHBOARD — backend for dashboard/index.html
 * ============================================================
 *  Add this as a THIRD script file in the same Apps Script project
 *  (File > + > Script, name it "Dashboard"). It shares CONFIG, HEADERS,
 *  STATUS, ATTENDEE_TYPE, computeBudget_() etc. with Code.gs, the
 *  staff sign-in (PINs, sessions) with Checkin.gs, and the sponsor
 *  list with Sponsors.gs.
 *
 *  Sign-in uses the same 6-digit PINs as the check-in scanner.
 *    - Every signed-in team member can VIEW the budget and the lists.
 *    - Only the Admin role (set in the _Staff sheet) can ADD or REMOVE
 *      a free pass, because each one costs the venue fee per head.
 *
 *  A free pass is a normal row in the Registrations sheet with
 *  Attendee Type = Guest, Admin or Volunteer, Status = Approved and
 *  Payment Channel = Complimentary. That way the scanner, the attendee
 *  list and the seat count treat it like any other ticket.
 * ============================================================
 */

const DASH = {
  MAX_NOTE: 200,
  MAX_NAME: 60,
};

function handleDashboard_(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ ok: false, code: 'BAD_REQUEST', error: 'Malformed request.' });
  }

  try {
    const staff = ciSessionStaff_(req.token);
    if (!staff) {
      return jsonResponse({ ok: false, code: 'AUTH', error: 'Your session has ended. Please sign in again.' });
    }

    switch (req.op) {
      case 'overview':
        return jsonResponse(dashOverview_(staff));
      case 'list':
        return jsonResponse(dashList_(req, staff));
      case 'addFree':
        return jsonResponse(dashAddFree_(req, staff));
      case 'removeFree':
        return jsonResponse(dashRemoveFree_(req, staff));
      case 'resendPass':
        return jsonResponse(dashResendPass_(req, staff));
      case 'sponsors':
        return jsonResponse(dashSponsorList_(staff)); // Sponsors.gs
      case 'sponsorSave':
        return jsonResponse(dashSponsorSave_(req, staff));
      case 'sponsorSeed':
        return jsonResponse(dashSponsorSeed_(staff));
      case 'ninangs':
        return jsonResponse(dashNinangList_(staff)); // Ninangs.gs
      case 'ninangSave':
        return jsonResponse(dashNinangSave_(req, staff));
      default:
        return jsonResponse({ ok: false, code: 'BAD_REQUEST', error: 'Unknown operation.' });
    }
  } catch (err) {
    console.error('handleDashboard_ error: ' + err.stack);
    return jsonResponse({ ok: false, code: 'SERVER', error: 'Server error: ' + err.message });
  }
}

// ============================================================
//  READ
// ============================================================

function dashSheetData_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  return { sheet: sheet, data: sheet.getDataRange().getValues() };
}

function dashOverview_(staff) {
  const d = dashSheetData_();
  return {
    ok: true,
    me: { name: staff.name, role: staff.role },
    event: { name: CONFIG.EVENT_NAME, date: CONFIG.EVENT_DATE_DISPLAY, venue: CONFIG.VENUE, address: CONFIG.VENUE_ADDRESS },
    budget: computeBudget_(d.data),
    email: qrEmailStatus_(),
    registrationOpen: getSwitch_('Registration Open'),
    generatedAt: Utilities.formatDate(new Date(), CHECKIN.TZ, 'MMM d, h:mm:ss a'),
  };
}

/** One row as the dashboard sees it. Contact details only for the Admin role. */
function dashRow_(row, staff) {
  const c = function (h) { return row[HEADERS.indexOf(h)]; };
  const out = {
    key: String(c('QR Token') || ''),
    regId: String(c('Registration ID') || ''),
    type: String(c('Attendee Type') || ATTENDEE_TYPE.REGISTRANT),
    firstName: String(c('First Name') || ''),
    lastName: String(c('Last Name') || ''),
    name: String(c('Full Legal Name') || ''),
    qty: Number(c('Ticket Quantity')) || 0,
    fanType: String(c('Fan Type') || ''),
    facebook: String(c('Facebook Link') || ''),
    status: String(c('Status') || ''),
    checkedIn: String(c('Checked In') || '').toLowerCase() === 'yes',
    note: String(c('Admin Notes') || ''),
    addedAt: c('Timestamp') ? Utilities.formatDate(new Date(c('Timestamp')), CHECKIN.TZ, 'MMM d, h:mm a') : '',
  };
  if (staff.role !== 'Admin') {
    // The QR token IS the ticket, so only admins get it (to show or send a pass).
    out.key = '';
  } else {
    out.email = String(c('Email Address') || '');
    out.phone = String(c('Phone Number') || '');
  }
  return out;
}

function dashList_(req, staff) {
  const type = String(req.type || '');
  if (Object.values(ATTENDEE_TYPE).indexOf(type) === -1) {
    return { ok: false, code: 'BAD_REQUEST', error: 'Unknown list.' };
  }
  const d = dashSheetData_();
  const typeCol = HEADERS.indexOf('Attendee Type');
  const idCol = HEADERS.indexOf('Registration ID');
  const rows = [];
  for (let i = 1; i < d.data.length; i++) {
    if (!d.data[i][idCol]) continue;
    if (String(d.data[i][idCol]).toUpperCase().indexOf('TEST-') === 0 && !req.includeTests) continue;
    const rowType = String(d.data[i][typeCol] || ATTENDEE_TYPE.REGISTRANT);
    if (rowType !== type) continue;
    rows.push(dashRow_(d.data[i], staff));
  }
  rows.sort(function (a, b) {
    return (a.lastName + ' ' + a.firstName).toLowerCase().localeCompare((b.lastName + ' ' + b.firstName).toLowerCase());
  });
  return { ok: true, type: type, rows: rows, canEdit: staff.role === 'Admin' };
}

// ============================================================
//  WRITE (Admin role only)
// ============================================================

function dashCleanName_(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, DASH.MAX_NAME);
}

function dashAddFree_(req, staff) {
  if (staff.role !== 'Admin') return { ok: false, code: 'FORBIDDEN', error: 'Only an admin can add free passes.' };

  const type = String(req.type || '');
  if (FREE_TYPES.indexOf(type) === -1) return { ok: false, code: 'BAD_REQUEST', error: 'Pick Guest, Admin or Volunteer.' };

  const first = dashCleanName_(req.firstName);
  const last = dashCleanName_(req.lastName);
  if (!first || !last) return { ok: false, code: 'BAD_REQUEST', error: 'First name and last name are both required.' };

  const email = String(req.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, code: 'BAD_REQUEST', error: 'That email address does not look right. Leave it blank if you do not have one.' };
  }
  const phone = String(req.phone || '').trim();
  if (phone && !/^(\+?63|0)9\d{9}$/.test(phone.replace(/\s|-/g, ''))) {
    return { ok: false, code: 'BAD_REQUEST', error: 'That mobile number does not look right. Leave it blank if you do not have one.' };
  }
  const note = String(req.note || '').trim().slice(0, DASH.MAX_NOTE);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, code: 'BUSY', error: 'The system is busy. Try again in a few seconds.' };

  let rowObj, regId;
  try {
    const d = dashSheetData_();
    const fullName = joinName_(first, last);

    // Same person already holding a free pass of any type?
    const nameCol = HEADERS.indexOf('Full Legal Name');
    const typeCol = HEADERS.indexOf('Attendee Type');
    const statusCol = HEADERS.indexOf('Status');
    for (let i = 1; i < d.data.length; i++) {
      if (
        String(d.data[i][nameCol]).trim().toLowerCase() === fullName.toLowerCase() &&
        FREE_TYPES.indexOf(String(d.data[i][typeCol])) !== -1 &&
        d.data[i][statusCol] === STATUS.APPROVED &&
        !req.allowDuplicate
      ) {
        return {
          ok: false,
          code: 'DUPLICATE',
          error: fullName + ' already has a ' + d.data[i][typeCol] + ' pass (' + d.data[i][HEADERS.indexOf('Registration ID')] + ').',
        };
      }
    }

    const cap = getVenueCapacity();
    const claimed = getClaimedTicketCount(d.sheet);
    if (claimed + 1 > cap) {
      return { ok: false, code: 'FULL', error: 'The venue is full (' + claimed + ' of ' + cap + ' seats taken). Remove someone or raise the capacity in _Config first.' };
    }

    regId = generateRegistrationId(d.sheet, type);
    const now = new Date();
    const row = new Array(HEADERS.length).fill('');
    const put = function (h, v) { row[HEADERS.indexOf(h)] = v; };
    put('Timestamp', now);
    put('Registration ID', regId);
    put('Attendee Type', type);
    put('First Name', sanitizeForSheet_(first));
    put('Last Name', sanitizeForSheet_(last));
    put('Full Legal Name', sanitizeForSheet_(fullName));
    put('Email Address', sanitizeForSheet_(email));
    put('Phone Number', sanitizeForSheet_(phone));
    put('Ticket Quantity', 1);
    put('Payment Channel', 'Complimentary');
    put('Payment Reference No.', 'N/A');
    put('Status', STATUS.APPROVED);
    put('QR Token', Utilities.getUuid());
    put('Checked In', 'No');
    put('DPA Consent Given', 'Added by team');
    put('Terms Accepted', 'Added by team');
    put('Admin Notes', sanitizeForSheet_('[' + ciFormatTime_(now) + '] Free ' + type + ' pass added by ' + staff.name + (note ? ': ' + note : '.')));
    put('Last Updated', now);
    d.sheet.appendRow(row);
    SpreadsheetApp.flush();
    rowObj = rowValuesToObject(row);
  } finally {
    lock.releaseLock();
  }

  ciAudit_(staff, regId, 'Attendee Type', '', type, 'Free pass added from team dashboard');

  // Record the outcome so the background QR sender neither repeats it nor
  // emails someone the admin chose not to email.
  let emailed = false;
  const regSheet = dashSheetData_().sheet;
  const rowNum = findRowByRegId_(regSheet, regId);
  if (email && req.sendEmail !== false) {
    try {
      if (mailQuotaLeft_() < 1) throw new Error('daily email limit reached');
      sendApprovalEmailWithQr(rowObj);
      emailed = true;
      if (rowNum) markQrEmail_(regSheet, rowNum, 'Sent ' + Utilities.formatDate(new Date(), 'Asia/Manila', 'MMM d, h:mm a'));
    } catch (err) {
      // Left unmarked, so the background sender retries it.
      console.error('Free pass email failed for ' + regId + ': ' + err.message);
    }
  } else if (rowNum) {
    markQrEmail_(regSheet, rowNum, email ? 'Not sent (admin chose not to email)' : 'Not sent (no email)');
  }

  const after = computeBudget_(dashSheetData_().data);
  return {
    ok: true,
    record: dashRow_(HEADERS.map(function (h) { return rowObj[h]; }), staff),
    emailed: emailed,
    budget: after,
    warning: after.coverableIfSoldOut
      ? ''
      : 'Heads up: with ' + after.freeTotal + ' free passes, even a sold-out venue cannot cover them all. The most a full house can cover is ' + after.maxFreeIfSoldOut + '.',
  };
}

/** Cancels a free pass (never deletes the row, so the history stays). */
function dashRemoveFree_(req, staff) {
  if (staff.role !== 'Admin') return { ok: false, code: 'FORBIDDEN', error: 'Only an admin can remove free passes.' };
  const reason = String(req.reason || '').trim().slice(0, DASH.MAX_NOTE);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, code: 'BUSY', error: 'The system is busy. Try again in a few seconds.' };

  let regId, type;
  try {
    const d = dashSheetData_();
    const cols = ciColumns_(d.sheet);
    const idx = ciFindRow_(d.data, cols, req.key);
    if (idx === -1) return { ok: false, code: 'NOT_FOUND', error: 'That pass could not be found.' };
    const rec = dashRow_(d.data[idx], staff);
    regId = rec.regId;
    type = rec.type;
    if (FREE_TYPES.indexOf(rec.type) === -1) {
      return { ok: false, code: 'FORBIDDEN', error: 'Paid registrations are managed in the spreadsheet Status column, not here.' };
    }
    if (rec.status !== STATUS.APPROVED) return { ok: false, code: 'ALREADY', error: 'This pass is already ' + rec.status + '.' };
    if (rec.checkedIn) return { ok: false, code: 'CHECKED_IN', error: 'This person is already checked in. Undo the check-in first.' };

    const rowNum = idx + 1;
    const now = new Date();
    const noteLine = '[' + ciFormatTime_(now) + '] Free pass removed by ' + staff.name + (reason ? ': ' + reason : '.');
    d.sheet.getRange(rowNum, HEADERS.indexOf('Status') + 1).setValue(STATUS.CANCELLED);
    d.sheet.getRange(rowNum, HEADERS.indexOf('Admin Notes') + 1)
      .setValue(sanitizeForSheet_(rec.note ? rec.note + '\n' + noteLine : noteLine));
    d.sheet.getRange(rowNum, HEADERS.indexOf('Last Updated') + 1).setValue(now);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  ciAudit_(staff, regId, 'Status', STATUS.APPROVED, STATUS.CANCELLED, 'Free ' + type + ' pass removed from team dashboard');
  return { ok: true, budget: computeBudget_(dashSheetData_().data) };
}

/** Emails the pass (with QR) again, e.g. after an email address was added in the sheet. */
function dashResendPass_(req, staff) {
  if (staff.role !== 'Admin') return { ok: false, code: 'FORBIDDEN', error: 'Only an admin can send passes.' };
  const d = dashSheetData_();
  const cols = ciColumns_(d.sheet);
  const idx = ciFindRow_(d.data, cols, req.key);
  if (idx === -1) return { ok: false, code: 'NOT_FOUND', error: 'That pass could not be found.' };
  const rowObj = rowValuesToObject(d.data[idx]);
  if (rowObj['Status'] !== STATUS.APPROVED) return { ok: false, code: 'BAD_STATE', error: 'Only active passes can be sent.' };
  if (!String(rowObj['Email Address'] || '').trim()) {
    return { ok: false, code: 'NO_EMAIL', error: 'No email on file. Add one in the spreadsheet, or screenshot the QR instead.' };
  }
  if (mailQuotaLeft_() < 1) return { ok: false, code: 'QUOTA', error: 'The daily email limit is used up. Try again tomorrow, or screenshot the QR instead.' };
  sendApprovalEmailWithQr(rowObj);
  markQrEmail_(d.sheet, idx + 1, 'Sent ' + Utilities.formatDate(new Date(), 'Asia/Manila', 'MMM d, h:mm a'));
  ciAudit_(staff, rowObj['Registration ID'], '', '', '', 'Pass email sent from team dashboard');
  return { ok: true };
}
