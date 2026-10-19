/**
 * ============================================================
 *  GAME TIME: THE NEVER GROWING OLD SSOB'S BIRTHDAY CELEBRATION
 *  Registration System Backend
 *  (Google Apps Script, attached to the registration spreadsheet)
 * ============================================================
 *  Date    : Saturday, November 14, 2026, 5:00 PM onwards
 *  Venue   : Teaspoon Cafe, 5B & 6A Juan Luna Street, Gagalangin, Tondo, Manila 1013
 *  Fan-organized by SB19 A'tin Fanboys
 *
 *  Built from the "Wakas at Simula" block screening system. The
 *  payment, correction, approval, audit, backup and check-in flows
 *  work the same way. What is new for this event:
 *
 *  FIRST AND LAST NAME
 *  ---------------------------------------------------------
 *  The form collects First Name and Last Name separately. The sheet
 *  also keeps a combined "Full Legal Name" column, which the emails,
 *  the attendee list and the check-in scanner read.
 *
 *  ATTENDEE TYPES (free passes)
 *  ---------------------------------------------------------
 *  Every row has an "Attendee Type":
 *    Registrant  paid ₱549 through the public form
 *    Guest       free, added by an admin from the team dashboard
 *    Admin       free, added by an admin from the team dashboard
 *    Volunteer   free, added by an admin from the team dashboard
 *  Free passes skip payment, are Approved straight away, take one seat
 *  each from the venue capacity, and get a QR code like everyone else.
 *  To remove a free pass, the dashboard sets its Status to Cancelled.
 *
 *  BUDGET MODEL
 *  ---------------------------------------------------------
 *  The venue charges a fixed amount per head (₱495, food included) for
 *  EVERYONE inside, paid or free. Each paid registrant pays ₱549, so
 *  each one leaves ₱54 after their own plate. Free passes are covered
 *  by that ₱54 margin:
 *    surplus          = paid heads x 549 - (paid heads + free heads) x 495
 *    paid needed      = ceil(free heads x 495 / 54)
 *    max free passes a sold-out venue can cover
 *                     = floor(capacity x 54 / 549)   (11 at 120 seats)
 *  Fee, venue cost and capacity live in the "_Config" sheet, so a
 *  change from the venue is one cell edit, not a code change.
 *
 *  SETUP: see SETUP.md in the repository.
 * ============================================================
 */

const CONFIG = {
  EVENT_NAME: "GAME TIME: SSOB's Birthday Celebration",
  EVENT_SUBTITLE: "The Never Growing Old SSOB's Birthday Celebration",
  EVENT_DATE_DISPLAY: 'Saturday, November 14, 2026, 5:00 PM onwards',
  VENUE: 'Teaspoon Cafe',
  VENUE_ADDRESS: '5B & 6A Juan Luna Street, Gagalangin, Tondo, Manila 1013',
  VENUE_MAP_URL: 'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('Teaspoon Cafe, 5B & 6A Juan Luna Street, Gagalangin, Tondo, Manila'),
  MENU_NAME: 'Josh Birthday Admin',

  // Fallback values only. The live values are read from the _Config sheet
  // (see getSetting_), so the team can change them without touching code.
  VENUE_CAPACITY: 120,
  REGISTRATION_FEE: 549,
  VENUE_COST_PER_HEAD: 495,

  // Individual registration: one person per form. Ticket Quantity stays in
  // the sheet (always 1) so the seat count and check-in keep working.
  MAX_TICKETS_PER_REGISTRATION: 1,

  CORRECTION_WINDOW_HOURS: 24,

  SHEET_NAME: 'Registrations',
  CONFIG_SHEET_NAME: '_Config',
  DRIVE_FOLDER_NAME: 'Josh Birthday - Payment Screenshots',

  SENDER_DISPLAY_NAME: 'GAME TIME Birthday Celebration',
  ORGANIZER_CONTACT_EMAIL: 'sbfanboyjason@gmail.com',

  // Base URL of the published site (GitHub Pages), no trailing slash.
  // Update this once the new repository is published.
  SITE_BASE_URL: 'https://sbfanboyjason.github.io/josh-bday-registration',

  ADMIN_NOTIFICATION_EMAILS: [],

  CURRENCY: '₱',

  // Condensed copy of TERMS_HTML in assets/config.js, used in the approval email.
  TERMS_SUMMARY_HTML:
    '<ul>' +
    '<li>Your registration is <strong>non-refundable but transferable</strong>. Tell us in advance if someone else will use it.</li>' +
    '<li>Bring your entry QR code and a valid ID matching the registered name (or the name of the person it was transferred to).</li>' +
    '<li>Your registration includes your food at the venue.</li>' +
    '<li>This is an independently organized fan celebration, not an official SB19 or management event.</li>' +
    '</ul>',
};

const STATUS = {
  PENDING: 'Pending Payment Verification',
  NEEDS_CORRECTION: 'Payment Mismatch - Awaiting Correction',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired - Auto-Released',
};

// Statuses that still count against the venue capacity (i.e. still "hold" seats).
const HOLDING_STATUSES = [STATUS.PENDING, STATUS.NEEDS_CORRECTION, STATUS.APPROVED];

// Who is attending, and on what basis. Only REGISTRANT pays.
const ATTENDEE_TYPE = {
  REGISTRANT: 'Registrant',
  GUEST: 'Guest',
  ADMIN: 'Admin',
  VOLUNTEER: 'Volunteer',
};
const FREE_TYPES = [ATTENDEE_TYPE.GUEST, ATTENDEE_TYPE.ADMIN, ATTENDEE_TYPE.VOLUNTEER];

const FAN_TYPES = ['Fanboy', 'Fangirl'];

/**
 * "facebook.com/jeizone", "https://www.facebook.com/jeizone/", "m.facebook.com/x",
 * "fb.com/x" or "facebook.com/profile.php?id=123" -> "https://facebook.com/...".
 * Returns '' when it is not a Facebook profile link.
 */
function normalizeFacebook_(raw) {
  let v = String(raw || '').trim();
  if (!v) return '';
  const m = v.match(/^(?:https?:\/\/)?(?:(?:www|m|web|mbasic)\.)?(facebook\.com|fb\.com)(\/[^?#\s]*)?(\?[^#\s]*)?/i);
  if (!m) return '';
  const path = (m[2] || '').replace(/\/+$/, '');
  if (!path) return '';
  if (/^\/profile\.php$/i.test(path)) {
    const id = (m[3] || '').match(/[?&]id=(\d+)/);
    return id ? 'https://facebook.com/profile.php?id=' + id[1] : '';
  }
  if (!/^\/[A-Za-z0-9.\-_\/]+$/.test(path)) return '';
  return 'https://facebook.com' + path;
}

// Registration ID prefix per attendee type.
const REG_ID_PREFIX = {
  Registrant: 'JB',
  Guest: 'GST',
  Admin: 'ADM',
  Volunteer: 'VOL',
};

// Hidden form field real registrants never see or fill in (it's CSS-hidden
// on the site). Automated bots that blindly fill every field tend to fill
// it anyway — if it ever arrives non-empty, treat the submission as spam.
const HONEYPOT_FIELD = 'website';

// Column order. Code that reads a column looks it up by name (HEADERS.indexOf
// or colLetter_), so the order only matters for new rows written here.
const HEADERS = [
  'Timestamp',
  'Registration ID',
  'Attendee Type',
  'First Name',
  'Last Name',
  'Full Legal Name',
  'Email Address',
  'Phone Number',
  'Fan Type',
  'Facebook Link',
  'Ticket Quantity',
  'Payment Channel',
  'Payment Reference No.',
  'Payment Screenshot URL',
  'Status',
  'Correction Deadline',
  'QR Token',
  'Checked In',
  'DPA Consent Given',
  'Terms Accepted',
  'Admin Notes',
  'Last Updated',
];

/** Column letter (A, B, ... AA) for a header name, for building sheet formulas. */
function colLetter_(header) {
  let n = HEADERS.indexOf(header) + 1;
  if (n < 1) throw new Error('Unknown column: ' + header);
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** "Juan" + "Dela Cruz" -> "Juan Dela Cruz", whitespace tidied. */
function joinName_(first, last) {
  return (String(first || '').trim() + ' ' + String(last || '').trim()).replace(/\s+/g, ' ').trim();
}

// Rows of the _Config sheet: [key, default, note]. Edited by the team.
const SETTINGS = [
  ['Registration Fee', CONFIG.REGISTRATION_FEE, 'Amount each paid registrant pays per ticket.'],
  ['Venue Cost per Head', CONFIG.VENUE_COST_PER_HEAD, 'What the venue charges per person inside, paid or free (food included).'],
  ['Venue Capacity', CONFIG.VENUE_CAPACITY, 'Total heads the venue allows: paid registrants plus guests, admin and volunteers.'],
];

/** Reads a number from the _Config sheet, falling back to the CONFIG default. */
function getSetting_(key) {
  const fallback = SETTINGS.filter(function (r) { return r[0] === key; })[0];
  const def = fallback ? Number(fallback[1]) : 0;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.CONFIG_SHEET_NAME);
  if (!sheet) return def;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) {
      const v = Number(data[i][1]);
      return isFinite(v) && v > 0 ? v : def;
    }
  }
  return def;
}

/** _Config cell (e.g. "_Config!B2") holding a setting, for sheet formulas. */
function settingCell_(key) {
  const idx = SETTINGS.map(function (r) { return r[0]; }).indexOf(key);
  return "'" + CONFIG.CONFIG_SHEET_NAME + "'!$B$" + (idx + 2);
}

/**
 * Run this once manually (menu: Josh Birthday Admin > Initialize),
 * and again any time you want to reset the header row/formatting. It
 * does not touch existing data rows.
 */
function initializeSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  sheet
    .getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#111111')
    .setFontColor('#ffffff');
  sheet.autoResizeColumns(1, HEADERS.length);

  const statusCol = HEADERS.indexOf('Status') + 1;
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.values(STATUS), true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, statusCol, 2000, 1).setDataValidation(rule);

  sheet.getRange(2, HEADERS.indexOf('Fan Type') + 1, 2000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(FAN_TYPES, true).setAllowInvalid(true).build()
  );

  const typeCol = HEADERS.indexOf('Attendee Type') + 1;
  sheet.getRange(2, typeCol, 2000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(Object.values(ATTENDEE_TYPE), true)
      .setAllowInvalid(false)
      .build()
  );

  // --- Warning-only protection: Sheets' own native "are you sure?" prompt
  // fires before any edit or bulk delete on the data rows goes through.
  // Nobody is blocked from editing — this is just a speed bump against an
  // accidental mass-clear or stray keystroke. Safe to re-run: removes its
  // own older copy first so re-running this doesn't stack duplicates.
  sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) {
    if (p.getDescription() === 'Registrations data - edit warning') p.remove();
  });
  const dataProtection = sheet
    .getRange(2, 1, 4998, HEADERS.length)
    .protect()
    .setDescription('Registrations data - edit warning');
  dataProtection.setWarningOnly(true);

  // --- _AuditLog sheet: who changed what, and when ---
  getOrCreateAuditSheet_();

  // --- _Config sheet: fee, venue cost per head, capacity. Re-running this
  // keeps whatever values the team already typed in.
  let configSheet = ss.getSheetByName(CONFIG.CONFIG_SHEET_NAME);
  if (!configSheet) configSheet = ss.insertSheet(CONFIG.CONFIG_SHEET_NAME);
  const current = SETTINGS.map(function (r) { return getSetting_(r[0]); });
  configSheet.clear();
  configSheet.getRange(1, 1, 1, 3).setValues([['Key', 'Value', 'Notes']]).setFontWeight('bold');
  configSheet.getRange(2, 1, SETTINGS.length, 3).setValues(
    SETTINGS.map(function (r, i) { return [r[0], current[i], r[2]]; })
  );
  configSheet.autoResizeColumns(1, 3);

  SpreadsheetApp.getUi().alert(
    'Sheet initialized (data-edit warning, audit log, and _Config all set up).\n\nNext steps:\n' +
      '1) Run installTriggers() once (menu item below) to activate automatic emails, the hourly expiry sweep, and the daily backup.\n' +
      '2) Deploy > New deployment > Web app, Execute as "Me", Who has access "Anyone". Copy the /exec URL.'
  );
}

