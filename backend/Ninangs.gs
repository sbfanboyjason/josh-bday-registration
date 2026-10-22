/**
 * ============================================================
 *  NINANGS — individual fans who give cash, items or both
 * ============================================================
 *  Add this as a FIFTH script file in the same Apps Script project
 *  (File > + > Script, name it "Ninangs").
 *
 *  - Public page: /ninang/ on the site. Anyone can pledge, any amount.
 *  - Its own sheet tab, "Ninangs", separate from the brand Sponsors list.
 *  - Cash pledges include a GCash reference and screenshot. The team checks
 *    them and sets Status to Received (on the dashboard or in the sheet).
 *  - Received cash counts in the budget on its own line.
 *  - The Ninang wall on the page lists Received Ninangs only. People who
 *    chose Anonymous appear as "Anonymous Ninang"; their details are still
 *    kept in the sheet for the team.
 *  - Emails: "we got your pledge" right away, then a thank-you when Status
 *    becomes Received, or a short note when Status becomes Payment Issue.
 *    These go out from the every-minute trigger, so changing the Status
 *    straight in the sheet works too.
 * ============================================================
 */

const NINANGS = {
  SHEET_NAME: 'Ninangs',
  HEADERS: [
    'Timestamp',
    'Ninang ID',
    'First Name',
    'Last Name',
    'Full Name',
    'Show As',
    'Wall Name',
    'Email',
    'Mobile',
    'Facebook Link',
    'Giving',
    'Cash Amount',
    'GCash Reference',
    'Payment Screenshot',
    'Items',
    'Item Quantity',
    'Item Handover',
    'Pickup Address / Notes',
    'Birthday Message for SSOB',
    'Status',
    'Cash Received',
    'Items Received',
    'Status Email',
    'DPA Consent',
    'Admin Notes',
    'Last Updated',
    'Updated By',
  ],
  STATUS: {
    PENDING: 'Pending Verification',
    RECEIVED: 'Received',
    ISSUE: 'Payment Issue',
    CANCELLED: 'Cancelled',
  },
  GIVING: ['Cash', 'Items', 'Cash and items'],
  SHOW_AS: ['Name', 'Anonymous'],
  HANDOVER: ['I will deliver', 'Please pick up'],
  ANON_LABEL: 'Anonymous Ninang',
  MAX_TEXT: 500,
  MAX_CASH: 1000000,
  QUOTA_RESERVE: 10, // leave this many emails for QR passes
  EMAILS_PER_RUN: 15,
};

function ninangSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NINANGS.SHEET_NAME);
}

function ninangCol_(header) {
  return NINANGS.HEADERS.indexOf(header);
}

function ninangRows_() {
  const sheet = ninangSheet_();
  if (!sheet) return { sheet: null, data: [NINANGS.HEADERS] };
  return { sheet: sheet, data: sheet.getDataRange().getValues() };
}

/** Menu: creates or repairs the Ninangs tab. Keeps any rows already there. */
function setupNinangsSheet(silent) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ninangSheet_();
  if (!sheet) sheet = ss.insertSheet(NINANGS.SHEET_NAME);
  const H = NINANGS.HEADERS;
  sheet.getRange(1, 1, 1, H.length).setValues([H])
    .setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  const list = function (header, values) {
    sheet.getRange(2, H.indexOf(header) + 1, 1000, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build()
    );
  };
  list('Status', Object.values(NINANGS.STATUS));
  list('Show As', NINANGS.SHOW_AS);
  list('Giving', NINANGS.GIVING);
  list('Items Received', ['Yes', 'No', 'Partly']);
  ['Cash Amount', 'Cash Received'].forEach(function (h) {
    sheet.getRange(2, H.indexOf(h) + 1, 1000, 1).setNumberFormat('"₱"#,##0.##');
  });
  try { sheet.setTabColor('#ff4f9a'); } catch (e) { /* older sheets */ }
  if (silent !== true) {
    try {
      SpreadsheetApp.getUi().alert(
        'The Ninangs tab is ready.\n\nIndividual Ninangs who pledge on the /ninang/ page land here. ' +
        'Check each GCash payment, then set Status to Received (here or on the team dashboard). ' +
        'That sends the thank-you email and puts them on the Ninang wall.'
      );
    } catch (e) { /* no UI when run from the editor */ }
  }
  return sheet;
}

