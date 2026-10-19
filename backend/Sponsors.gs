/**
 * ============================================================
 *  SPONSORS — the "Sponsors" sheet, the dashboard Sponsors tab,
 *  and the public "thank you to our sponsors" strip
 * ============================================================
 *  Add this as a FOURTH script file in the same Apps Script project
 *  (File > + > Script, name it "Sponsors").
 *
 *  - One row per sponsor or prospect in the "Sponsors" sheet.
 *  - The team emails sponsors one by one from sbfanboyjason@gmail.com.
 *    This file only keeps the list and the status; it sends nothing.
 *  - Sponsor CASH RECEIVED counts in the budget and covers free passes
 *    before paid margins are needed (see computeBudget_ in Code.gs).
 *    Pledged cash is shown separately until it actually arrives.
 *  - What sponsors get back: a shoutout pubmat and social engagement,
 *    tracked in the "Pubmat" column, and their name on the
 *    registration page once confirmed (if "Show on Site" is Yes).
 *  - Menu > Load SB19 Brand Partners adds the researched starter list
 *    (brands SB19 has endorsed), skipping any name already there.
 * ============================================================
 */

const SPONSORS = {
  SHEET_NAME: 'Sponsors',
  HEADERS: [
    'Sponsor ID',
    'Name / Brand',
    'Category',
    'SB19 Tie-in',
    'Group',
    'Contact Person',
    'Email',
    'Mobile',
    'Website / Social',
    'Offer Type',
    'Offer Details',
    'Cash Pledged',
    'Cash Received',
    'Item Value (est.)',
    'Status',
    'Last Contacted',
    'Show on Site',
    'Logo URL',
    'Pubmat',
    'Notes',
    'Source',
    'Last Updated',
    'Updated By',
  ],
  STATUSES: ['Not contacted', 'Emailed', 'Followed up', 'Replied', 'Confirmed', 'Received', 'Declined', 'No reply'],
  // Statuses whose sponsors appear on the public page (if Show on Site = Yes).
  PUBLIC_STATUSES: ['Confirmed', 'Received'],
  OFFER_TYPES: ['Cash', 'Products', 'Food / Drinks', 'Freebies', 'Services', 'Mixed', 'TBD'],
  GROUPS: [
    'SB19 partner 2026',
    'SB19 partner 2024-2025',
    'SB19 partner (logo wall)',
    'SB19 past partner',
    'Member partner',
    'Music / industry partner',
    'Local / small business',
    'Fan / individual',
    'Other',
  ],
  PUBMAT: ['Not started', 'Drafted', 'Posted'],
  MAX_TEXT: 500,
};

// Editable fields from the dashboard -> sheet column.
const SPONSOR_FIELDS = {
  name: 'Name / Brand',
  category: 'Category',
  tieIn: 'SB19 Tie-in',
  group: 'Group',
  contactPerson: 'Contact Person',
  email: 'Email',
  mobile: 'Mobile',
  website: 'Website / Social',
  offerType: 'Offer Type',
  offerDetails: 'Offer Details',
  cashPledged: 'Cash Pledged',
  cashReceived: 'Cash Received',
  itemValue: 'Item Value (est.)',
  status: 'Status',
  lastContacted: 'Last Contacted',
  showOnSite: 'Show on Site',
  logoUrl: 'Logo URL',
  pubmat: 'Pubmat',
  notes: 'Notes',
  source: 'Source',
};

/**
 * Starter list: brands SB19 (or a member) has worked with, newest first.
 * Built October 19, 2026 from news reports and the partner logo wall the
 * team shared. Check each before emailing, since deals end. Contacts are
 * left blank on purpose: use the brand's official business or marketing
 * contact, not personal ones.
 *
 * "Music / industry partner" rows (labels, publishers, agencies, DOT) are
 * kept for completeness but are unlikely to sponsor a fan event.
 */