/**
 * Run this once manually (menu: Josh Birthday Admin > Install
 * Automated Triggers). Sets up the two things that can't just run
 * inline: reacting to Status edits, and the hourly expiry sweep.
 * Safe to re-run — it clears old copies of these triggers first.
 */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    const fn = t.getHandlerFunction();
    if (fn === 'checkExpiredCorrections' || fn === 'runBackup' || fn === 'processConfirmedStatusChanges') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // NOTE: there is deliberately no installable onEdit trigger anymore.
  // Status-change confirmation now runs through the simple onEdit(e)
  // trigger below (auto-active just by existing in this project — it
  // needs no installation step), because only a simple trigger is
  // allowed to show a UI confirmation at the moment of the edit.

  ScriptApp.newTrigger('checkExpiredCorrections').timeBased().everyHours(1).create();

  ScriptApp.newTrigger('runBackup').timeBased().everyDays(1).atHour(2).create();

  // Sends the actual status-change email shortly after you confirm the
  // inline popup (Apps Script can't show a popup and send an authorized
  // email in the very same step — see onEdit(e) below for why).
  ScriptApp.newTrigger('processConfirmedStatusChanges').timeBased().everyMinutes(1).create();

  SpreadsheetApp.getUi().alert(
    'Triggers installed. The hourly expiry sweep and daily 2am spreadsheet ' +
      'backup are now active. Changing the Status dropdown will now pop up a ' +
      'confirmation immediately — say Yes and the registrant is emailed ' +
      'within about a minute; say No and it reverts, nothing is sent.'
  );
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(CONFIG.MENU_NAME)
    .addItem('Initialize / Reset Sheet Structure', 'initializeSheet')
    .addItem('Install Automated Triggers (run once)', 'installTriggers')
    .addItem('Build / Refresh Dashboard', 'buildDashboard')
    .addItem('Print Attendee List (Approved + Free Passes)', 'showAttendeeListDialog')
    .addSeparator()
    .addItem('Set Up Event Check-in (staff PINs)', 'setupCheckin')
    .addItem('Reset a Check-in PIN', 'resetCheckinPin')
    .addItem('Create Check-in Test Tickets', 'createCheckinTestTickets')
    .addItem('Remove Check-in Test Tickets', 'removeCheckinTestTickets')
    .addSeparator()
    .addItem('Set Up Sponsors Sheet', 'setupSponsorsSheet')
    .addItem('Load SB19 Brand Partners into Sponsors', 'loadSponsorSeed')
    .addSeparator()
    .addItem('Run Backup Now', 'runBackupNow')
    .addToUi();
}

// ============================================================
//  CAPACITY
// ============================================================

function getVenueCapacity() {
  return getSetting_('Venue Capacity');
}

/**
 * Seats held across EVERY attendee type: paid registrants still pending,
 * awaiting correction or approved, plus active free passes (always
 * Approved). Free passes therefore shrink the public pool automatically.
 */
function getClaimedTicketCount(sheet) {
  const data = sheet.getDataRange().getValues();
  const qtyCol = HEADERS.indexOf('Ticket Quantity');
  const statusCol = HEADERS.indexOf('Status');
  let claimed = 0;
  for (let i = 1; i < data.length; i++) {
    if (HOLDING_STATUSES.indexOf(data[i][statusCol]) !== -1) {
      claimed += Number(data[i][qtyCol]) || 0;
    }
  }
  return claimed;
}

/**
 * The money picture, from the rows themselves. See the BUDGET MODEL note
 * at the top of this file. "Confirmed" means Approved (payment verified);
 * "pending" means still waiting on verification or a correction, so it is
 * money that may or may not arrive.
 */
function computeBudget_(data) {
  const fee = getSetting_('Registration Fee');
  const cost = getSetting_('Venue Cost per Head');
  const capacity = getSetting_('Venue Capacity');
  const sp = typeof sponsorTotals_ === 'function' ? sponsorTotals_() : { cashReceived: 0, cashPledged: 0, itemValue: 0, total: 0, confirmed: 0 };
  const b = computeBudgetFrom_(data, fee, cost, capacity, sp.cashReceived);
  b.sponsorCashPledged = sp.cashPledged;
  b.sponsorItemValue = sp.itemValue;
  b.sponsorCount = sp.total;
  b.sponsorConfirmed = sp.confirmed;
  return b;
}

/** Pure arithmetic, kept separate from Sheets so it can be tested on its own. */
function computeBudgetFrom_(data, fee, cost, capacity, sponsorCash) {
  sponsorCash = Number(sponsorCash) || 0;
  const typeCol = HEADERS.indexOf('Attendee Type');
  const qtyCol = HEADERS.indexOf('Ticket Quantity');
  const statusCol = HEADERS.indexOf('Status');
  const checkedCol = HEADERS.indexOf('Checked In');

  const b = {
    fee: fee,
    costPerHead: cost,
    capacity: capacity,
    marginPerPaid: fee - cost,
    paidConfirmed: 0,
    paidPending: 0,
    free: { Guest: 0, Admin: 0, Volunteer: 0 },
    fanType: { Fanboy: 0, Fangirl: 0 },
    freeTotal: 0,
    checkedIn: 0,
  };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[HEADERS.indexOf('Registration ID')]) continue;
    const type = String(row[typeCol] || ATTENDEE_TYPE.REGISTRANT);
    const status = row[statusCol];
    const qty = Number(row[qtyCol]) || 0;
    if (String(row[checkedCol]).toLowerCase() === 'yes') b.checkedIn += qty;
    if (FREE_TYPES.indexOf(type) !== -1) {
      if (status === STATUS.APPROVED) {
        b.free[type] += qty;
        b.freeTotal += qty;
      }
      continue;
    }
    if (status === STATUS.APPROVED) b.paidConfirmed += qty;
    else if (status === STATUS.PENDING || status === STATUS.NEEDS_CORRECTION) b.paidPending += qty;
    else continue;
    const fan = String(row[HEADERS.indexOf('Fan Type')] || '');
    if (fan in b.fanType) b.fanType[fan] += qty;
  }

  const m = b.marginPerPaid;
  b.headcountConfirmed = b.paidConfirmed + b.freeTotal;
  b.headcountWithPending = b.headcountConfirmed + b.paidPending;
  b.seatsLeft = Math.max(0, capacity - b.headcountWithPending);

  // Sponsor cash that has actually been received counts as money in hand.
  b.sponsorCashReceived = sponsorCash;
  b.collected = b.paidConfirmed * fee;
  b.venueBill = b.headcountConfirmed * cost;
  b.surplusFromFees = b.collected - b.venueBill;
  b.surplus = b.surplusFromFees + sponsorCash;

  b.collectedWithPending = (b.paidConfirmed + b.paidPending) * fee;
  b.venueBillWithPending = b.headcountWithPending * cost;
  b.surplusWithPending = b.collectedWithPending - b.venueBillWithPending + sponsorCash;

  b.freeCost = b.freeTotal * cost;
  // Sponsor cash covers free passes first; paid margins cover the rest.
  b.freeCostAfterSponsors = Math.max(0, b.freeCost - sponsorCash);
  b.paidNeededToCover = m > 0 ? Math.ceil(b.freeCostAfterSponsors / m) : null;
  b.morePaidNeeded = b.paidNeededToCover === null ? null : Math.max(0, b.paidNeededToCover - b.paidConfirmed);
  b.morePaidNeededWithPending =
    b.paidNeededToCover === null ? null : Math.max(0, b.paidNeededToCover - b.paidConfirmed - b.paidPending);
  // Extra free passes the current confirmed surplus can already pay for.
  b.freePassesAffordableNow = b.surplus > 0 && cost > 0 ? Math.floor(b.surplus / cost) : 0;
  // If every seat sells: free F, paid capacity - F, need (capacity - F) * m + sponsors >= F * cost,
  // which works out to F <= (capacity * m + sponsors) / fee.
  b.maxFreeIfSoldOut = fee > 0 && m > 0 ? Math.min(capacity, Math.floor((capacity * m + sponsorCash) / fee)) : 0;
  // Can the remaining seats still cover the free passes if they all sell?
  const bestCaseSurplus = (capacity - b.freeTotal) * m - b.freeTotal * cost + sponsorCash;
  b.coverableIfSoldOut = bestCaseSurplus >= 0;
  b.covered = b.surplus >= 0;
  return b;
}

// ============================================================
//  WEB ENDPOINTS
// ============================================================

/**
 * GET <web-app-url>?action=slots
 *   Public read-only ticket-availability count.
 * GET <web-app-url>?action=lookup&regId=...&email=...
 *   Used by the correction page to confirm a registration exists
 *   before showing the correction form.
 */
function doGet(e) {
  const action = e.parameter.action;

  if (action === 'slots') {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    const cap = getVenueCapacity();
    const claimed = getClaimedTicketCount(sheet);
    return jsonResponse({
      ok: true,
      totalCap: cap,
      claimed: claimed,
      remaining: Math.max(0, cap - claimed),
    });
  }

  if (action === 'lookup') {
    return handleLookup(e.parameter.regId, e.parameter.email);
  }

  if (action === 'sponsors') {
    return jsonResponse(publicSponsors_()); // see Sponsors.gs
  }

  return jsonResponse({ ok: false, error: 'Unknown action.' });
}