function ninangNextId_(data) {
  let max = 0;
  const c = ninangCol_('Ninang ID');
  for (let i = 1; i < data.length; i++) {
    const m = String(data[i][c] || '').match(/^NIN-(\d+)$/i);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return 'NIN-' + String(max + 1).padStart(3, '0');
}

/** "₱1,500" / "1500.50" -> number, or NaN. */
function ninangMoney_(v) {
  const s = String(v == null ? '' : v).replace(/[₱,\s]/g, '').replace(/^php/i, '');
  if (s === '') return NaN;
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
}

function ninangClean_(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || NINANGS.MAX_TEXT);
}

function ninangPeso_(n) {
  const v = Number(n) || 0;
  return CONFIG.CURRENCY + v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

// ============================================================
//  PUBLIC: pledge form and wall
// ============================================================

/** Returns an error message, or null. Cleans the payload in place. */
function validateNinang_(p) {
  if (!p) return 'Missing submission data.';
  if (p[HONEYPOT_FIELD]) return 'Submission blocked.';
  p.firstName = ninangClean_(p.firstName, 60);
  p.lastName = ninangClean_(p.lastName, 60);
  if (!p.firstName) return 'First name is required.';
  if (!p.lastName) return 'Last name is required.';
  p.email = ninangClean_(p.email, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return 'A valid email address is required.';
  p.phone = String(p.phone || '').replace(/\s|-/g, '');
  if (!/^(\+?63|0)9\d{9}$/.test(p.phone)) return 'A valid Philippine mobile number is required (e.g. 09171234567).';
  p.facebook = normalizeFacebook_(p.facebook);
  if (!p.facebook) return 'Please enter your Facebook profile link, e.g. facebook.com/jeizone';
  if (NINANGS.SHOW_AS.indexOf(p.showAs) === -1) return 'Please choose how you want to be thanked: with your name, or as Anonymous.';
  p.wallName = ninangClean_(p.wallName, 60) || joinName_(p.firstName, p.lastName);
  if (NINANGS.GIVING.indexOf(p.giving) === -1) return 'Please choose what you would like to give: cash, items, or both.';

  const cash = p.giving !== 'Items';
  const items = p.giving !== 'Cash';
  if (cash) {
    p.cashAmount = ninangMoney_(p.cashAmount);
    if (!(p.cashAmount > 0)) return 'Please enter the amount you sent, for example 500.';
    if (p.cashAmount > NINANGS.MAX_CASH) return 'Please check the amount.';
    p.paymentReference = ninangClean_(p.paymentReference, 60);
    if (!p.paymentReference) return 'Please enter your GCash reference number.';
    if (!p.paymentScreenshotBase64) return 'Please upload a screenshot of your GCash payment.';
  } else {
    p.cashAmount = '';
    p.paymentReference = '';
    p.paymentScreenshotBase64 = '';
  }
  if (items) {
    p.items = ninangClean_(p.items);
    if (!p.items) return 'Please tell us what items you would like to give.';
    p.itemQuantity = ninangClean_(p.itemQuantity, 60);
    if (NINANGS.HANDOVER.indexOf(p.handover) === -1) return 'Please choose whether you will deliver the items or want us to pick them up.';
    p.pickupNotes = ninangClean_(p.pickupNotes);
    if (p.handover === 'Please pick up' && !p.pickupNotes) return 'Please give the pickup address or area, and a good time to pick up.';
  } else {
    p.items = '';
    p.itemQuantity = '';
    p.handover = '';
    p.pickupNotes = '';
  }
  p.message = ninangClean_(p.message);
  if (!p.dpaConsent) return 'Please agree to the Data Privacy consent first.';
  return null;
}

/** POST ?action=ninang */
function handleNinangPledge_(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    let p;
    try {
      p = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse({ ok: false, error: 'Malformed request.' });
    }
    const error = validateNinang_(p);
    if (error) return jsonResponse({ ok: false, error: error });
    if (!getSwitch_('Ninang Pledges Open')) {
      return jsonResponse({ ok: false, error: 'Ninang pledges are closed. Thank you for your kindness! For questions, email ' + CONFIG.ORGANIZER_CONTACT_EMAIL + '.' });
    }

    let sheet = ninangSheet_();
    if (!sheet) sheet = setupNinangsSheet(true);
    const data = sheet.getDataRange().getValues();

    // A retry after a slow connection: same email, same reference, still active.
    const notes = [];
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      const st = String(r[ninangCol_('Status')]);
      if (st === NINANGS.STATUS.CANCELLED) continue;
      const sameEmail = String(r[ninangCol_('Email')]).toLowerCase() === p.email.toLowerCase();
      const ref = String(r[ninangCol_('GCash Reference')] || '').replace(/\s/g, '');
      const myRef = String(p.paymentReference || '').replace(/\s/g, '');
      if (myRef && myRef.length >= 6 && ref === myRef) {
        if (sameEmail) {
          return jsonResponse({ ok: true, ninangId: String(r[ninangCol_('Ninang ID')]), duplicate: true });
        }
        notes.push('CHECK: same GCash reference as ' + r[ninangCol_('Ninang ID')] + '.');
      }
    }

    const id = ninangNextId_(data);
    const now = new Date();
    let shot = '';
    if (p.paymentScreenshotBase64) {
      try {
        shot = saveScreenshotToDrive(p.paymentScreenshotBase64, p.paymentScreenshotFilename, id);
      } catch (err) {
        notes.push('Screenshot upload failed. Ask for the proof again.');
      }
    }

    const row = NINANGS.HEADERS.map(function () { return ''; });
    const set = function (h, v) { row[ninangCol_(h)] = typeof v === 'string' ? sanitizeForSheet_(v) : v; };
    set('Timestamp', now);
    set('Ninang ID', id);
    set('First Name', p.firstName);
    set('Last Name', p.lastName);
    set('Full Name', joinName_(p.firstName, p.lastName));
    set('Show As', p.showAs);
    set('Wall Name', p.wallName);
    set('Email', p.email);
    set('Mobile', p.phone);
    set('Facebook Link', p.facebook);
    set('Giving', p.giving);
    set('Cash Amount', p.cashAmount === '' ? '' : p.cashAmount);
    set('GCash Reference', p.paymentReference);
    set('Payment Screenshot', shot);
    set('Items', p.items);
    set('Item Quantity', p.itemQuantity);
    set('Item Handover', p.handover);
    set('Pickup Address / Notes', p.pickupNotes);
    set('Birthday Message for SSOB', p.message);
    set('Status', NINANGS.STATUS.PENDING);
    set('Items Received', p.items ? 'No' : '');
    set('DPA Consent', 'Yes');
    set('Admin Notes', notes.join(' '));
    set('Last Updated', now);
    set('Updated By', 'Form');
    sheet.appendRow(row);

    try {
      if (mailQuotaLeft_() > CONFIG.QUOTA_RESERVE_FOR_QR) {
        sendNinangPledgeEmail_(ninangObj_(row));
      } else {
        ninangAddNote_(sheet, id, 'Pledge email skipped (daily email limit nearly used).');
      }
    } catch (err) {
      ninangAddNote_(sheet, id, 'Pledge email not sent: ' + err.message);
    }

    return jsonResponse({ ok: true, ninangId: id });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Server error: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

/** GET ?action=ninangs — the wall. Names of Received Ninangs only, no contact data or amounts. */
function publicNinangs_() {
  const d = ninangRows_();
  const wall = [];
  for (let i = 1; i < d.data.length; i++) {
    const r = d.data[i];
    if (String(r[ninangCol_('Status')]) !== NINANGS.STATUS.RECEIVED) continue;
    const anon = String(r[ninangCol_('Show As')]) === 'Anonymous';
    const name = anon ? NINANGS.ANON_LABEL : String(r[ninangCol_('Wall Name')] || r[ninangCol_('Full Name')] || '').trim();
    if (name) wall.push(name);
  }
  return { ok: true, open: getSwitch_('Ninang Pledges Open'), wall: wall, count: wall.length };
}

// ============================================================
//  NUMBERS (used by computeBudget_)
// ============================================================

/** Cash marked received on Received rows; pending pledges shown separately. */
function ninangTotals_() {
  const d = ninangRows_();
  const t = { cashReceived: 0, cashPending: 0, received: 0, pending: 0, issue: 0, total: 0, itemPledges: 0 };
  for (let i = 1; i < d.data.length; i++) {
    const r = d.data[i];
    if (!r[ninangCol_('Ninang ID')]) continue;
    const st = String(r[ninangCol_('Status')]);
    if (st === NINANGS.STATUS.CANCELLED) continue;
    t.total++;
    if (String(r[ninangCol_('Items')] || '').trim()) t.itemPledges++;
    if (st === NINANGS.STATUS.RECEIVED) {
      t.received++;
      t.cashReceived += Number(r[ninangCol_('Cash Received')]) || 0;
    } else if (st === NINANGS.STATUS.PENDING) {
      t.pending++;
      t.cashPending += Number(r[ninangCol_('Cash Amount')]) || 0;
    } else if (st === NINANGS.STATUS.ISSUE) {
      t.issue++;
    }
  }
  return t;
}

// ============================================================
//  EMAILS
// ============================================================

function ninangObj_(row) {
  const o = {};
  NINANGS.HEADERS.forEach(function (h, i) { o[h] = row[i]; });
  return o;
}

function ninangAddNote_(sheet, id, note) {
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][ninangCol_('Ninang ID')]) === id) {
      const prev = String(data[i][ninangCol_('Admin Notes')] || '');
      sheet.getRange(i + 1, ninangCol_('Admin Notes') + 1).setValue(sanitizeForSheet_(prev ? prev + ' ' + note : note));
      return;
    }
  }
}