const SPONSOR_SEED = [
  ['REDMI / Xiaomi Philippines', 'Phones and gadgets', 'SB19 named REDMI Note 17 Series PH ambassadors (Sep 2026); Xiaomi ambassadors since 2024', 'SB19 partner 2026', 'https://www.gizguide.com/2026/09/redmi-note-17-series-sb19-brand-ambassadors.html'],
  ['Canva Philippines', 'Design software', 'Collaborated with SB19 on the single "Kaya" (2026)', 'SB19 partner 2026', 'https://billboardphilippines.com/music/news/sb19-canva-philippines-kaya-partnership/'],
  ['Sony Philippines', 'Audio and electronics', 'SB19 joined the ULT POWER SOUND "ULT Squad" (Jul 2026)', 'SB19 partner 2026', 'https://www.gizguide.com/2026/07/sb19-sony-ult-squad-ambassador.html'],
  ['Watsons Philippines', 'Health and beauty retail', 'SB19 named brand ambassadors (May 2026)', 'SB19 partner 2026', 'https://businessmirror.com.ph/2026/05/11/watsons-welcomes-sb19-as-brand-ambassadors/'],
  ['AIA Philippines', 'Life insurance', 'SB19 named wellness ambassadors (Apr 2026)', 'SB19 partner 2026', 'https://en.wikipedia.org/wiki/SB19'],
  ['GCash', 'E-wallet', 'SB19 GCash card designs (2024) and sticker bundle (2025)', 'SB19 partner 2024-2025', 'https://bilyonaryo.com/2024/03/05/gcash-makes-summer-sizzle-with-sb19-collab/technology/'],
  ['Puregold', 'Supermarket', 'SB19 endorsers (2024); Perks Card; OPMCON concerts (2025)', 'SB19 partner 2024-2025', 'https://en.wikipedia.org/wiki/SB19'],
  ['Acer Philippines', 'Laptops and computers', 'Ambassadors since 2021; Acer Day performances (2024, 2025)', 'SB19 partner 2024-2025', 'https://en.wikipedia.org/wiki/SB19'],
  ['Bench', 'Clothing', 'SB19 named Bench ambassadors (Dec 2024)', 'SB19 partner 2024-2025', 'https://tribune.net.ph/2024/12/07/sb19-is-benchs-newest-ambassadors'],
  ['IKEA Philippines', 'Home and furniture', 'Josh in #WakeUpItsTimeToSleep campaign (Jul 2024)', 'Member partner', 'https://bookingagentinfo.com/celebrity/josh-cullen-sb19/endorsements/'],
  ['Pepsi Philippines', 'Beverages', 'Pepsi campaign with SB19 (Dec 2023); on the partner logo wall', 'SB19 past partner', 'https://bookingagentinfo.com/celebrity/sb19/endorsements/'],
  ['Avignon Clinic', 'Skin care clinic', 'SB19 endorsement (May 2023)', 'SB19 past partner', 'https://bookingagentinfo.com/celebrity/sb19/endorsements/'],
  ["Dunkin' Philippines", 'Donuts and coffee', "SB19 menu items; Dunkin' Presents SB19 concert (2022)", 'SB19 past partner', 'https://en.wikipedia.org/wiki/SB19'],
  ["McDonald's Philippines", 'Fast food', 'SB19 Meal and commercials; on the partner logo wall', 'SB19 past partner', 'https://negrosnowdaily.com/sb19-newest-mcdo-endorsers/'],
  ['Pizza Hut Philippines', 'Pizza', 'SB19 endorsers', 'SB19 past partner', 'https://www.bworldonline.com/?p=465781'],
  ['KFC Philippines', 'Fast food', '#KFCDiBitinWithSB19 (Feb 2021)', 'SB19 past partner', 'https://bookingagentinfo.com/celebrity/sb19/endorsements/'],
  ['Lazada Philippines', 'Online shopping', 'SB19 brand ambassadors (2021)', 'SB19 past partner', 'https://www.manilatimes.net/2021/01/23/lifestyle-entertainment/show-times/lazada-takes-on-sb19-as-brand-ambassadors/830905/'],
  ['Lucky Me!', 'Instant noodles', 'SB19 endorsement; on the partner logo wall', 'SB19 past partner', 'https://en.wikipedia.org/wiki/SB19'],
  ['Selecta', 'Ice cream', 'SB19 endorsement', 'SB19 past partner', 'https://en.wikipedia.org/wiki/SB19'],
  ['CDO Idol', 'Hotdogs', 'SB19 endorsement; on the partner logo wall', 'SB19 past partner', 'https://en.wikipedia.org/wiki/SB19'],
  ['Mang Juan', 'Snacks', 'SB19 endorsement; on the partner logo wall', 'SB19 past partner', 'https://en.wikipedia.org/wiki/SB19'],
  ['Pasalubong ng Bayan', 'Food gifts', 'Pasalubong ng Bayan x SB19 (Feb 2021)', 'SB19 past partner', 'https://bookingagentinfo.com/celebrity/sb19/endorsements/'],
  // From the SB19 partner logo wall shared by the team (years not checked)
  ['TM (Globe)', 'Mobile network', 'On the SB19 partner logo wall', 'SB19 partner (logo wall)', 'Team screenshot'],
  ['Datu Puti', 'Condiments', 'On the SB19 partner logo wall', 'SB19 partner (logo wall)', 'Team screenshot'],
  ['Great Taste', 'Coffee', 'On the SB19 partner logo wall', 'SB19 partner (logo wall)', 'Team screenshot'],
  ['NovoDental', 'Dental clinic', 'On the SB19 partner logo wall', 'SB19 partner (logo wall)', 'Team screenshot'],
  ['Timezone Philippines', 'Arcades and entertainment', 'On the SB19 partner logo wall', 'SB19 partner (logo wall)', 'Team screenshot'],
  ['Fino Premium Touch', 'Hair care', 'On the SB19 partner logo wall', 'SB19 partner (logo wall)', 'Team screenshot'],
  ['Bonchon Philippines', 'Restaurant', 'On the SB19 partner logo wall', 'SB19 partner (logo wall)', 'Team screenshot'],
  ['Bioderm', 'Personal care (made by IPI)', 'On the SB19 partner logo wall', 'SB19 partner (logo wall)', 'Team screenshot'],
  ['Lunari Global', 'Talent management', 'International representation partner (Jun 2026)', 'Music / industry partner', 'https://en.wikipedia.org/wiki/SB19'],
  ['United Talent Agency (UTA)', 'Talent agency', 'International representation partner (Jun 2026)', 'Music / industry partner', 'https://en.wikipedia.org/wiki/SB19'],
  ['Department of Tourism', 'Government', 'SB19 named Philippine tourism ambassadors (Jul 2026)', 'Music / industry partner', 'https://www.philstar.com/entertainment/2026/07/26/2544844/sb19-named-philippine-tourism-ambassadors'],
  ['Sony Music Philippines', 'Record label', 'On the SB19 partner logo wall', 'Music / industry partner', 'Team screenshot'],
  ['Sony Music Publishing', 'Music publishing', 'On the SB19 partner logo wall', 'Music / industry partner', 'Team screenshot'],
  ['Universal Music Philippines', 'Record label', 'On the SB19 partner logo wall', 'Music / industry partner', 'Team screenshot'],
  ['Warner Chappell Music', 'Music publishing', 'On the SB19 partner logo wall', 'Music / industry partner', 'Team screenshot'],
  ['Believe', 'Music distribution', 'On the SB19 partner logo wall', 'Music / industry partner', 'Team screenshot'],
];