/**
 * POST <web-app-url>                  → new registration
 * POST <web-app-url>?action=correct   → self-service payment correction
 * POST <web-app-url>?action=checkin   → event-day scanner (Checkin.gs)
 * POST <web-app-url>?action=dash      → team dashboard (Dashboard.gs)
 *
 * Content-Type must be text/plain on the client side to avoid a CORS
 * preflight — see script.js / correct.js comments.
 */
function doPost(e) {
  const action = e.parameter && e.parameter.action;
  if (action === 'checkin') {
    return handleCheckin_(e); // event-day scanner, see Checkin.gs
  }
  if (action === 'dash') {
    return handleDashboard_(e); // team dashboard, see Dashboard.gs
  }
  if (action === 'correct') {
    return handleCorrection(e);
  }
  return handleNewRegistration(e);
}

function handleNewRegistration(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse({ ok: false, error: 'Malformed request.' });
    }

    const validationError = validateRegistration(payload);
    if (validationError) {
      return jsonResponse({ ok: false, error: validationError });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    const cap = getVenueCapacity();
    const claimed = getClaimedTicketCount(sheet);
    const requestedQty = 1; // individual registration

    if (claimed + requestedQty > cap) {
      const remaining = Math.max(0, cap - claimed);
      return jsonResponse({
        ok: false,
        error:
          remaining === 0
            ? 'All slots have been claimed. Registration is now closed.'
            : `Only ${remaining} slot(s) remaining.`,
      });
    }

    const regId = generateRegistrationId(sheet, ATTENDEE_TYPE.REGISTRANT);
    const qrToken = Utilities.getUuid();
    const now = new Date();
    const firstName = String(payload.firstName).trim().replace(/\s+/g, ' ');
    const lastName = String(payload.lastName).trim().replace(/\s+/g, ' ');
    payload.fullName = joinName_(firstName, lastName); // used by the confirmation email
    payload.firstName = firstName;

    let screenshotUrl = '';
    let adminNote = '';
    try {
      screenshotUrl = saveScreenshotToDrive(
        payload.paymentScreenshotBase64,
        payload.paymentScreenshotFilename,
        regId
      );
    } catch (err) {
      adminNote = 'Screenshot upload failed server-side — ask registrant to resend proof.';
    }

    sheet.appendRow([
      now,
      regId,
      ATTENDEE_TYPE.REGISTRANT,
      sanitizeForSheet_(firstName),
      sanitizeForSheet_(lastName),
      sanitizeForSheet_(payload.fullName),
      sanitizeForSheet_(payload.email),
      sanitizeForSheet_(payload.phone),
      payload.fanType,
      payload.facebook,
      requestedQty,
      sanitizeForSheet_(payload.paymentChannel) || '',
      sanitizeForSheet_(payload.paymentReference) || '',
      screenshotUrl,
      STATUS.PENDING,
      '', // Correction Deadline — set only if flagged for correction
      qrToken,
      'No',
      payload.dpaConsent ? 'Yes' : 'No',
      payload.termsAccepted ? 'Yes' : 'No',
      adminNote,
      now,
    ]);

    try {
      sendPendingConfirmationEmail(payload, regId);
    } catch (err) {
      // Row is already saved; don't fail the registration over a bounced email.
    }

    return jsonResponse({ ok: true, registrationId: regId });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Server error: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Self-service correction: a registrant resubmits a corrected payment
 * reference and/or a new screenshot against their existing Registration
 * ID. Only allowed while the row is still "Pending" or "Payment
 * Mismatch - Awaiting Correction" — once approved/rejected/cancelled/
 * expired, this is no longer editable (matches the row being a
 * finalized outcome).
 */
function handleCorrection(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse({ ok: false, error: 'Malformed request.' });
    }

    if (payload[HONEYPOT_FIELD]) {
      return jsonResponse({ ok: false, error: 'Submission blocked.' });
    }
    if (!payload.registrationId || !payload.email) {
      return jsonResponse({ ok: false, error: 'Registration ID and email are required.' });
    }
    if (!payload.paymentReference && !payload.paymentScreenshotBase64) {
      return jsonResponse({
        ok: false,
        error: 'Please provide a corrected reference number and/or a new screenshot.',
      });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    const targetRow = findRowByRegIdAndEmail(sheet, payload.registrationId, payload.email);

    if (targetRow === -1) {
      return jsonResponse({
        ok: false,
        error:
          "We couldn't find a matching registration. Please check your Registration ID and the email you registered with.",
      });
    }

    const statusCol = HEADERS.indexOf('Status') + 1;
    const currentStatus = sheet.getRange(targetRow, statusCol).getValue();
    if (currentStatus !== STATUS.PENDING && currentStatus !== STATUS.NEEDS_CORRECTION) {
      return jsonResponse({
        ok: false,
        error:
          `This registration is already "${currentStatus}" and can no longer be edited here. ` +
          `Contact ${CONFIG.ORGANIZER_CONTACT_EMAIL} if you need help, or submit a new registration if slots remain.`,
      });
    }

    const noteParts = [];
    if (payload.paymentReference) {
      sheet
        .getRange(targetRow, HEADERS.indexOf('Payment Reference No.') + 1)
        .setValue(sanitizeForSheet_(payload.paymentReference));
      noteParts.push('reference updated');
    }
    if (payload.paymentScreenshotBase64) {
      try {
        const url = saveScreenshotToDrive(
          payload.paymentScreenshotBase64,
          payload.paymentScreenshotFilename,
          payload.registrationId
        );
        sheet.getRange(targetRow, HEADERS.indexOf('Payment Screenshot URL') + 1).setValue(url);
        noteParts.push('screenshot updated');
      } catch (err) {
        noteParts.push('screenshot re-upload failed server-side');
      }
    }

    sheet.getRange(targetRow, statusCol).setValue(STATUS.PENDING);
    sheet.getRange(targetRow, HEADERS.indexOf('Correction Deadline') + 1).setValue('');
    const now = new Date();
    sheet.getRange(targetRow, HEADERS.indexOf('Last Updated') + 1).setValue(now);

    const notesCol = HEADERS.indexOf('Admin Notes') + 1;
    const existingNotes = sheet.getRange(targetRow, notesCol).getValue();
    const noteLine = `[${now.toLocaleString()}] Registrant self-corrected (${noteParts.join(', ')}).`;
    sheet.getRange(targetRow, notesCol).setValue(existingNotes ? existingNotes + '\n' + noteLine : noteLine);

    try {
      const updatedRowValues = sheet.getRange(targetRow, 1, 1, HEADERS.length).getValues()[0];
      sendCorrectionReceivedEmail(rowValuesToObject(updatedRowValues));
    } catch (err) {
      // Best-effort — the correction itself already succeeded.
    }

    return jsonResponse({
      ok: true,
      message: 'Correction received. Your registration is back in the verification queue.',
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Server error: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

function handleLookup(regId, email) {
  if (!regId || !email) {
    return jsonResponse({ ok: false, error: 'Registration ID and email are required.' });
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const targetRow = findRowByRegIdAndEmail(sheet, regId, email);
  if (targetRow === -1) {
    return jsonResponse({ ok: false, error: "We couldn't find a matching registration." });
  }
  const rowValues = sheet.getRange(targetRow, 1, 1, HEADERS.length).getValues()[0];
  const rowObj = rowValuesToObject(rowValues);
  return jsonResponse({
    ok: true,
    fullName: rowObj['Full Legal Name'],
    status: rowObj['Status'],
    ticketQuantity: rowObj['Ticket Quantity'],
    currentReference: rowObj['Payment Reference No.'],
    editable: rowObj['Status'] === STATUS.PENDING || rowObj['Status'] === STATUS.NEEDS_CORRECTION,
  });
}

function findRowByRegIdAndEmail(sheet, regId, email) {
  const data = sheet.getDataRange().getValues();
  const regIdCol = HEADERS.indexOf('Registration ID');
  const emailCol = HEADERS.indexOf('Email Address');
  for (let i = 1; i < data.length; i++) {
    if (
      String(data[i][regIdCol]).trim().toLowerCase() === String(regId).trim().toLowerCase() &&
      String(data[i][emailCol]).trim().toLowerCase() === String(email).trim().toLowerCase()
    ) {
      return i + 1;
    }
  }
  return -1;
}

function validateRegistration(payload) {
  if (!payload) return 'Missing submission data.';
  if (payload[HONEYPOT_FIELD]) return 'Submission blocked.';
  if (!payload.firstName || String(payload.firstName).trim().length < 1) {
    return 'First name is required.';
  }
  if (!payload.lastName || String(payload.lastName).trim().length < 1) {
    return 'Last name is required.';
  }
  if (joinName_(payload.firstName, payload.lastName).length > 120) {
    return 'Name is too long.';
  }
  if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return 'A valid email address is required.';
  }
  const cleanedPhone = String(payload.phone || '').replace(/\s|-/g, '');
  if (!/^(\+?63|0)9\d{9}$/.test(cleanedPhone)) {
    return 'A valid Philippine mobile number is required (e.g. 09171234567).';
  }
  if (FAN_TYPES.indexOf(payload.fanType) === -1) {
    return 'Please choose Fanboy or Fangirl.';
  }
  payload.facebook = normalizeFacebook_(payload.facebook);
  if (!payload.facebook) {
    return 'Please enter your Facebook profile link, e.g. facebook.com/jeizone';
  }
  payload.ticketQuantity = 1;
  if (!payload.paymentChannel) return 'Please select a payment channel.';
  if (!payload.paymentReference) return 'Please enter your payment reference number.';
  if (!payload.paymentScreenshotBase64) return 'Please upload a screenshot of your payment.';
  if (!payload.dpaConsent) {
    return 'You must agree to the Data Privacy consent before registering.';
  }
  if (!payload.termsAccepted) {
    return 'You must accept the Terms & Conditions before registering.';
  }
  return null;
}

/**
 * Next ID for an attendee type: JB-00001 for paid registrants, GST-001,
 * ADM-001, VOL-001 for free passes. Uses the highest existing number + 1,
 * never the row count, so deleting a row can't cause a duplicate ID.
 */
function generateRegistrationId(sheet, type) {
  const prefix = REG_ID_PREFIX[type || ATTENDEE_TYPE.REGISTRANT] || 'JB';
  const width = prefix === 'JB' ? 5 : 3;
  const regIdCol = HEADERS.indexOf('Registration ID');
  const data = sheet.getDataRange().getValues();
  const re = new RegExp('^' + prefix + '-(\\d+)$', 'i');
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const m = String(data[i][regIdCol] || '').match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return prefix + '-' + String(max + 1).padStart(width, '0');
}

/**
 * Google Sheets (like Excel) treats any cell starting with =, +, - or @
 * as a formula. Without this, a registrant could put something like
 * =IMPORTXML(...) or =HYPERLINK(...) in their name or reference number,
 * and it would silently execute the moment an admin opens the sheet.
 * Prefixing with a leading apostrophe forces Sheets to treat it as plain
 * text (the apostrophe itself doesn't show up in the cell).
 */
function sanitizeForSheet_(value) {
  const str = String(value == null ? '' : value);
  return /^[=+\-@]/.test(str) ? "'" + str : str;
}

/** Escapes HTML-sensitive characters so submitted text (names, etc.) can't break out of the HTML emails. */
function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// ============================================================
//  DRIVE STORAGE (payment screenshots)
// ============================================================

function saveScreenshotToDrive(base64Data, filename, regId) {
  if (!base64Data) return '';
  const folder = getOrCreateDriveFolder();
  const contentType = guessContentType(filename);
  const safeName = (regId || 'unknown') + '_' + (filename || 'payment.png');
  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), contentType, safeName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function getOrCreateDriveFolder() {
  const folders = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(CONFIG.DRIVE_FOLDER_NAME);
}

function guessContentType(filename) {
  const ext = String(filename || '').split('.').pop().toLowerCase();
  if (ext === 'png') return MimeType.PNG;
  if (ext === 'jpg' || ext === 'jpeg') return MimeType.JPEG;
  if (ext === 'gif') return MimeType.GIF;
  return MimeType.PNG; // Apps Script has no native WEBP constant
}

// ============================================================
//  PAYMENT MISMATCH / EXPIRY / ADMIN-OVERRIDE FLOW
// ============================================================

/**
 * SIMPLE trigger (not installed via installTriggers() — Apps Script
 * auto-activates any function literally named onEdit(e) just by it
 * existing in the project). Fires synchronously, in the same instant as
 * the edit, WITH a UI context — which is exactly why this is the one
 * that can show the confirmation popup. It cannot call MailApp (simple
 * triggers aren't allowed to touch authorized services), so it doesn't
 * send email itself — see queueStatusNotification_() and
 * processConfirmedStatusChanges() below for how the email actually goes
 * out a few seconds to ~1 minute later, once you've said Yes.
 *
 * Also does the general "who changed what" audit logging for every edit
 * on the Registrations sheet, not just Status.
 */
function onEdit(e) {
  try {
    const sheet = e.range.getSheet();
    if (sheet.getName() === DASHBOARD_SHEET_NAME) return;
    if (sheet.getName() === AUDIT_SHEET_NAME) return;
    if (sheet.getName() !== CONFIG.SHEET_NAME) return;
    if (e.range.getRow() === 1) return; // header row

    const statusCol = HEADERS.indexOf('Status') + 1;
    const lastUpdatedCol = HEADERS.indexOf('Last Updated') + 1;
    const isSingleCell = e.range.getNumRows() === 1 && e.range.getNumColumns() === 1;
    const isStatusEdit = isSingleCell && e.range.getColumn() === statusCol;

    if (!isStatusEdit) {
      // Any other edit (including a multi-cell paste or a bulk delete) —
      // just log it quietly and stamp Last Updated for every touched row.
      logAudit_(sheet, e.range, e.oldValue, e.value, 'Direct cell edit');
      for (let r = e.range.getRow(); r < e.range.getRow() + e.range.getNumRows(); r++) {
        if (r > 1) sheet.getRange(r, lastUpdatedCol).setValue(new Date());
      }
      return;
    }

    const row = e.range.getRow();
    const newStatus = e.value;
    const oldStatus = e.oldValue;

    if (!newStatus || newStatus === oldStatus) {
      logAudit_(sheet, e.range, oldStatus, newStatus, 'Direct cell edit');
      return;
    }

    const regId = sheet.getRange(row, HEADERS.indexOf('Registration ID') + 1).getValue();
    const name = sheet.getRange(row, HEADERS.indexOf('Full Legal Name') + 1).getValue();
    const willEmail = [STATUS.APPROVED, STATUS.NEEDS_CORRECTION, STATUS.EXPIRED, STATUS.REJECTED, STATUS.CANCELLED].indexOf(newStatus) !== -1;

    const ui = SpreadsheetApp.getUi();
    const confirmMsg =
      'Change status of ' + regId + ' (' + name + ')\n' +
      'from "' + (oldStatus || '(blank)') + '"\n' +
      'to "' + newStatus + '"?\n\n' +
      (willEmail
        ? 'This will email the registrant within about a minute, and cannot be auto-undone.'
        : 'This status does not trigger an email.');
    const response = ui.alert('Confirm Status Change', confirmMsg, ui.ButtonSet.YES_NO);

    if (response !== ui.Button.YES) {
      e.range.setValue(oldStatus || '');
      logAudit_(sheet, e.range, oldStatus, newStatus, 'Change declined — reverted, nothing sent');
      return;
    }

    sheet.getRange(row, lastUpdatedCol).setValue(new Date());
    logAudit_(
      sheet,
      e.range,
      oldStatus,
      newStatus,
      willEmail ? 'Confirmed — notification queued (~1 min)' : 'Confirmed — no email needed for this status'
    );

    if (willEmail) queueStatusNotification_(row, regId, newStatus);
  } catch (err) {
    console.error('onEdit error: ' + err.message);
  }
}

/** Adds a confirmed status change to the queue processConfirmedStatusChanges() drains every minute. */
function queueStatusNotification_(row, regId, newStatus) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('pendingStatusNotifications');
  const queue = raw ? JSON.parse(raw) : [];
  queue.push({
    row: row,
    regId: regId,
    newStatus: newStatus,
    confirmedAt: new Date().toISOString(),
    confirmedBy: safeActiveUserEmail_(),
  });
  props.setProperty('pendingStatusNotifications', JSON.stringify(queue));
}

/**
 * Time-driven trigger (every minute, see installTriggers()). This is
 * where the actual "authorized" work happens for a confirmed status
 * change: stamping the correction deadline if needed, and sending the
 * matching email — the popup in onEdit(e) above can't do either of
 * those itself (no authorization from a simple trigger), so it hands
 * off here once you've said Yes.
 */
function processConfirmedStatusChanges() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('pendingStatusNotifications');
  if (!raw) return;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return; // another run is already draining the queue

  try {
    const queue = JSON.parse(props.getProperty('pendingStatusNotifications') || '[]');
    if (!queue.length) {
      props.deleteProperty('pendingStatusNotifications');
      return;
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    const statusCol = HEADERS.indexOf('Status') + 1;
    const auditSheet = getOrCreateAuditSheet_();

    queue.forEach(function (item) {
      try {
        const currentStatus = sheet.getRange(item.row, statusCol).getValue();
        if (currentStatus !== item.newStatus) {
          // Status was changed again (or reverted) after this was queued —
          // don't email based on a status that's no longer current.
          auditSheet.appendRow([
            new Date(), item.confirmedBy, CONFIG.SHEET_NAME, 'Status (row ' + item.row + ')',
            item.regId, 'Status', '', item.newStatus,
            'Skipped queued notification — status changed again before it could send',
          ]);
          return;
        }

        let deadline = null;
        if (item.newStatus === STATUS.NEEDS_CORRECTION) {
          deadline = new Date(Date.now() + CONFIG.CORRECTION_WINDOW_HOURS * 60 * 60 * 1000);
          sheet.getRange(item.row, HEADERS.indexOf('Correction Deadline') + 1).setValue(deadline);
        }

        const rowValues = sheet.getRange(item.row, 1, 1, HEADERS.length).getValues()[0];
        const rowObj = rowValuesToObject(rowValues);
        sendStatusChangeEmail_(item.newStatus, rowObj, deadline);

        auditSheet.appendRow([
          new Date(), item.confirmedBy, CONFIG.SHEET_NAME, 'Status (row ' + item.row + ')',
          item.regId, 'Status', '', item.newStatus,
          'Notification sent (confirmed ' + item.confirmedAt + ')',
        ]);
      } catch (err) {
        console.error('processConfirmedStatusChanges item error: ' + err.message);
      }
    });

    props.deleteProperty('pendingStatusNotifications');
  } finally {
    lock.releaseLock();
  }
}

/** Routes a confirmed status change to the matching notification email. */
function sendStatusChangeEmail_(newStatus, rowObj, deadline) {
  if (!String(rowObj['Email Address'] || '').trim()) return; // free passes may have no email
  if (newStatus === STATUS.APPROVED) {
    sendApprovalEmailWithQr(rowObj);
  } else if (newStatus === STATUS.NEEDS_CORRECTION) {
    sendMismatchNoticeEmail(rowObj, deadline);
  } else if (newStatus === STATUS.EXPIRED) {
    sendExpiredReleaseEmail(rowObj);
  } else if (newStatus === STATUS.REJECTED) {
    sendRejectionEmail(rowObj);
  } else if (newStatus === STATUS.CANCELLED) {
    sendCancellationEmail(rowObj);
  }
}

/** Session.getActiveUser().getEmail() can return '' for accounts the script can't identify — never let that break a caller. */
function safeActiveUserEmail_() {
  try {
    return Session.getActiveUser().getEmail() || '(unknown — email not shared with script)';
  } catch (err) {
    return '(unknown — email not shared with script)';
  }
}

// ============================================================
//  AUDIT LOG  (who changed what, and when — see _AuditLog sheet)
// ============================================================

const AUDIT_SHEET_NAME = '_AuditLog';
const AUDIT_HEADERS = ['Timestamp', 'Editor', 'Sheet', 'Cell / Range', 'Registration ID', 'Column', 'Old Value', 'New Value', 'Note'];

/** Creates the _AuditLog sheet if missing, restricted to the spreadsheet owner so the 4 admins can't edit/delete history. */
function getOrCreateAuditSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(AUDIT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(AUDIT_SHEET_NAME);
    sheet.getRange(1, 1, 1, AUDIT_HEADERS.length).setValues([AUDIT_HEADERS])
      .setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, AUDIT_HEADERS.length);
    protectSheetOwnerOnly_(sheet, 'Audit log — read-only history, restricted to the spreadsheet owner');
  }
  return sheet;
}

/** Appends one row to the audit log. Best-effort — never lets a logging failure break the edit it's logging. */
function logAudit_(sheet, range, oldValue, newValue, note) {
  try {
    const auditSheet = getOrCreateAuditSheet_();
    const row = range.getRow();
    const col = range.getColumn();
    const isSingleCell = range.getNumRows() === 1 && range.getNumColumns() === 1;
    const regIdCol = HEADERS.indexOf('Registration ID') + 1;
    let regId = '';
    if (row > 1) {
      try { regId = sheet.getRange(row, regIdCol).getValue(); } catch (err) {}
    }
    const columnName = isSingleCell && col >= 1 && col <= HEADERS.length ? HEADERS[col - 1] : '(multiple)';
    auditSheet.appendRow([
      new Date(),
      safeActiveUserEmail_(),
      sheet.getName(),
      range.getA1Notation(),
      regId,
      columnName,
      isSingleCell ? oldValue : '(multiple cells)',
      isSingleCell ? newValue : '(multiple cells)',
      note || '',
    ]);
  } catch (err) {
    console.error('logAudit_ error: ' + err.message);
  }
}

// ============================================================
//  BACKUPS
// ============================================================

const BACKUP_FOLDER_NAME = 'Josh Birthday - Spreadsheet Backups';
const BACKUP_RETENTION_COUNT = 30; // keep the most recent 30 automatic backups

/** Time-driven trigger (daily 2am, see installTriggers()). Also callable on demand via the menu. */
function runBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const folder = getOrCreateBackupFolder_();
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Manila', 'yyyy-MM-dd HH-mm');
  DriveApp.getFileById(ss.getId()).makeCopy('Registrations Backup - ' + stamp, folder);
  pruneOldBackups_(folder);
}