function ninangWallLabel_(o) {
  return String(o['Show As']) === 'Anonymous' ? NINANGS.ANON_LABEL + ' (your details stay private)' : String(o['Wall Name'] || o['Full Name']);
}

function ninangSummaryRows_(o) {
  let rows =
    infoRow_('Ninang ID', '<strong>' + escapeHtml_(o['Ninang ID']) + '</strong>') +
    infoRow_('Name', escapeHtml_(o['Full Name'])) +
    infoRow_('Thanked as', escapeHtml_(ninangWallLabel_(o)));
  if (o['Cash Amount'] !== '' && o['Cash Amount'] != null) {
    rows += infoRow_('Cash', escapeHtml_(ninangPeso_(o['Cash Amount'])) + ' via GCash') +
      infoRow_('Reference No.', escapeHtml_(o['GCash Reference']));
  }
  if (o['Items']) {
    rows += infoRow_('Items', escapeHtml_(o['Items']) + (o['Item Quantity'] ? ' (' + escapeHtml_(o['Item Quantity']) + ')' : '')) +
      infoRow_('Handover', escapeHtml_(o['Item Handover']));
  }
  return rows;
}

function ninangSiteLink_() {
  return (CONFIG.SITE_BASE_URL || '').replace(/\/$/, '') + '/ninang/';
}

