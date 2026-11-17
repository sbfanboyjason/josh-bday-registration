/**
 * ============================================================
 *  FEEDBACK + RAFFLE — after the event
 * ============================================================
 *  Add this as a SIXTH script file in the same Apps Script project
 *  (File > + > Script, name it "Feedback").
 *
 *  - Public page: /feedback/ on the site. Attendees answer a short survey.
 *  - Raffle entry: answer the survey AND upload a screenshot of your posted
 *    Google review of Teaspoon Cafe Juan Luna. One entry per attendee email.
 *    The team checks each screenshot and sets Raffle Check to Valid.
 *  - Answers land in their own sheet tab, "Feedback".
 *  - The "thank you + survey" email goes to every Approved attendee
 *    (paid and free passes). Turn on the "Send Feedback Emails" switch in
 *    _Config and the every-minute trigger sends it in small batches within
 *    the daily Gmail limit. Each address gets it once.
 * ============================================================
 */

const FEEDBACK = {
  SHEET_NAME: 'Feedback',
  HEADERS: [
    'Timestamp',
    'Raffle No.',
    'Registration ID',
    'Full Name',
    'Email',
    'On Attendee List',
    'Overall Rating',
    'Enjoyed Most',
    'Could Be Better',
    'Join Next Event',
    'Next Event Ideas',
    'Name on Google Review',
    'Review Screenshot',
    'Raffle Check',
    'Admin Notes',
  ],
  RAFFLE_CHECK: { PENDING: 'For checking', VALID: 'Valid', INVALID: 'Not valid', NONE: 'No entry (no review screenshot)' },
  JOIN: ['Yes', 'Maybe', 'No'],
  MAX_TEXT: 1000,
  EMAILS_PER_RUN: 20,
  QUOTA_FLOOR: 5,
  SENT_PROP: 'feedbackEmailed',

  // Links used in the email and on the page. Swap them here if they change.
  TEASPOON_REVIEW_URL: 'https://share.google/zFc50jDKMRlpKhQuC',
  EXAMPLE_REVIEW_URL: '', // link to our own posted review; leave '' to hide the link
  DEADLINE_DISPLAY: 'November 30, 2026',
  PRIZE: 'SB19 merch',
};

function feedbackSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FEEDBACK.SHEET_NAME);
}

function feedbackCol_(h) {
  return FEEDBACK.HEADERS.indexOf(h);
}

function feedbackPageUrl_() {
  return (CONFIG.SITE_BASE_URL || '').replace(/\/$/, '') + '/feedback/';
}

/** Menu: creates or repairs the Feedback tab. Keeps rows already there. */
function setupFeedbackSheet(silent) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = feedbackSheet_();
  if (!sheet) sheet = ss.insertSheet(FEEDBACK.SHEET_NAME);
  const H = FEEDBACK.HEADERS;
  sheet.getRange(1, 1, 1, H.length).setValues([H])
    .setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.getRange(2, H.indexOf('Raffle Check') + 1, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(Object.values(FEEDBACK.RAFFLE_CHECK), true).setAllowInvalid(false).build()
  );
  try { sheet.setTabColor('#2b95ff'); } catch (e) { /* older sheets */ }
  if (silent !== true) {
    try {
      SpreadsheetApp.getUi().alert(
        'The Feedback tab is ready.\n\nSurvey answers from the /feedback/ page land here. ' +
        'For raffle entries, open the review screenshot and set Raffle Check to Valid or Not valid. ' +
        'Draw only from rows marked Valid.'
      );
    } catch (e) { /* no UI when run from the editor */ }
  }
  return sheet;
}

function feedbackClean_(v, max) {
  return String(v == null ? '' : v).replace(/\r\n/g, '\n').trim().slice(0, max || FEEDBACK.MAX_TEXT);
}

/** Approved attendee rows (paid and free passes) with an email, test rows left out. */
function feedbackAttendees_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const out = [];
  if (!sheet) return out;
  const data = sheet.getDataRange().getValues();
  const c = function (h) { return HEADERS.indexOf(h); };
  const seen = {};
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const id = String(r[c('Registration ID')] || '');
    if (!id || id.toUpperCase().indexOf('TEST-') === 0) continue;
    if (String(r[c('Status')]) !== STATUS.APPROVED) continue;
    const email = String(r[c('Email Address')] || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    const key = email.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push({
      regId: id,
      email: email,
      first: String(r[c('First Name')] || ''),
      full: String(r[c('Full Legal Name')] || ''),
    });
  }
  return out;
}

function feedbackFindAttendee_(email) {
  const key = String(email || '').trim().toLowerCase();
  const list = feedbackAttendees_();
  for (let i = 0; i < list.length; i++) if (list[i].email.toLowerCase() === key) return list[i];
  return null;
}