function getOrCreateBackupFolder_() {
  const folders = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(BACKUP_FOLDER_NAME);
}

/** Keeps only the most recent BACKUP_RETENTION_COUNT backups so the Drive folder doesn't grow forever. */
function pruneOldBackups_(folder) {
  const files = [];
  const it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  if (files.length <= BACKUP_RETENTION_COUNT) return;
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  for (let i = BACKUP_RETENTION_COUNT; i < files.length; i++) {
    files[i].setTrashed(true);
  }
}

/** Menu item: "Run Backup Now". */
function runBackupNow() {
  runBackup();
  SpreadsheetApp.getUi().alert(
    'Backup complete. A timestamped copy was saved to the "' + BACKUP_FOLDER_NAME + '" folder in your Drive.'
  );
}

/**
 * Time-driven trigger (hourly, see installTriggers()). Sweeps for
 * rows stuck in "Payment Mismatch - Awaiting Correction" whose
 * deadline has passed, releases their seats, and notifies them. This
 * is the fallback for when nobody manually intervened — the admin
 * override above handles the "don't wait" case.
 */
function checkExpiredCorrections() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const statusCol = HEADERS.indexOf('Status');
  const deadlineCol = HEADERS.indexOf('Correction Deadline');
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    if (data[i][statusCol] !== STATUS.NEEDS_CORRECTION) continue;
    const deadline = data[i][deadlineCol];
    if (!deadline || new Date(deadline) >= now) continue;

    const rowNum = i + 1;
    sheet.getRange(rowNum, statusCol + 1).setValue(STATUS.EXPIRED);
    sheet.getRange(rowNum, HEADERS.indexOf('Last Updated') + 1).setValue(now);

    const rowObj = rowValuesToObject(data[i]);
    try {
      sendExpiredReleaseEmail(rowObj);
    } catch (err) {
      // Seat is released either way; the email is best-effort.
    }
  }
}