/**
 * Public business contacts for the starter list, found October 19, 2026
 * on each company's own website or official page (or, where noted, an
 * older or third-party listing). [email, how to reach / who, website].
 * Many brands have no public sponsorship email; for those the best route
 * is their contact form or a message to their official Facebook page.
 * Check before sending: contact details change.
 */
const SPONSOR_CONTACTS = {
  'Datu Puti': ['hello@nutriasia.com', 'NutriAsia (makes Datu Puti). Phone (02) 8800 3888', 'https://www.nutriasia.com/contact-us'],
  'Great Taste': ['customercare@urc.com.ph', 'URC (makes Great Taste). Use the contact form and pick the subject "Sponsorship Requests"', 'https://www.urc.com.ph/contact-us'],
  'Mang Juan': ['customercare@urc.com.ph', 'URC / Jack \'n Jill. Contact form subject "Sponsorship Requests"; FB page Mang Juan Republic', 'https://www.urc.com.ph/contact-us'],
  'Lucky Me!': ['inquiry@mondenissin.com', 'Monde Nissin general inquiries', 'https://mondenissin.com/contact-us/'],
  'CDO Idol': ['cdo@cdo.com.ph', 'Email is from a third-party listing; the contact form on cdo.com.ph is the official route. Phone (02) 294 1111', 'https://www.cdo.com.ph/contact-us'],
  'Bonchon Philippines': ['customercare@bonchon.com.ph', 'Customer care (ask to forward to Marketing); contact form on the site', 'https://bonchon.com.ph/contact-us'],
  'Timezone Philippines': ['', 'No public email. Party hotline 0920 932 7167, or message their Facebook page', 'https://www.timezonegames.com/en-ph/contact-us'],
  'NovoDental': ['info@novodental.com.ph', 'Phone +63 917 652 6686', 'https://novodental.com.ph'],
  'Bioderm': ['inquiry@ipi.ph', 'IPI, makers of Bioderm. Phone (032) 420 6900', 'https://ipi.ph'],
  'Fino Premium Touch': ['', 'No public PH email found. Message the Fino Philippines Facebook page', ''],
  'Pepsi Philippines': ['connect@pcppi.com.ph', 'Pepsi-Cola Products Philippines. Contact form topic "Marketing & Sales"; SMS 0998 567 3774', 'https://www.pepsiphilippines.com/contact-us'],
  "McDonald's Philippines": ['writeus@ph.mcd.com', 'Customer care (02) 8888-6236; ask to forward to Marketing', 'https://www.mcdonalds.com.ph/contact-us'],
  "Dunkin' Philippines": ['support@goldendonuts.freshdesk.com', 'Official contact address. An older Dunkin\' post pointed proposals to mktgservices@dunkindonuts.ph', 'https://dunkin.com.ph/contact-us'],
  'Pizza Hut Philippines': ['phutcsc@pizzahut.com.ph', 'Customer service; contact form on the site', 'https://www.pizzahut.com.ph/contact'],
  'Selecta': ['cec.philippines@unilever.com', 'Unilever Philippines consumer care, +632 8588 8800', 'https://www.selectaphilippines.com'],
  'Watsons Philippines': ['Sharon.Decapia@watsons.com.ph', 'SAVP, Marketing Communications, PR and Sustainability (listed on the Watsons Contact Us page). Customer care: watsons.customercare@watsons.com.ph', 'https://www.watsons.com.ph/contactUs'],
  'Bench': ['customersupport@benchmail.ph', 'Customer support (ask to forward to Marketing)', 'https://shop.bench.com.ph'],
  'Puregold': ['', 'No public marketing email found. Head office trunkline +632 522-8801 to 04 (older listing), or message the Puregold Facebook page', 'https://puregold.com.ph'],
  'KFC Philippines': ['', 'No public marketing email found. Message the KFC Philippines Facebook page', 'https://corporate.kfc.com.ph'],
};