/** Right after the form is sent. */
function sendNinangPledgeEmail_(o) {
  const hasCash = o['Cash Amount'] !== '' && o['Cash Amount'] != null;
  const hasItems = !!o['Items'];
  const next = [];
  if (hasCash) next.push('Our team checks your GCash payment by hand against the reference number above.');
  if (hasItems) {
    next.push(o['Item Handover'] === 'Please pick up'
      ? 'We will message you to arrange a pickup time for your items.'
      : 'We will message you with where and when to drop off your items.');
  }
  next.push('Once your gift is received, we email you again and add ' +
    (String(o['Show As']) === 'Anonymous' ? 'an "Anonymous Ninang"' : 'your name') + ' to the Ninang wall.');

  const bodyHtml =
    '<p>Hi ' + escapeHtml_(greetName_(o['First Name'], o['Full Name'])) + ',</p>' +
    '<p>Thank you for being a Ninang of GAME TIME! 💖 Your kindness helps us give SSOB a birthday celebration ' +
    'to remember, together with the A\'TIN and BBQs. Here is a copy of your pledge:</p>' +
    infoBox_(ninangSummaryRows_(o)) +
    '<p><strong>What happens next</strong></p>' +
    stepsHtml_(next) +
    '<p>If you need to change anything, email <strong>' + CONFIG.ORGANIZER_CONTACT_EMAIL + '</strong> and include your Ninang ID.</p>' +
    '<p>Salamat po, Ninang!</p>';

  const shell = buildEmailShell_({ pillLabel: 'Pledge Received', pillColor: '#ff6fae', pillTextColor: '#0a0a0a', bodyHtml: bodyHtml });
  MailApp.sendEmail({
    to: o['Email'],
    subject: '[GAME TIME] Thank you, Ninang! We got your pledge (' + o['Ninang ID'] + ')',
    htmlBody: shell.html,
    body: 'Hi ' + greetName_(o['First Name'], o['Full Name']) + ',\n\nThank you for being a Ninang of GAME TIME! ' +
      'We got your pledge (' + o['Ninang ID'] + '). We will email you again once it is received.\n\n' + CONFIG.SENDER_DISPLAY_NAME,
    name: CONFIG.SENDER_DISPLAY_NAME,
    inlineImages: shell.inlineImages,
  });
}