function rowValuesToObject(rowValues) {
  const obj = {};
  HEADERS.forEach(function (header, idx) {
    obj[header] = rowValues[idx];
  });
  return obj;
}

// ============================================================
//  EMAIL BRANDING (shared HTML template used by every email below)
// ============================================================

function buildCorrectionLink(regId) {
  if (!CONFIG.SITE_BASE_URL || CONFIG.SITE_BASE_URL.indexOf('REPLACE_WITH') === 0) return '';
  const base = CONFIG.SITE_BASE_URL.replace(/\/$/, '');
  return `${base}/correct/?regId=${encodeURIComponent(regId)}`;
}

/**
 * Fetches the site's white SB19 A'tin Fanboys logo so every email can
 * embed it inline (cid:logoImg). Returns null if it can't be fetched
 * (e.g. SITE_BASE_URL isn't configured yet) — emails still send fine,
 * just with a text wordmark instead of the logo image.
 */
function getLogoBlob_() {
  if (!CONFIG.SITE_BASE_URL || CONFIG.SITE_BASE_URL.indexOf('REPLACE_WITH') === 0) return null;
  try {
    const url = CONFIG.SITE_BASE_URL.replace(/\/$/, '') + '/assets/logo.png';
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      return response.getBlob().setName('logo.png');
    }
  } catch (err) {
    // Fall through to null — caller handles it.
  }
  return null;
}

/** One "Label: value" row inside an info box. */
function infoRow_(label, value) {
  return (
    '<tr>' +
    '<td style="padding:5px 10px 5px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;' +
    'color:#ff6fae;font-weight:bold;width:160px;vertical-align:top;white-space:nowrap;">' +
    label +
    '</td>' +
    '<td style="padding:5px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;' +
    'color:#ffe9f2;vertical-align:top;">' +
    value +
    '</td>' +
    '</tr>'
  );
}

/** Boxed table of infoRow_() rows — used for the "here's what you submitted" summaries. */
function infoBox_(rowsHtml) {
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
    'style="background-color:#22091a;border:1px solid rgba(255,111,174,0.3);border-radius:8px;margin:4px 0 22px;">' +
    '<tr><td style="padding:16px 20px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    rowsHtml +
    '</table></td></tr></table>'
  );
}

/** Crimson call-to-action button (used for the "fix my payment" link). */
function buttonHtml_(url, label) {
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 24px;"><tr>' +
    '<td style="border-radius:6px;background-color:#d1124f;">' +
    '<a href="' +
    url +
    '" style="display:inline-block;padding:13px 30px;font-family:Arial,Helvetica,sans-serif;' +
    'font-size:14px;font-weight:bold;letter-spacing:0.3px;color:#ffffff;text-decoration:none;">' +
    label +
    '</a></td></tr></table>'
  );
}

/** Muted red callout box — used for warnings/deadlines. */
function warningBox_(html) {
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
    'style="background-color:rgba(209,18,79,0.18);border:1px solid rgba(209,18,79,0.55);border-radius:8px;margin:0 0 22px;">' +
    '<tr><td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#ffe9f2;line-height:1.6;">' +
    html +
    '</td></tr></table>'
  );
}

/**
 * Wraps body content in the shared branded email shell: dark header
 * with the inline white A'tin Fanboys logo + a colored status pill,
 * the content itself, and a consistent footer with event details and
 * the organizer contact. Returns { html, inlineImages } — spread
 * inlineImages into MailApp's options so cid:logoImg (and cid:entryQr
 * when applicable) resolve.
 */
function buildEmailShell_(options) {
  const logoBlob = getLogoBlob_();
  const inlineImages = {};

  const logoImg = logoBlob
    ? '<img src="cid:logoImg" width="70" height="70" alt="SB19 A\'tin Fanboys" ' +
      'style="display:block;margin:0 auto;width:70px;height:70px;border:0;" />'
    : '<div style="font-family:Georgia,\'Times New Roman\',serif;color:#ff6fae;font-size:20px;' +
      'letter-spacing:2px;">SB19 A\'TIN FANBOYS</div>';
  if (logoBlob) inlineImages.logoImg = logoBlob;

  const pill = options.pillLabel
    ? '<span style="display:inline-block;margin-top:18px;padding:7px 20px;border-radius:999px;' +
      'font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.5px;font-weight:bold;' +
      'text-transform:uppercase;background-color:' +
      (options.pillColor || '#ff6fae') +
      ';color:' +
      (options.pillTextColor || '#0a0a0a') +
      ';">' +
      options.pillLabel +
      '</span>'
    : '';

  const html =
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' +
    escapeHtml_(CONFIG.EVENT_NAME) +
    '</title></head>' +
    '<body style="margin:0;padding:0;background-color:#0a0a0a;">' +
    '<div style="width:100%;background-color:#0a0a0a;padding:28px 12px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;' +
    'background-color:#16070f;border:1px solid rgba(255,111,174,0.35);border-radius:12px;overflow:hidden;">' +
    '<tr><td style="background-color:#0a0a0a;background-image:linear-gradient(180deg,#2a0a1c,#0a0a0a);' +
    'text-align:center;padding:34px 24px 22px;border-bottom:1px solid rgba(255,111,174,0.3);">' +
    logoImg +
    '<div style="font-family:\'Courier New\',Courier,monospace;color:#ffd6e7;font-size:26px;font-weight:bold;' +
    'letter-spacing:6px;margin-top:16px;">GAME TIME</div>' +
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#ffe9f2;opacity:0.7;font-size:11px;' +
    'letter-spacing:2.5px;text-transform:uppercase;margin-top:6px;">' + escapeHtml_(CONFIG.EVENT_SUBTITLE) + '</div>' +
    pill +
    '</td></tr>' +
    '<tr><td style="padding:30px 30px 6px;font-family:Georgia,\'Times New Roman\',serif;color:#ffe9f2;' +
    'font-size:15px;line-height:1.65;">' +
    options.bodyHtml +
    '</td></tr>' +
    '<tr><td style="padding:22px 30px 32px;text-align:center;font-family:Arial,Helvetica,sans-serif;' +
    'color:rgba(255,233,242,0.55);font-size:12px;line-height:1.8;border-top:1px solid rgba(255,111,174,0.2);">' +
    '<strong style="color:#ff6fae;">' +
    escapeHtml_(CONFIG.EVENT_DATE_DISPLAY) +
    '</strong> — ' +
    escapeHtml_(CONFIG.VENUE) +
    '<br>' + escapeHtml_(CONFIG.VENUE_ADDRESS) +
    '<br>Questions? Email <a href="mailto:' +
    CONFIG.ORGANIZER_CONTACT_EMAIL +
    '" style="color:#ff6fae;">' +
    CONFIG.ORGANIZER_CONTACT_EMAIL +
    '</a><br><br>Fan-organized by SB19 A\'tin Fanboys. Not an official SB19 or management event.' +
    '</td></tr></table></div></body></html>';

  return { html: html, inlineImages: inlineImages };
}

// ============================================================
//  EMAILS
// ============================================================

/**
 * Sent immediately on submission. Personalized, fully branded copy of
 * everything the registrant just submitted, so they have a record of
 * it even before verification happens.
 */
/** "Juan" from a row or payload, falling back to the full name. */
function greetName_(first, full) {
  return String(first || '').trim() || String(full || '').trim() || 'there';
}

/** When / where box with a map link, shared by the emails. */
function eventBox_() {
  return infoBox_(
    infoRow_('Event', '<strong>GAME TIME</strong><br>' + escapeHtml_(CONFIG.EVENT_SUBTITLE)) +
      infoRow_('When', '<strong>' + escapeHtml_(CONFIG.EVENT_DATE_DISPLAY) + '</strong>') +
      infoRow_(
        'Where',
        '<strong>' + escapeHtml_(CONFIG.VENUE) + '</strong><br>' + escapeHtml_(CONFIG.VENUE_ADDRESS) +
          '<br><a href="' + CONFIG.VENUE_MAP_URL + '" style="color:#ff6fae;">Open in Google Maps</a>'
      )
  );
}