/** Fills Email / Contact Person / Website on a row if they are blank. */
function sponsorApplyContact_(row, name) {
  const c = SPONSOR_CONTACTS[name];
  if (!c) return false;
  let changed = false;
  [['Email', c[0]], ['Contact Person', c[1]], ['Website / Social', c[2]]].forEach(function (pair) {
    const i = sponsorCol_(pair[0]);
    if (pair[1] && !String(row[i] || '').trim()) {
      row[i] = pair[1];
      changed = true;
    }
  });
  return changed;
}

// ============================================================
//  SHEET
// ============================================================

function sponsorSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SPONSORS.SHEET_NAME);
}

/** Menu: Set Up Sponsors Sheet. Safe to re-run; keeps existing rows. */
function setupSponsorsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = sponsorSheet_();
  if (!sheet) sheet = ss.insertSheet(SPONSORS.SHEET_NAME);
  const H = SPONSORS.HEADERS;
  sheet.getRange(1, 1, 1, H.length).setValues([H])
    .setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  const list = function (header, values) {
    sheet.getRange(2, H.indexOf(header) + 1, 500, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build()
    );
  };
  list('Status', SPONSORS.STATUSES);
  list('Offer Type', SPONSORS.OFFER_TYPES);
  list('Group', SPONSORS.GROUPS);
  list('Show on Site', ['Yes', 'No']);
  list('Pubmat', SPONSORS.PUBMAT);
  ['Cash Pledged', 'Cash Received', 'Item Value (est.)'].forEach(function (h) {
    sheet.getRange(2, H.indexOf(h) + 1, 500, 1).setNumberFormat('"₱"#,##0');
  });
  sheet.autoResizeColumns(1, H.length);
  return sheet;
}