/** When Status becomes Received. */
function sendNinangThankYouEmail_(o) {
  const anon = String(o['Show As']) === 'Anonymous';
  const received = [];
  if (Number(o['Cash Received']) > 0) received.push(ninangPeso_(o['Cash Received']) + ' cash');
  if (o['Items'] && String(o['Items Received']) !== 'No') received.push(String(o['Items']));
  const bodyHtml =
    '<p>Hi ' + escapeHtml_(greetName_(o['First Name'], o['Full Name'])) + ',</p>' +
    '<p>We received your gift' + (received.length ? ' (<strong>' + escapeHtml_(received.join(' and ')) + '</strong>)' : '') +
    '. Thank you so much, Ninang! 💖</p>' +
    '<p>Every gift goes to the food, freebies and program for GAME TIME, so more A\'TIN and BBQs can celebrate SSOB together on November 14.</p>' +
    infoBox_(ninangSummaryRows_(o)) +
    '<p>' + (anon
      ? 'You are now on our Ninang wall as <strong>Anonymous Ninang</strong>. Your name stays private.'
      : 'Your name, <strong>' + escapeHtml_(o['Wall Name'] || o['Full Name']) + '</strong>, is now on our Ninang wall.') +
    ' See it here:</p>' +
    buttonHtml_(ninangSiteLink_(), 'See the Ninang wall') +
    '<p>Salamat po, Ninang!</p>';
  const shell = buildEmailShell_({ pillLabel: 'Gift Received ✓', pillColor: '#2e7d46', pillTextColor: '#ffffff', bodyHtml: bodyHtml });
  MailApp.sendEmail({
    to: o['Email'],
    subject: '[GAME TIME] Salamat, Ninang! We received your gift (' + o['Ninang ID'] + ')',
    htmlBody: shell.html,
    body: 'Hi ' + greetName_(o['First Name'], o['Full Name']) + ',\n\nWe received your gift. Thank you so much, Ninang!\n' +
      (anon ? 'You are on our Ninang wall as Anonymous Ninang.' : 'Your name is now on our Ninang wall.') + '\n' + ninangSiteLink_() +
      '\n\n' + CONFIG.SENDER_DISPLAY_NAME,
    name: CONFIG.SENDER_DISPLAY_NAME,
    inlineImages: shell.inlineImages,
  });
}