function feedbackNextRaffle_(data) {
  let max = 0;
  const c = feedbackCol_('Raffle No.');
  for (let i = 1; i < data.length; i++) {
    const m = String(data[i][c] || '').match(/^RAF-(\d+)$/i);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return 'RAF-' + String(max + 1).padStart(3, '0');
}

/** Returns an error message, or null. Cleans the payload in place. */
function validateFeedback_(p) {
  if (!p) return 'Missing submission data.';
  if (p.website) return 'Submission rejected.';
  p.name = feedbackClean_(p.name, 120).replace(/\s+/g, ' ');
  p.email = feedbackClean_(p.email, 200);
  p.regId = feedbackClean_(p.regId, 40).toUpperCase();
  p.enjoyed = feedbackClean_(p.enjoyed);
  p.better = feedbackClean_(p.better);
  p.ideas = feedbackClean_(p.ideas);
  p.reviewName = feedbackClean_(p.reviewName, 120).replace(/\s+/g, ' ');
  p.join = feedbackClean_(p.join, 10);
  p.rating = Number(p.rating);
  if (!p.name) return 'Please enter your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return 'Please enter a valid email address.';
  if (!(p.rating >= 1 && p.rating <= 5 && Math.floor(p.rating) === p.rating)) return 'Please rate the event from 1 to 5.';
  if (FEEDBACK.JOIN.indexOf(p.join) === -1) return 'Please tell us if you would join our next event.';
  if (p.reviewScreenshotBase64 && !p.reviewName) return 'Please enter the name shown on your Google review.';
  if (p.dpaConsent !== true) return 'Please agree to the Data Privacy Notice.';
  return null;
}

/** POST ?action=feedback */
function handleFeedback_(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    let p;
    try {
      p = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse({ ok: false, error: 'Malformed request.' });
    }
    const error = validateFeedback_(p);
    if (error) return jsonResponse({ ok: false, error: error });
    if (!getSwitch_('Feedback Form Open')) {
      return jsonResponse({ ok: false, error: 'The feedback survey is closed. Thank you! For questions, email ' + CONFIG.ORGANIZER_CONTACT_EMAIL + '.' });
    }

    let sheet = feedbackSheet_();
    if (!sheet) sheet = setupFeedbackSheet(true);
    const data = sheet.getDataRange().getValues();
    const key = p.email.toLowerCase();
    const hasShot = !!p.reviewScreenshotBase64;

    // One answer per email. A second send adds a review screenshot to an
    // answer that had none, otherwise it just returns the first result.
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][feedbackCol_('Email')]).toLowerCase() !== key) continue;
      const raffle = String(data[i][feedbackCol_('Raffle No.')] || '');
      if (raffle || !hasShot) {
        return jsonResponse({ ok: true, duplicate: true, raffleNo: raffle });
      }
      const newNo = feedbackNextRaffle_(data);
      let url = '';
      try { url = saveScreenshotToDrive(p.reviewScreenshotBase64, p.reviewScreenshotFilename, newNo + '_review'); } catch (err) { /* noted below */ }
      const rowNum = i + 1;
      sheet.getRange(rowNum, feedbackCol_('Raffle No.') + 1).setValue(newNo);
      sheet.getRange(rowNum, feedbackCol_('Name on Google Review') + 1).setValue(sanitizeForSheet_(p.reviewName));
      sheet.getRange(rowNum, feedbackCol_('Review Screenshot') + 1).setValue(url);
      sheet.getRange(rowNum, feedbackCol_('Raffle Check') + 1).setValue(FEEDBACK.RAFFLE_CHECK.PENDING);
      if (!url) sheet.getRange(rowNum, feedbackCol_('Admin Notes') + 1).setValue('Screenshot upload failed. Ask for it again.');
      feedbackThanks_(p, newNo);
      return jsonResponse({ ok: true, raffleNo: newNo, added: true });
    }

    const att = feedbackFindAttendee_(p.email);
    const raffleNo = hasShot ? feedbackNextRaffle_(data) : '';
    const notes = [];
    let shot = '';
    if (hasShot) {
      try {
        shot = saveScreenshotToDrive(p.reviewScreenshotBase64, p.reviewScreenshotFilename, raffleNo + '_review');
      } catch (err) {
        notes.push('Screenshot upload failed. Ask for it again.');
      }
    }
    if (!att) notes.push('CHECK: email not found among approved attendees.');

    const row = FEEDBACK.HEADERS.map(function () { return ''; });
    const set = function (h, v) { row[feedbackCol_(h)] = typeof v === 'string' ? sanitizeForSheet_(v) : v; };
    set('Timestamp', new Date());
    set('Raffle No.', raffleNo);
    set('Registration ID', att ? att.regId : p.regId);
    set('Full Name', p.name);
    set('Email', p.email);
    set('On Attendee List', att ? 'Yes' : 'No');
    set('Overall Rating', p.rating);
    set('Enjoyed Most', p.enjoyed);
    set('Could Be Better', p.better);
    set('Join Next Event', p.join);
    set('Next Event Ideas', p.ideas);
    set('Name on Google Review', p.reviewName);
    set('Review Screenshot', shot);
    set('Raffle Check', hasShot ? FEEDBACK.RAFFLE_CHECK.PENDING : FEEDBACK.RAFFLE_CHECK.NONE);
    set('Admin Notes', notes.join(' '));
    sheet.appendRow(row);

    if (raffleNo) feedbackThanks_(p, raffleNo);
    return jsonResponse({ ok: true, raffleNo: raffleNo });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Server error: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