function sponsorRows_() {
  const sheet = sponsorSheet_();
  if (!sheet) return { sheet: null, data: [SPONSORS.HEADERS] };
  return { sheet: sheet, data: sheet.getDataRange().getValues() };
}

function sponsorCol_(header) {
  return SPONSORS.HEADERS.indexOf(header);
}

function sponsorNextId_(data) {
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const m = String(data[i][0] || '').match(/^SP-(\d+)$/i);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return 'SP-' + String(max + 1).padStart(3, '0');
}

/** Menu: Load SB19 Brand Partners. Adds the starter list, skipping names already present. */
function loadSponsorSeed() {
  const added = loadSponsorSeed_('Menu');
  SpreadsheetApp.getUi().alert(
    added
      ? 'Added ' + added + ' SB19 brand partners to the Sponsors tab as "Not contacted". Check each one before emailing, and add contact details as you find them.'
      : 'Nothing new to add. Every brand in the starter list is already in the Sponsors tab.'
  );
}

function loadSponsorSeed_(by) {
  const sheet = sponsorSheet_() || setupSponsorsSheet();
  const data = sheet.getDataRange().getValues();
  const have = {};
  const now = new Date();
  for (let i = 1; i < data.length; i++) {
    const name = String(data[i][1]).trim();
    have[name.toLowerCase()] = true;
    // Rows loaded before contacts were known: fill blank contact cells only.
    const row = data[i].slice();
    if (sponsorApplyContact_(row, name)) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
    }
  }
  let added = 0;
  SPONSOR_SEED.forEach(function (s) {
    if (have[s[0].toLowerCase()]) return;
    const row = new Array(SPONSORS.HEADERS.length).fill('');
    const put = function (h, v) { row[sponsorCol_(h)] = v; };
    put('Sponsor ID', sponsorNextId_(sheet.getDataRange().getValues()));
    put('Name / Brand', s[0]);
    put('Category', s[1]);
    put('SB19 Tie-in', s[2]);
    put('Group', s[3]);
    put('Offer Type', 'TBD');
    put('Cash Pledged', 0);
    put('Cash Received', 0);
    put('Item Value (est.)', 0);
    put('Status', 'Not contacted');
    put('Show on Site', 'Yes');
    put('Pubmat', 'Not started');
    put('Source', s[4]);
    sponsorApplyContact_(row, s[0]);
    put('Last Updated', now);
    put('Updated By', by);
    sheet.appendRow(row);
    added++;
  });
  return added;
}

// ============================================================
//  NUMBERS (used by computeBudget_)
// ============================================================

/** Cash totals from the Sponsors sheet. Declined rows never count. */
function sponsorTotals_() {
  const d = sponsorRows_();
  const t = { cashReceived: 0, cashPledged: 0, itemValue: 0, total: 0, confirmed: 0, byStatus: {} };
  SPONSORS.STATUSES.forEach(function (s) { t.byStatus[s] = 0; });
  for (let i = 1; i < d.data.length; i++) {
    const r = d.data[i];
    if (!r[sponsorCol_('Name / Brand')]) continue;
    const status = String(r[sponsorCol_('Status')] || 'Not contacted');
    t.total++;
    t.byStatus[status] = (t.byStatus[status] || 0) + 1;
    if (status === 'Declined') continue;
    t.cashReceived += Number(r[sponsorCol_('Cash Received')]) || 0;
    // Pledged but not yet received
    t.cashPledged += Math.max(0, (Number(r[sponsorCol_('Cash Pledged')]) || 0) - (Number(r[sponsorCol_('Cash Received')]) || 0));
    t.itemValue += Number(r[sponsorCol_('Item Value (est.)')]) || 0;
    if (status === 'Confirmed' || status === 'Received') t.confirmed++;
  }
  return t;
}

// ============================================================
//  PUBLIC (registration page strip)
// ============================================================