/** Numbered list styled for the dark email body. */
function stepsHtml_(items) {
  return (
    '<ol style="margin:0 0 22px;padding-left:20px;font-size:14px;line-height:1.6;">' +
    items.map(function (t) { return '<li style="margin-bottom:6px;">' + t + '</li>'; }).join('') +
    '</ol>'
  );
}

function sendPendingConfirmationEmail(payload, regId) {
  const fee = getSetting_('Registration Fee');
  const amount = fee ? CONFIG.CURRENCY + (Number(payload.ticketQuantity) * fee).toLocaleString() : '';

  const rows =
    infoRow_('Registration ID', '<strong>' + escapeHtml_(regId) + '</strong>') +
    infoRow_('Full Name', escapeHtml_(payload.fullName)) +
    infoRow_('Email', escapeHtml_(payload.email)) +
    infoRow_('Phone', escapeHtml_(payload.phone)) +
    infoRow_('Fanboy / Fangirl', escapeHtml_(payload.fanType)) +
    infoRow_('Facebook', escapeHtml_(payload.facebook)) +
    (amount ? infoRow_('Amount Due', '<strong>' + amount + '</strong>') : '') +
    infoRow_('Payment Channel', escapeHtml_(String(payload.paymentChannel).toLowerCase() === 'gcash' ? 'GCash' : payload.paymentChannel)) +
    infoRow_('Reference No.', escapeHtml_(payload.paymentReference));

  const hi = escapeHtml_(greetName_(payload.firstName, payload.fullName));
  const bodyHtml =
    '<p>Hi ' + hi + ',</p>' +
    '<p>We got your registration for GAME TIME, SSOB\'s birthday celebration. Thank you for joining us! ' +
    'Here is a copy of what you sent, for your records:</p>' +
    infoBox_(rows) +
    '<p><strong>What happens next</strong></p>' +
    stepsHtml_([
      'Our team checks your GCash payment by hand against the reference number above.',
      'Once it matches, we email you again with your <strong>entry QR code</strong>. That second email is your ticket.',
      'On November 14, bring the QR code and a valid ID with the same name you registered with.',
    ]) +
    warningBox_(
      'If something doesn\'t match (wrong amount, reference not found, unclear screenshot), we will email you a ' +
        'link to fix it yourself. You will have <strong>' + CONFIG.CORRECTION_WINDOW_HOURS +
        ' hours</strong> to correct it before your slot goes to someone else.'
    ) +
    eventBox_() +
    '<p style="font-size:13px;color:rgba(255,233,242,0.7);">This is an automated message, so replies are not read. ' +
    'For questions, email <strong>' + CONFIG.ORGANIZER_CONTACT_EMAIL + '</strong> and include your Registration ID.</p>';

  const shell = buildEmailShell_({
    pillLabel: 'Payment Being Checked',
    pillColor: '#ff6fae',
    pillTextColor: '#0a0a0a',
    bodyHtml: bodyHtml,
  });

  MailApp.sendEmail({
    to: payload.email,
    subject: `[GAME TIME] We got your registration (${regId})`,
    htmlBody: shell.html,
    body:
      `Hi ${greetName_(payload.firstName, payload.fullName)},\n\nWe got your registration (${regId}) for GAME TIME, ` +
      `SSOB's birthday celebration. We are checking your GCash payment now. Once it matches, we will email your ` +
      `entry QR code.\n\n${CONFIG.EVENT_DATE_DISPLAY}\n${CONFIG.VENUE}, ${CONFIG.VENUE_ADDRESS}\n\n` +
      `Questions: ${CONFIG.ORGANIZER_CONTACT_EMAIL}\n\n${CONFIG.SENDER_DISPLAY_NAME}`,
    name: CONFIG.SENDER_DISPLAY_NAME,
    inlineImages: shell.inlineImages,
  });
}

/**
 * Sent the moment you set a row's Status to "Approved". Generates a
 * scannable QR code from the row's stored QR Token and embeds it
 * directly in the branded email, along with the Terms & Conditions.
 */
function sendApprovalEmailWithQr(rowObj) {
  const regId = rowObj['Registration ID'];
  const qrToken = rowObj['QR Token'];
  const qrImageUrl =
    'https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=' + encodeURIComponent(qrToken);

  let qrBlob = null;
  try {
    const response = UrlFetchApp.fetch(qrImageUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      qrBlob = response.getBlob().setName('entry-qr.png');
    }
  } catch (err) {
    qrBlob = null; // Email still sends below, just without the QR image.
  }

  const type = String(rowObj['Attendee Type'] || ATTENDEE_TYPE.REGISTRANT);
  const isFree = FREE_TYPES.indexOf(type) !== -1;
  const fee = getSetting_('Registration Fee');
  const amount = !isFree && fee ? CONFIG.CURRENCY + (Number(rowObj['Ticket Quantity']) * fee).toLocaleString() : '';

  const rows =
    infoRow_('Registration ID', '<strong>' + escapeHtml_(regId) + '</strong>') +
    infoRow_('Name', '<strong>' + escapeHtml_(rowObj['Full Legal Name']) + '</strong>') +
    (amount ? infoRow_('Amount Paid', '<strong>' + amount + '</strong>') : '') +
    (isFree ? infoRow_('Pass', '<strong>' + escapeHtml_(type) + ' pass (complimentary)</strong>') : '');

  const qrSection = qrBlob
    ? '<div style="text-align:center;background-color:#ffffff;border-radius:10px;padding:20px;margin:0 0 22px;">' +
      '<img src="cid:entryQr" width="240" height="240" alt="Entry QR code" style="display:block;margin:0 auto;" />' +
      '</div>'
    : warningBox_(
        'We could not attach your QR code this time. Please email <strong>' +
          CONFIG.ORGANIZER_CONTACT_EMAIL +
          '</strong> and we will send it. Your Registration ID above already confirms your slot.'
      );

  const hi = escapeHtml_(greetName_(rowObj['First Name'], rowObj['Full Legal Name']));
  const bodyHtml =
    '<p>Hi ' + hi + ',</p>' +
    (isFree
      ? '<p>You are on the GAME TIME list with a <strong>' + escapeHtml_(type) + ' pass</strong>. No payment needed. ' +
        'Thank you for helping us celebrate SSOB! 🎉</p>'
      : '<p>Your payment is verified and your slot is confirmed. <strong>You\'re in!</strong> 🎉 ' +
        'See you on Saturday, November 14 to celebrate SSOB\'s birthday.</p>') +
    infoBox_(rows) +
    '<p><strong>Your entry QR code</strong></p>' +
    qrSection +
    '<p><strong>Before you go</strong></p>' +
    stepsHtml_([
      'Show this QR code at the door. A screenshot on your phone works.',
      'Bring a valid ID with the same name as above. We check every QR and ID at the entrance.',
      'Doors open at 5:00 PM. Coming early keeps the line short.',
      isFree
        ? 'Your pass includes your food at ' + escapeHtml_(CONFIG.VENUE) + '.'
        : 'Your ' + escapeHtml_(amount || 'registration') + ' covers your food at ' + escapeHtml_(CONFIG.VENUE) + '.',
      isFree
        ? 'This pass is for you only. If you can\'t make it, please tell the team so someone else can use the slot.'
        : 'Can\'t make it? Your slot is transferable. Email us before the event with the full name of the person taking your place.',
    ]) +
    eventBox_() +
    '<p><strong>Terms &amp; Conditions</strong></p>' +
    '<div style="font-size:13px;line-height:1.6;">' +
    CONFIG.TERMS_SUMMARY_HTML +
    '</div>' +
    '<p>See you there, A\'TIN!</p>';

  const shell = buildEmailShell_({
    pillLabel: isFree ? type + ' Pass ✓' : 'Approved ✓',
    pillColor: '#2e7d46',
    pillTextColor: '#ffffff',
    bodyHtml: bodyHtml,
  });

  const inlineImages = Object.assign({}, shell.inlineImages);
  if (qrBlob) inlineImages.entryQr = qrBlob;

  MailApp.sendEmail({
    to: rowObj['Email Address'],
    subject: isFree
      ? `[GAME TIME] Your ${type} pass and entry QR (${regId})`
      : `[GAME TIME] You're in! Your entry QR code (${regId})`,
    htmlBody: shell.html,
    body:
      `Hi ${greetName_(rowObj['First Name'], rowObj['Full Legal Name'])},\n\nYour ${isFree ? type + ' pass' : 'registration'} ` +
      `(${regId}) is confirmed. Open this email in a mail app that shows images to see your entry QR code.\n\n` +
      `${CONFIG.EVENT_DATE_DISPLAY}\n${CONFIG.VENUE}, ${CONFIG.VENUE_ADDRESS}\n` +
      `Bring the QR code and a valid ID with the same name.\n\n${CONFIG.SENDER_DISPLAY_NAME}`,
    name: CONFIG.SENDER_DISPLAY_NAME,
    inlineImages: inlineImages,
  });
}

/** Sent when a row's Status is set to "Payment Mismatch - Awaiting Correction". */
function sendMismatchNoticeEmail(rowObj, deadline) {
  const regId = rowObj['Registration ID'];
  const link = buildCorrectionLink(regId);

  const rows =
    infoRow_('Registration ID', '<strong>' + escapeHtml_(regId) + '</strong>') +
    infoRow_('Name', escapeHtml_(rowObj['Full Legal Name'])) +
    infoRow_('Reference on File', escapeHtml_(rowObj['Payment Reference No.']));

  const fixSection = link
    ? buttonHtml_(link, 'Fix My Payment Info') +
      '<p style="font-size:13px;color:rgba(255,233,242,0.7);">Or copy this link into your browser: <br>' +
      '<a href="' +
      link +
      '" style="color:#ff6fae;word-break:break-all;">' +
      link +
      '</a></p>' +
      '<p>Enter your Registration ID and the email you registered with, then submit the correct reference ' +
      'number and/or a new payment screenshot. No need to register again — this updates your existing registration.</p>'
    : '<p>Please contact us at <strong>' +
      CONFIG.ORGANIZER_CONTACT_EMAIL +
      '</strong> with the corrected reference number and/or a new payment screenshot.</p>';

  const bodyHtml =
    '<p>Hi <strong>' + escapeHtml_(rowObj['Full Legal Name']) + '</strong>,</p>' +
    '<p>We found an issue verifying the payment for your registration — most commonly this means the ' +
    'amount paid isn\'t the ₱549 registration fee, or we couldn\'t match your reference number.</p>' +
    infoBox_(rows) +
    warningBox_(
      'You have until <strong>' +
        escapeHtml_(deadline.toString()) +
        '</strong> (about ' +
        CONFIG.CORRECTION_WINDOW_HOURS +
        ' hours from now) to fix this, or your reserved seat(s) will be automatically released back into ' +
        'the pool for other registrants.'
    ) +
    fixSection;

  const shell = buildEmailShell_({
    pillLabel: 'Action Needed',
    pillColor: '#d1124f',
    pillTextColor: '#ffffff',
    bodyHtml: bodyHtml,
  });

  MailApp.sendEmail({
    to: rowObj['Email Address'],
    subject: `[${CONFIG.EVENT_NAME}] Action Needed — Payment Issue on ${regId}`,
    htmlBody: shell.html,
    body:
      `Hi ${rowObj['Full Legal Name']}, there's a payment issue on your registration (${regId}). You have ` +
      `until ${deadline.toString()} to fix it${link ? ' here: ' + link : ', contact ' + CONFIG.ORGANIZER_CONTACT_EMAIL} ` +
      `or your seat(s) will be released.\n\n— ${CONFIG.SENDER_DISPLAY_NAME}`,
    name: CONFIG.SENDER_DISPLAY_NAME,
    inlineImages: shell.inlineImages,
  });
}