/** Short confirmation with the raffle number. Skipped quietly when the daily limit is low. */
function feedbackThanks_(p, raffleNo) {
  try {
    if (mailQuotaLeft_() <= CONFIG.QUOTA_RESERVE_FOR_QR) return;
    const first = String(p.name).split(' ')[0];
    const bodyHtml =
      '<p>Hi ' + escapeHtml_(first) + ',</p>' +
      '<p>Thank you for answering our survey and for reviewing Teaspoon Cafe Juan Luna! You are in the ' +
      escapeHtml_(FEEDBACK.PRIZE) + ' raffle.</p>' +
      infoBox_(infoRow_('Raffle No.', '<strong>' + escapeHtml_(raffleNo) + '</strong>')) +
      '<p>Our team checks each review screenshot before the draw. We will announce the winners on our ' +
      '<a href="https://www.facebook.com/sb19atinfanboys" style="color:#ff6fae;">Facebook page</a>. Keep this number handy.</p>' +
      '<p>Salamat po!</p>';
    const shell = buildEmailShell_({ pillLabel: 'Raffle Entry', pillColor: '#ff6fae', pillTextColor: '#0a0a0a', bodyHtml: bodyHtml });
    MailApp.sendEmail({
      to: p.email,
      subject: '[GAME TIME] You are in the raffle! (' + raffleNo + ')',
      htmlBody: shell.html,
      body: 'Hi ' + first + ',\n\nThank you for answering our survey and reviewing Teaspoon Cafe Juan Luna. ' +
        'Your raffle number is ' + raffleNo + '. Winners will be announced on our Facebook page.\n\n' + CONFIG.SENDER_DISPLAY_NAME,
      name: CONFIG.SENDER_DISPLAY_NAME,
      inlineImages: shell.inlineImages,
    });
  } catch (err) {
    console.error('feedbackThanks_: ' + err.message);
  }
}

// ============================================================
//  THE "THANK YOU + SURVEY" EMAIL
// ============================================================

function feedbackEmailParts_(a) {
  const link = feedbackPageUrl_() + '?r=' + encodeURIComponent(a.regId);
  const example = (CONFIG.SITE_BASE_URL || '').replace(/\/$/, '') + '/feedback/review-example.jpg';
  const exampleLink = FEEDBACK.EXAMPLE_REVIEW_URL
    ? ' You can also <a href="' + FEEDBACK.EXAMPLE_REVIEW_URL + '" style="color:#ff6fae;">see it on Google Maps</a>.'
    : '';
  const bodyHtml =
    '<p>Hi ' + escapeHtml_(greetName_(a.first, a.full)) + ',</p>' +
    '<p>Thank you for celebrating SSOB\'s birthday with us at GAME TIME on November 14! We hope you had fun ' +
    'and went home full and happy.</p>' +
    '<p>We have two quick favors to ask. <strong>Do both and you get one entry in our ' + escapeHtml_(FEEDBACK.PRIZE) +
    ' raffle.</strong></p>' +
    '<p style="margin-bottom:6px;"><strong>1. Answer our feedback survey</strong></p>' +
    '<p style="margin-top:0;">It takes about 3 minutes. Your answers help us plan the next A\'TIN Fanboys event.</p>' +
    buttonHtml_(link, 'Answer the survey') +
    '<p style="margin-bottom:6px;"><strong>2. Review Teaspoon Cafe Juan Luna on Google</strong></p>' +
    '<p style="margin-top:0;">Teaspoon hosted all of us for the night. Share your own honest experience of the place, ' +
    'the food and the staff. Then take a screenshot of your posted review and upload it in the survey.</p>' +
    buttonHtml_(FEEDBACK.TEASPOON_REVIEW_URL, 'Review Teaspoon on Google') +
    '<p>Not sure what to write? Here is the review we posted, as an example.' + exampleLink + '</p>' +
    '<p style="text-align:center;margin:0 0 22px;"><img src="' + example + '" width="300" alt="Example Google review of Teaspoon Cafe Juan Luna" ' +
    'style="width:300px;max-width:100%;height:auto;border:1px solid rgba(255,111,174,0.35);border-radius:8px;" /></p>' +
    warningBox_(
      '<strong>Raffle details</strong><br>' +
      'Send your survey and review screenshot by <strong>' + escapeHtml_(FEEDBACK.DEADLINE_DISPLAY) + '</strong>. ' +
      'One entry per attendee. We will announce the winners on our Facebook page.'
    ) +
    '<p>Salamat po, and see you at the next one!</p>';
  const text =
    'Hi ' + greetName_(a.first, a.full) + ',\n\n' +
    'Thank you for celebrating SSOB\'s birthday with us at GAME TIME on November 14!\n\n' +
    'Do these two things and you get one entry in our ' + FEEDBACK.PRIZE + ' raffle:\n\n' +
    '1. Answer our feedback survey (about 3 minutes): ' + link + '\n' +
    '2. Review Teaspoon Cafe Juan Luna on Google with your honest experience: ' + FEEDBACK.TEASPOON_REVIEW_URL + '\n' +
    '   Then upload a screenshot of your posted review in the survey.\n\n' +
    'Deadline: ' + FEEDBACK.DEADLINE_DISPLAY + '. One entry per attendee. Winners will be announced on our Facebook page.\n\n' +
    CONFIG.SENDER_DISPLAY_NAME;
  return { html: bodyHtml, text: text };
}