/** When Status becomes Payment Issue. */
function sendNinangIssueEmail_(o) {
  const bodyHtml =
    '<p>Hi ' + escapeHtml_(greetName_(o['First Name'], o['Full Name'])) + ',</p>' +
    '<p>Thank you for your pledge! We tried to match your GCash payment, but we could not find it yet. ' +
    'This usually means the reference number has a typo, or the screenshot is unclear.</p>' +
    infoBox_(ninangSummaryRows_(o)) +
    '<p>Please email <strong>' + CONFIG.ORGANIZER_CONTACT_EMAIL + '</strong> or message us on Facebook with your Ninang ID, ' +
    'the correct reference number and a clear screenshot, and we will sort it out.</p>' +
    '<p>Salamat po, Ninang!</p>';
  const shell = buildEmailShell_({ pillLabel: 'Please Check', pillColor: '#d1124f', pillTextColor: '#ffffff', bodyHtml: bodyHtml });
  MailApp.sendEmail({
    to: o['Email'],
    subject: '[GAME TIME] We could not find your GCash payment yet (' + o['Ninang ID'] + ')',
    htmlBody: shell.html,
    body: 'Hi ' + greetName_(o['First Name'], o['Full Name']) + ',\n\nWe could not find your GCash payment for ' + o['Ninang ID'] +
      ' yet. Please email ' + CONFIG.ORGANIZER_CONTACT_EMAIL + ' with the correct reference number and a clear screenshot.\n\n' +
      CONFIG.SENDER_DISPLAY_NAME,
    name: CONFIG.SENDER_DISPLAY_NAME,
    inlineImages: shell.inlineImages,
  });
}

/**
 * Runs every minute (from processConfirmedStatusChanges). Sends the
 * thank-you or payment-issue email once per status, tracked in the
 * "Status Email" column, e.g. "Received: sent Oct 22, 6:30 PM".
 */
function sendNinangStatusEmails_() {
  const sheet = ninangSheet_();
  if (!sheet) return 0;
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) return 0;
  let sent = 0;
  try {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length && sent < NINANGS.EMAILS_PER_RUN; i++) {
      const o = ninangObj_(data[i]);
      const st = String(o['Status']);
      if (st !== NINANGS.STATUS.RECEIVED && st !== NINANGS.STATUS.ISSUE) continue;
      const mark = String(o['Status Email'] || '');
      if (mark.indexOf(st + ': sent') === 0) continue;
      const fails = (mark.indexOf(st + ': failed') === 0) ? Number((mark.match(/\((\d+)\)/) || [0, 0])[1]) : 0;
      if (fails >= 3) continue;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(o['Email']))) continue;
      if (mailQuotaLeft_() <= NINANGS.QUOTA_RESERVE) break;
      // Cash received defaults to the pledged amount when the team leaves it blank.
      if (st === NINANGS.STATUS.RECEIVED && o['Cash Amount'] !== '' && (o['Cash Received'] === '' || o['Cash Received'] == null)) {
        o['Cash Received'] = Number(o['Cash Amount']) || 0;
        sheet.getRange(i + 1, ninangCol_('Cash Received') + 1).setValue(o['Cash Received']);
      }
      const cell = sheet.getRange(i + 1, ninangCol_('Status Email') + 1);
      try {
        if (st === NINANGS.STATUS.RECEIVED) sendNinangThankYouEmail_(o);
        else sendNinangIssueEmail_(o);
        cell.setValue(st + ': sent ' + Utilities.formatDate(new Date(), 'Asia/Manila', 'MMM d, h:mm a'));
        sent++;
      } catch (err) {
        cell.setValue(st + ': failed (' + (fails + 1) + ') ' + String(err.message).slice(0, 80));
      }
    }
  } finally {
    lock.releaseLock();
  }
  return sent;
}

// ============================================================
//  DASHBOARD (Ninangs tab)
// ============================================================