/** Sent after a registrant successfully uses the self-service correction page. */
function sendCorrectionReceivedEmail(rowObj) {
  const regId = rowObj['Registration ID'];
  const rows =
    infoRow_('Registration ID', '<strong>' + escapeHtml_(regId) + '</strong>') +
    infoRow_('Name', escapeHtml_(rowObj['Full Legal Name'])) +
    infoRow_('Reference No.', escapeHtml_(rowObj['Payment Reference No.']));

  const bodyHtml =
    '<p>Hi <strong>' + escapeHtml_(rowObj['Full Legal Name']) + '</strong>,</p>' +
    '<p>We\'ve received your corrected payment information. Your registration is back in the verification ' +
    'queue as <strong>Pending Payment Verification</strong> — we\'ll follow up once it\'s checked.</p>' +
    infoBox_(rows);

  const shell = buildEmailShell_({
    pillLabel: 'Back in Queue',
    pillColor: '#ff6fae',
    pillTextColor: '#0a0a0a',
    bodyHtml: bodyHtml,
  });

  MailApp.sendEmail({
    to: rowObj['Email Address'],
    subject: `[${CONFIG.EVENT_NAME}] Corrected Payment Info Received — ${regId}`,
    htmlBody: shell.html,
    body:
      `Hi ${rowObj['Full Legal Name']}, we've received your corrected payment info for ${regId}. Your ` +
      `registration is back in the verification queue.\n\n— ${CONFIG.SENDER_DISPLAY_NAME}`,
    name: CONFIG.SENDER_DISPLAY_NAME,
    inlineImages: shell.inlineImages,
  });
}

/** Sent when a row's seat(s) are released — either the 24-hour sweep, or you setting Status to "Expired" directly. */
function sendExpiredReleaseEmail(rowObj) {
  const regId = rowObj['Registration ID'];
  const bodyHtml =
    '<p>Hi <strong>' + escapeHtml_(rowObj['Full Legal Name']) + '</strong>,</p>' +
    '<p>Your reserved seat(s) under <strong>' +
    escapeHtml_(regId) +
    '</strong> have been released back to other registrants because the payment issue on this registration ' +
    'wasn\'t resolved in time.</p>' +
    '<p>If you\'d still like to attend and slots are available, you\'re welcome to register again with the ' +
    'correct payment details. If you believe this was a mistake, contact us right away at <strong>' +
    CONFIG.ORGANIZER_CONTACT_EMAIL +
    '</strong>.</p>';

  const shell = buildEmailShell_({
    pillLabel: 'Reservation Released',
    pillColor: '#5a5a5a',
    pillTextColor: '#ffffff',
    bodyHtml: bodyHtml,
  });

  MailApp.sendEmail({
    to: rowObj['Email Address'],
    subject: `[${CONFIG.EVENT_NAME}] Reservation Released — ${regId}`,
    htmlBody: shell.html,
    body:
      `Hi ${rowObj['Full Legal Name']}, your reserved seat(s) under ${regId} have been released. Contact ` +
      `${CONFIG.ORGANIZER_CONTACT_EMAIL} if this was a mistake.\n\n— ${CONFIG.SENDER_DISPLAY_NAME}`,
    name: CONFIG.SENDER_DISPLAY_NAME,
    inlineImages: shell.inlineImages,
  });
}

/** Sent when you set a row's Status directly to "Rejected". */
function sendRejectionEmail(rowObj) {
  const regId = rowObj['Registration ID'];
  const bodyHtml =
    '<p>Hi <strong>' + escapeHtml_(rowObj['Full Legal Name']) + '</strong>,</p>' +
    '<p>We were unable to approve your registration <strong>' +
    escapeHtml_(regId) +
    '</strong> and your reserved seat(s) have been released.</p>' +
    '<p>If you believe this was a mistake or would like to register again, contact us at <strong>' +
    CONFIG.ORGANIZER_CONTACT_EMAIL +
    '</strong>.</p>';

  const shell = buildEmailShell_({
    pillLabel: 'Not Approved',
    pillColor: '#d1124f',
    pillTextColor: '#ffffff',
    bodyHtml: bodyHtml,
  });

  MailApp.sendEmail({
    to: rowObj['Email Address'],
    subject: `[${CONFIG.EVENT_NAME}] Registration Not Approved — ${regId}`,
    htmlBody: shell.html,
    body:
      `Hi ${rowObj['Full Legal Name']}, your registration ${regId} was not approved and your seat(s) were ` +
      `released. Contact ${CONFIG.ORGANIZER_CONTACT_EMAIL} with questions.\n\n— ${CONFIG.SENDER_DISPLAY_NAME}`,
    name: CONFIG.SENDER_DISPLAY_NAME,
    inlineImages: shell.inlineImages,
  });
}

/** Sent when you set a row's Status directly to "Cancelled". */
function sendCancellationEmail(rowObj) {
  const regId = rowObj['Registration ID'];
  const bodyHtml =
    '<p>Hi <strong>' + escapeHtml_(rowObj['Full Legal Name']) + '</strong>,</p>' +
    '<p>Your registration <strong>' +
    escapeHtml_(regId) +
    '</strong> has been cancelled and your reserved seat(s) released back to the pool.</p>' +
    '<p>If this wasn\'t expected, contact us right away at <strong>' +
    CONFIG.ORGANIZER_CONTACT_EMAIL +
    '</strong>.</p>';

  const shell = buildEmailShell_({
    pillLabel: 'Cancelled',
    pillColor: '#5a5a5a',
    pillTextColor: '#ffffff',
    bodyHtml: bodyHtml,
  });

  MailApp.sendEmail({
    to: rowObj['Email Address'],
    subject: `[${CONFIG.EVENT_NAME}] Registration Cancelled — ${regId}`,
    htmlBody: shell.html,
    body:
      `Hi ${rowObj['Full Legal Name']}, your registration ${regId} was cancelled and your seat(s) released. ` +
      `Contact ${CONFIG.ORGANIZER_CONTACT_EMAIL} if unexpected.\n\n— ${CONFIG.SENDER_DISPLAY_NAME}`,
    name: CONFIG.SENDER_DISPLAY_NAME,
    inlineImages: shell.inlineImages,
  });
}

// ============================================================
//  DASHBOARD SHEET  (menu: Josh Birthday Admin > Build / Refresh Dashboard)
//  The phone-friendly team dashboard is the /dashboard/ web page
//  (Dashboard.gs). This sheet tab shows the same numbers inside the
//  spreadsheet, driven by formulas so it updates on its own.
// ============================================================

const DASHBOARD_SHEET_NAME = 'Dashboard';

function buildDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const old = ss.getSheetByName(DASHBOARD_SHEET_NAME);
  if (old) ss.deleteSheet(old);
  const sheet = ss.insertSheet(DASHBOARD_SHEET_NAME, 0);
  sheet.setHiddenGridlines(true);

  const DARK = '#0e0409';
  const PINK = '#ff6fae';
  const BLUSH = '#ffe9f2';
  const RED = '#d1124f';
  const GREEN = '#2e7d46';
  const GRAY = '#3d2a33';
  const PANEL = '#22091a';

  // Column references, built from HEADERS so the formulas follow the columns.
  const R = "'" + CONFIG.SHEET_NAME + "'!";
  const col = function (h) { return R + colLetter_(h) + '2:' + colLetter_(h); };
  const TYPE = col('Attendee Type');
  const QTY = col('Ticket Quantity');
  const ST = col('Status');
  const FEE = settingCell_('Registration Fee');
  const COST = settingCell_('Venue Cost per Head');
  const CAP = settingCell_('Venue Capacity');
  const sumIf = function (type, status) {
    return 'SUMIFS(' + QTY + ',' + TYPE + ',"' + type + '",' + ST + ',"' + status + '")';
  };
  const PAID_OK = sumIf('Registrant', STATUS.APPROVED);
  const PAID_PEND = '(' + sumIf('Registrant', STATUS.PENDING) + '+' + sumIf('Registrant', STATUS.NEEDS_CORRECTION) + ')';
  const FREE = '(' + sumIf('Guest', STATUS.APPROVED) + '+' + sumIf('Admin', STATUS.APPROVED) + '+' + sumIf('Volunteer', STATUS.APPROVED) + ')';
  const HEAD = '(' + PAID_OK + '+' + FREE + ')';
  const MARGIN = '(' + FEE + '-' + COST + ')';

  if (!ss.getSheetByName(SPONSORS.SHEET_NAME)) setupSponsorsSheet();
  const SP = "'" + SPONSORS.SHEET_NAME + "'!";
  const spCol = function (h) {
    const n = SPONSORS.HEADERS.indexOf(h) + 1;
    const L = n <= 26 ? String.fromCharCode(64 + n) : 'A' + String.fromCharCode(64 + n - 26);
    return SP + L + '2:' + L;
  };
  const SP_CASH = 'SUMIFS(' + spCol('Cash Received') + ',' + spCol('Status') + ',"<>Declined")';
  const SP_PLEDGED = 'MAX(0,SUMIFS(' + spCol('Cash Pledged') + ',' + spCol('Status') + ',"<>Declined")-' + SP_CASH + ')';

  sheet.getRange(1, 1, 80, 12).setBackground(DARK).setFontColor(BLUSH);
  for (let c = 1; c <= 10; c++) sheet.setColumnWidth(c, 110);
  sheet.setColumnWidth(11, 30);
  sheet.setColumnWidth(12, 200);

  sheet.getRange(1, 1, 1, 10).merge().setValue('GAME TIME  |  LIVE DASHBOARD')
    .setFontColor(PINK).setFontSize(20).setFontWeight('bold').setFontFamily('VT323')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 46);
  sheet.getRange(2, 1, 1, 10).merge()
    .setValue(CONFIG.EVENT_SUBTITLE + '  |  ' + CONFIG.EVENT_DATE_DISPLAY + '  |  ' + CONFIG.VENUE + '  |  updates automatically')
    .setFontSize(10).setFontStyle('italic').setHorizontalAlignment('center');

  const section = function (row, title, bg) {
    sheet.getRange(row, 1, 1, 10).merge().setValue(title)
      .setBackground(bg || PANEL).setFontColor(bg ? BLUSH : PINK).setFontWeight('bold').setFontSize(11);
    sheet.setRowHeight(row, 24);
  };
  const cards = function (row, list) {
    list.forEach(function (card, i) {
      const c = 1 + i * 2;
      sheet.getRange(row, c, 1, 2).merge().setValue(card[0])
        .setBackground(card[2]).setFontColor(card[3]).setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
      sheet.getRange(row + 1, c, 1, 2).merge().setFormula(card[1])
        .setBackground(card[2]).setFontColor(card[3]).setFontSize(24).setFontWeight('bold').setHorizontalAlignment('center');
      if (card[4]) sheet.getRange(row + 1, c, 1, 2).setNumberFormat(card[4]);
    });
    sheet.setRowHeight(row, 22);
    sheet.setRowHeight(row + 1, 48);
  };

  // --- Headcount ---
  section(4, 'HEADCOUNT');
  cards(5, [
    ['PAID (VERIFIED)', '=' + PAID_OK, GREEN, BLUSH],
    ['PAID (PENDING)', '=' + PAID_PEND, PINK, DARK],
    ['FREE PASSES', '=' + FREE, GRAY, BLUSH],
    ['TOTAL HEADCOUNT', '=' + HEAD, DARK, PINK],
    ['SEATS LEFT', '=MAX(0,' + CAP + '-' + HEAD + '-' + PAID_PEND + ')', DARK, PINK],
  ]);
  cards(8, [
    ['GUESTS', '=' + sumIf('Guest', STATUS.APPROVED), PANEL, BLUSH],
    ['ADMIN', '=' + sumIf('Admin', STATUS.APPROVED), PANEL, BLUSH],
    ['VOLUNTEERS', '=' + sumIf('Volunteer', STATUS.APPROVED), PANEL, BLUSH],
    ['NEEDS CORRECTION', '=COUNTIFS(' + TYPE + ',"Registrant",' + ST + ',"' + STATUS.NEEDS_CORRECTION + '")', RED, BLUSH],
    ['CHECKED IN', '=SUMIF(' + col('Checked In') + ',"Yes",' + QTY + ')', PANEL, BLUSH],
  ]);

  // --- Budget ---
  section(11, 'BUDGET  (verified payments only; pending money is shown separately)');
  const peso = '"₱"#,##0;-"₱"#,##0';
  const lines = [
    ['Registration fee per paid head', '=' + FEE, peso],
    ['Venue cost per head (paid or free, food included)', '=' + COST, peso],
    ['Margin left by each paid head', '=' + MARGIN, peso],
    ['Collected (verified paid heads x fee)', '=' + PAID_OK + '*' + FEE, peso],
    ['Venue bill (everyone inside x cost per head)', '=' + HEAD + '*' + COST, peso],
    ['Sponsor cash received (Sponsors tab)', '=' + SP_CASH, peso],
    ['SURPLUS / SHORTFALL right now', '=' + PAID_OK + '*' + FEE + '-' + HEAD + '*' + COST + '+' + SP_CASH, peso],
    ['Sponsor cash pledged, not yet received', '=' + SP_PLEDGED, peso],
    ['Cost of free passes (free heads x cost per head)', '=' + FREE + '*' + COST, peso],
    ['Paid heads needed to cover free passes (after sponsor cash)', '=IF(' + MARGIN + '<=0,"n/a",CEILING(MAX(0,' + FREE + '*' + COST + '-' + SP_CASH + ')/' + MARGIN + ',1))', '0'],
    ['More paid heads still needed (verified)', '=IF(' + MARGIN + '<=0,"n/a",MAX(0,CEILING(MAX(0,' + FREE + '*' + COST + '-' + SP_CASH + ')/' + MARGIN + ',1)-' + PAID_OK + '))', '0'],
    ['More paid heads still needed (if all pending get verified)', '=IF(' + MARGIN + '<=0,"n/a",MAX(0,CEILING(MAX(0,' + FREE + '*' + COST + '-' + SP_CASH + ')/' + MARGIN + ',1)-' + PAID_OK + '-' + PAID_PEND + '))', '0'],
    ['Extra free passes the current surplus can already pay for', '=MAX(0,FLOOR((' + PAID_OK + '*' + FEE + '-' + HEAD + '*' + COST + '+' + SP_CASH + ')/' + COST + ',1))', '0'],
    ['Most free passes a SOLD-OUT venue can cover', '=IF(' + MARGIN + '<=0,0,FLOOR((' + CAP + '*' + MARGIN + '+' + SP_CASH + ')/' + FEE + ',1))', '0'],
  ];
  lines.forEach(function (l, i) {
    const r = 12 + i;
    sheet.getRange(r, 1, 1, 6).merge().setValue(l[0]).setFontSize(10);
    sheet.getRange(r, 7, 1, 3).merge().setFormula(l[1]).setNumberFormat(l[2])
      .setFontColor(PINK).setFontSize(12).setFontWeight('bold').setHorizontalAlignment('right');
  });
  const surplusCell = sheet.getRange(18, 7, 1, 3);
  surplusCell.setFontSize(16);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0)
      .setBackground(RED).setFontColor('#ffffff').setRanges([surplusCell]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(0)
      .setBackground(GREEN).setFontColor('#ffffff').setRanges([surplusCell]).build(),
  ]);

  // --- Free pass list ---
  const listRow = 12 + lines.length + 1;
  section(listRow, 'FREE PASSES  (add or remove these on the /dashboard/ page)');
  const RNG = R + 'A2:' + colLetter_(HEADERS[HEADERS.length - 1]);
  const q = function (h) { return 'Col' + (HEADERS.indexOf(h) + 1); };
  sheet.getRange(listRow + 1, 1).setFormula(
    '=IFERROR(QUERY({' + RNG + '},"select ' + q('Registration ID') + ',' + q('Attendee Type') + ',' + q('Full Legal Name') + ',' +
      q('Checked In') + ' where ' + q('Status') + '=\'' + STATUS.APPROVED + '\' and ' + q('Attendee Type') +
      ' <> \'Registrant\' order by ' + q('Attendee Type') + ',' + q('Full Legal Name') +
      ' label ' + q('Registration ID') + ' \'Pass ID\',' + q('Attendee Type') + ' \'Type\',' + q('Full Legal Name') + ' \'Name\',' +
      q('Checked In') + ' \'Checked In\'",0),"No free passes yet.")'
  ).setFontSize(10);

  sheet.setFrozenRows(2);
  protectSheetOwnerOnly_(sheet, 'Dashboard - restricted to owner only');

  SpreadsheetApp.getUi().alert('Dashboard built. It updates on its own as registrations and free passes change.');
}

/** Fully protects a sheet, leaving only the spreadsheet owner able to edit it. */
function protectSheetOwnerOnly_(sheet, description) {
  const existing = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  existing.forEach(function (p) { if (p.canEdit()) p.remove(); });
  const protection = sheet.protect().setDescription(description);
  protection.removeEditors(protection.getEditors());
  if (protection.canDomainEdit()) protection.setDomainEdit(false);
}

/**
 * Opens a print-ready dialog listing everyone currently Approved: paid
 * registrants and free passes, with their type and a blank check-off box.
 * Backup for the scanner if the signal drops at the venue.
 */
function showAttendeeListDialog() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const c = function (h) { return HEADERS.indexOf(h); };

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][c('Status')] === STATUS.APPROVED) {
      rows.push({
        regId: data[i][c('Registration ID')],
        type: data[i][c('Attendee Type')] || ATTENDEE_TYPE.REGISTRANT,
        last: String(data[i][c('Last Name')] || ''),
        first: String(data[i][c('First Name')] || ''),
        name: data[i][c('Full Legal Name')],
        qty: data[i][c('Ticket Quantity')],
      });
    }
  }
  rows.sort(function (a, b) {
    return (a.last + ' ' + a.first).localeCompare(b.last + ' ' + b.first) || String(a.name).localeCompare(String(b.name));
  });

  let tableRows = '';
  let totalHeads = 0;
  rows.forEach(function (r, idx) {
    totalHeads += Number(r.qty) || 0;
    tableRows +=
      '<tr>' +
      '<td>' + (idx + 1) + '</td>' +
      '<td>' + escapeHtml_(r.regId) + '</td>' +
      '<td>' + escapeHtml_(r.last) + '</td>' +
      '<td>' + escapeHtml_(r.first) + '</td>' +
      '<td>' + escapeHtml_(r.type) + '</td>' +
      '<td style="text-align:center;">' + r.qty + '</td>' +
      '<td style="text-align:center;">&#9633;</td>' +
      '</tr>';
  });

  const html =
    '<html><head><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;padding:16px;color:#111;}' +
    'h1{font-size:16px;margin:0 0 4px;} .meta{font-size:11px;color:#555;margin-bottom:14px;}' +
    'table{width:100%;border-collapse:collapse;font-size:12px;}' +
    'th,td{border:1px solid #999;padding:5px 8px;text-align:left;}' +
    'th{background:#111;color:#fff;}' +
    '.btnRow{margin-bottom:14px;}' +
    'button{padding:8px 18px;font-size:13px;font-weight:bold;cursor:pointer;}' +
    '@media print { .btnRow { display:none; } }' +
    '</style></head><body>' +
    '<div class="btnRow"><button onclick="window.print()">Print This List</button></div>' +
    '<h1>' + escapeHtml_(CONFIG.EVENT_NAME) + ' - Attendee List</h1>' +
    '<div class="meta">' + escapeHtml_(CONFIG.EVENT_DATE_DISPLAY) + ' - ' + escapeHtml_(CONFIG.VENUE) +
    ' | Generated ' + new Date().toLocaleString() +
    ' | ' + rows.length + ' entries, ' + totalHeads + ' heads</div>' +
    '<table><tr><th>#</th><th>ID</th><th>Last Name</th><th>First Name</th><th>Type</th><th>Heads</th><th>In</th></tr>' +
    tableRows +
    '</table></body></html>';

  const output = HtmlService.createHtmlOutput(html).setWidth(760).setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(output, 'Attendee List');
}