function sendFeedbackEmail_(a) {
  const parts = feedbackEmailParts_(a);
  const shell = buildEmailShell_({ pillLabel: 'Thank You', pillColor: '#ff6fae', pillTextColor: '#0a0a0a', bodyHtml: parts.html });
  MailApp.sendEmail({
    to: a.email,
    subject: '[GAME TIME] Salamat sa pagpunta! Quick survey and a raffle entry',
    htmlBody: shell.html,
    body: parts.text,
    name: CONFIG.SENDER_DISPLAY_NAME,
    inlineImages: shell.inlineImages,
  });
}

function feedbackSentSet_() {
  const raw = PropertiesService.getScriptProperties().getProperty(FEEDBACK.SENT_PROP);
  try { return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
}

/**
 * Sends the next batch of thank-you emails. Called by the every-minute
 * trigger while the "Send Feedback Emails" switch is Yes, and by the menu.
 * Returns { sent, left }.
 */
function sendFeedbackEmailsBatch_() {
  const sent = feedbackSentSet_();
  const answered = {};
  const fb = feedbackSheet_();
  if (fb) {
    const d = fb.getDataRange().getValues();
    for (let i = 1; i < d.length; i++) answered[String(d[i][feedbackCol_('Email')]).toLowerCase()] = true;
  }
  const todo = feedbackAttendees_().filter(function (a) {
    const k = a.email.toLowerCase();
    return !sent[k] && !answered[k];
  });
  let count = 0;
  for (let i = 0; i < todo.length && count < FEEDBACK.EMAILS_PER_RUN; i++) {
    if (mailQuotaLeft_() <= FEEDBACK.QUOTA_FLOOR) break;
    try {
      sendFeedbackEmail_(todo[i]);
      sent[todo[i].email.toLowerCase()] = new Date().toISOString();
      count++;
    } catch (err) {
      console.error('Feedback email to ' + todo[i].regId + ' failed: ' + err.message);
    }
  }
  PropertiesService.getScriptProperties().setProperty(FEEDBACK.SENT_PROP, JSON.stringify(sent));
  return { sent: count, left: todo.length - count };
}

/** From the every-minute trigger. */
function sendFeedbackEmailsIfOn_() {
  if (!getSwitch_('Send Feedback Emails')) return;
  sendFeedbackEmailsBatch_();
}

/** Menu: send one batch now and say how many are left. */
function sendFeedbackEmailsNow() {
  const r = sendFeedbackEmailsBatch_();
  const msg = 'Sent ' + r.sent + ' feedback email(s). ' + r.left + ' attendee(s) still waiting.' +
    (r.left ? '\n\nTurn on "Send Feedback Emails" in _Config and the rest go out automatically, within the daily Gmail limit.' : '');
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { console.log(msg); }
}

/** Menu: sends the email to the organizer address only, to check how it looks. */
function sendFeedbackTestEmail() {
  sendFeedbackEmail_({ regId: 'TEST-PREVIEW', email: CONFIG.ORGANIZER_CONTACT_EMAIL, first: 'Jason', full: 'Jason Sales' });
  try { SpreadsheetApp.getUi().alert('Test email sent to ' + CONFIG.ORGANIZER_CONTACT_EMAIL + '.'); } catch (e) { /* editor */ }
}