function dashNinangRow_(r, staff) {
  const c = function (h) { return r[ninangCol_(h)]; };
  const out = {
    id: String(c('Ninang ID') || ''),
    name: String(c('Full Name') || ''),
    showAs: String(c('Show As') || ''),
    wallName: String(c('Wall Name') || ''),
    giving: String(c('Giving') || ''),
    cashAmount: c('Cash Amount') === '' ? null : Number(c('Cash Amount')) || 0,
    cashReceived: c('Cash Received') === '' ? null : Number(c('Cash Received')) || 0,
    items: String(c('Items') || ''),
    itemQuantity: String(c('Item Quantity') || ''),
    handover: String(c('Item Handover') || ''),
    itemsReceived: String(c('Items Received') || ''),
    message: String(c('Birthday Message for SSOB') || ''),
    status: String(c('Status') || ''),
    statusEmail: String(c('Status Email') || ''),
    note: String(c('Admin Notes') || ''),
    at: c('Timestamp') ? Utilities.formatDate(new Date(c('Timestamp')), CHECKIN.TZ, 'MMM d, h:mm a') : '',
  };
  if (staff.role === 'Admin') {
    out.email = String(c('Email') || '');
    out.mobile = String(c('Mobile') || '');
    out.facebook = String(c('Facebook Link') || '');
    out.reference = String(c('GCash Reference') || '');
    out.screenshot = String(c('Payment Screenshot') || '');
    out.pickupNotes = String(c('Pickup Address / Notes') || '');
  }
  return out;
}

function dashNinangList_(staff) {
  const d = ninangRows_();
  const rows = [];
  for (let i = 1; i < d.data.length; i++) {
    if (d.data[i][ninangCol_('Ninang ID')]) rows.push(dashNinangRow_(d.data[i], staff));
  }
  rows.reverse(); // newest first
  return { ok: true, rows: rows, totals: ninangTotals_(), canEdit: staff.role === 'Admin', statuses: Object.values(NINANGS.STATUS), open: getSwitch_('Ninang Pledges Open') };
}

/** Admin: set status, cash received, items received, note. Emails follow from the sweep. */
function dashNinangSave_(req, staff) {
  if (staff.role !== 'Admin') return { ok: false, code: 'FORBIDDEN', error: 'Only an admin can update Ninangs.' };
  const f = req.fields || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = ninangRows_();
    if (!d.sheet) return { ok: false, code: 'NOT_FOUND', error: 'The Ninangs tab is missing. Run Set Up Ninangs Sheet from the menu.' };
    let rowIdx = -1;
    for (let i = 1; i < d.data.length; i++) {
      if (String(d.data[i][ninangCol_('Ninang ID')]) === String(req.id)) { rowIdx = i; break; }
    }
    if (rowIdx === -1) return { ok: false, code: 'NOT_FOUND', error: 'That Ninang was not found. Refresh and try again.' };
    const r = d.data[rowIdx];
    const put = function (h, v) { r[ninangCol_(h)] = v; d.sheet.getRange(rowIdx + 1, ninangCol_(h) + 1).setValue(v); };

    if (f.status != null) {
      if (Object.values(NINANGS.STATUS).indexOf(f.status) === -1) return { ok: false, code: 'BAD_REQUEST', error: 'Unknown status.' };
      put('Status', f.status);
    }
    if (f.cashReceived != null && f.cashReceived !== '') {
      const v = ninangMoney_(f.cashReceived);
      if (!(v >= 0)) return { ok: false, code: 'BAD_REQUEST', error: 'Cash received must be a number, like 500.' };
      put('Cash Received', v);
    } else if (f.status === NINANGS.STATUS.RECEIVED && r[ninangCol_('Cash Amount')] !== '' && r[ninangCol_('Cash Received')] === '') {
      put('Cash Received', Number(r[ninangCol_('Cash Amount')]) || 0);
    }
    if (f.itemsReceived != null) {
      if (['Yes', 'No', 'Partly', ''].indexOf(f.itemsReceived) === -1) return { ok: false, code: 'BAD_REQUEST', error: 'Items received must be Yes, No or Partly.' };
      put('Items Received', f.itemsReceived);
    }
    if (f.note != null) put('Admin Notes', sanitizeForSheet_(ninangClean_(f.note)));
    put('Last Updated', new Date());
    put('Updated By', staff.name);
    return { ok: true, record: dashNinangRow_(r, staff), totals: ninangTotals_(), budget: computeBudget_(dashSheetData_().data) };
  } finally {
    lock.releaseLock();
  }
}

/** Menu: send waiting thank-you and payment-issue emails now instead of waiting a minute. */
function sendNinangEmailsNow() {
  const n = sendNinangStatusEmails_();
  try { SpreadsheetApp.getUi().alert(n + ' Ninang email(s) sent.'); } catch (e) { /* editor */ }
}