/** GET ?action=sponsors — names (and logo links) of confirmed sponsors only. No contact data. */
function publicSponsors_() {
  const d = sponsorRows_();
  const out = [];
  for (let i = 1; i < d.data.length; i++) {
    const r = d.data[i];
    const name = String(r[sponsorCol_('Name / Brand')] || '').trim();
    if (!name) continue;
    if (SPONSORS.PUBLIC_STATUSES.indexOf(String(r[sponsorCol_('Status')])) === -1) continue;
    if (String(r[sponsorCol_('Show on Site')]).toLowerCase() !== 'yes') continue;
    const logo = String(r[sponsorCol_('Logo URL')] || '').trim();
    out.push({ name: name, logoUrl: /^https:\/\//i.test(logo) ? logo : '' });
  }
  return { ok: true, sponsors: out };
}

// ============================================================
//  DASHBOARD (called from Dashboard.gs)
// ============================================================

function sponsorRecord_(row, staff) {
  const c = function (h) { return row[sponsorCol_(h)]; };
  const fmt = function (v) {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? String(v) : Utilities.formatDate(d, CHECKIN.TZ, 'yyyy-MM-dd');
  };
  const rec = {
    id: String(c('Sponsor ID') || ''),
    name: String(c('Name / Brand') || ''),
    category: String(c('Category') || ''),
    tieIn: String(c('SB19 Tie-in') || ''),
    group: String(c('Group') || ''),
    offerType: String(c('Offer Type') || ''),
    offerDetails: String(c('Offer Details') || ''),
    cashPledged: Number(c('Cash Pledged')) || 0,
    cashReceived: Number(c('Cash Received')) || 0,
    itemValue: Number(c('Item Value (est.)')) || 0,
    status: String(c('Status') || 'Not contacted'),
    lastContacted: fmt(c('Last Contacted')),
    showOnSite: String(c('Show on Site') || 'Yes'),
    logoUrl: String(c('Logo URL') || ''),
    pubmat: String(c('Pubmat') || 'Not started'),
    notes: String(c('Notes') || ''),
    source: String(c('Source') || ''),
    website: String(c('Website / Social') || ''),
  };
  if (staff.role === 'Admin') {
    rec.contactPerson = String(c('Contact Person') || '');
    rec.email = String(c('Email') || '');
    rec.mobile = String(c('Mobile') || '');
  }
  return rec;
}

function dashSponsorList_(staff) {
  const d = sponsorRows_();
  const rows = [];
  for (let i = 1; i < d.data.length; i++) {
    if (!d.data[i][sponsorCol_('Name / Brand')]) continue;
    rows.push(sponsorRecord_(d.data[i], staff));
  }
  return {
    ok: true,
    rows: rows,
    totals: sponsorTotals_(),
    canEdit: staff.role === 'Admin',
    options: { statuses: SPONSORS.STATUSES, offerTypes: SPONSORS.OFFER_TYPES, groups: SPONSORS.GROUPS, pubmat: SPONSORS.PUBMAT },
  };
}

function sponsorCleanValue_(field, value) {
  if (field === 'cashPledged' || field === 'cashReceived' || field === 'itemValue') {
    const n = Number(String(value == null ? '' : value).replace(/[₱,\s]/g, ''));
    if (!isFinite(n) || n < 0) throw new Error('Amounts must be zero or more.');
    return Math.round(n);
  }
  const s = String(value == null ? '' : value).trim().slice(0, SPONSORS.MAX_TEXT);
  if (field === 'status' && SPONSORS.STATUSES.indexOf(s) === -1) throw new Error('Unknown status.');
  if (field === 'offerType' && s && SPONSORS.OFFER_TYPES.indexOf(s) === -1) throw new Error('Unknown offer type.');
  if (field === 'group' && s && SPONSORS.GROUPS.indexOf(s) === -1) throw new Error('Unknown group.');
  if (field === 'pubmat' && SPONSORS.PUBMAT.indexOf(s) === -1) throw new Error('Unknown pubmat status.');
  if (field === 'showOnSite' && ['Yes', 'No'].indexOf(s) === -1) throw new Error('Show on Site must be Yes or No.');
  if (field === 'email' && s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error('That email address does not look right.');
  if (field === 'lastContacted' && s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Last contacted must be a date.');
    return new Date(s + 'T12:00:00+08:00');
  }
  if (field === 'logoUrl' && s && !/^https:\/\//i.test(s)) throw new Error('Logo link must start with https://');
  return sanitizeForSheet_(s);
}

/** Admin: add (no id) or update (id) a sponsor. Only fields sent are changed. */
function dashSponsorSave_(req, staff) {
  if (staff.role !== 'Admin') return { ok: false, code: 'FORBIDDEN', error: 'Only an admin can edit sponsors.' };
  const fields = req.fields || {};
  let clean = {};
  try {
    Object.keys(fields).forEach(function (f) {
      if (!SPONSOR_FIELDS[f]) return;
      clean[f] = sponsorCleanValue_(f, fields[f]);
    });
  } catch (err) {
    return { ok: false, code: 'BAD_REQUEST', error: err.message };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, code: 'BUSY', error: 'The system is busy. Try again in a few seconds.' };
  let id;
  try {
    const sheet = sponsorSheet_() || setupSponsorsSheet();
    const data = sheet.getDataRange().getValues();
    const now = new Date();

    // Emailing someone for the first time stamps Last Contacted for you.
    if (clean.status && ['Emailed', 'Followed up'].indexOf(clean.status) !== -1 && !('lastContacted' in clean)) {
      clean.lastContacted = now;
    }

    if (!req.id) {
      if (!clean.name) return { ok: false, code: 'BAD_REQUEST', error: 'Name / brand is required.' };
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][sponsorCol_('Name / Brand')]).trim().toLowerCase() === String(clean.name).replace(/^'/, '').toLowerCase()) {
          return { ok: false, code: 'DUPLICATE', error: clean.name + ' is already on the list (' + data[i][0] + ').' };
        }
      }
      id = sponsorNextId_(data);
      const row = new Array(SPONSORS.HEADERS.length).fill('');
      row[0] = id;
      const defaults = { status: 'Not contacted', showOnSite: 'Yes', pubmat: 'Not started', offerType: 'TBD', cashPledged: 0, cashReceived: 0, itemValue: 0 };
      Object.keys(SPONSOR_FIELDS).forEach(function (f) {
        const v = f in clean ? clean[f] : (f in defaults ? defaults[f] : '');
        row[sponsorCol_(SPONSOR_FIELDS[f])] = v;
      });
      row[sponsorCol_('Last Updated')] = now;
      row[sponsorCol_('Updated By')] = staff.name;
      sheet.appendRow(row);
    } else {
      id = String(req.id);
      let idx = -1;
      for (let i = 1; i < data.length; i++) if (String(data[i][0]) === id) { idx = i; break; }
      if (idx === -1) return { ok: false, code: 'NOT_FOUND', error: 'That sponsor could not be found.' };
      if ('name' in clean && !clean.name) return { ok: false, code: 'BAD_REQUEST', error: 'Name / brand cannot be empty.' };
      Object.keys(clean).forEach(function (f) {
        sheet.getRange(idx + 1, sponsorCol_(SPONSOR_FIELDS[f]) + 1).setValue(clean[f]);
      });
      sheet.getRange(idx + 1, sponsorCol_('Last Updated') + 1).setValue(now);
      sheet.getRange(idx + 1, sponsorCol_('Updated By') + 1).setValue(staff.name);
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  ciAudit_(staff, id, 'Sponsor', '', Object.keys(clean).join(', '), req.id ? 'Sponsor updated from dashboard' : 'Sponsor added from dashboard');
  const list = dashSponsorList_(staff);
  return {
    ok: true,
    id: id,
    record: list.rows.filter(function (r) { return r.id === id; })[0],
    totals: list.totals,
    budget: computeBudget_(dashSheetData_().data),
  };
}

/** Admin: add the researched starter list from the dashboard. */
function dashSponsorSeed_(staff) {
  if (staff.role !== 'Admin') return { ok: false, code: 'FORBIDDEN', error: 'Only an admin can load the starter list.' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, code: 'BUSY', error: 'The system is busy. Try again in a few seconds.' };
  let added;
  try {
    added = loadSponsorSeed_(staff.name);
  } finally {
    lock.releaseLock();
  }
  const list = dashSponsorList_(staff);
  list.added = added;
  return list;
}
