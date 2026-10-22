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
    'Facebook Page', // added later, so it sits at the end and older columns keep their letters
    // Filled by the Brand Ninang page (/brand-ninang/), also kept at the end.
    'Pledged Via',
    'Contact Position',
    'Payment Method',
    'GCash Reference',
    'Payment Screenshot',
    'Item Handover',
    'Pickup Address / Notes',
  ],
  STATUSES: ['Not contacted', 'Emailed', 'Messaged', 'Followed up', 'Replied', 'Confirmed', 'Received', 'Declined', 'No reply'],
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
    'Brand Ninang page',
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
  facebook: 'Facebook Page',
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
  ['Pasalubong ng Bayan', 'Food gifts', "Dunkin' campaign \"Pasalubong ng Bayan x SB19\" (Feb 2021), not a separate company", 'SB19 past partner', 'https://www.facebook.com/dunkin.ph/videos/pasalubong-ng-bayan-x-sb19-dunkin-theme-song-full-mv/110446104248194/'],
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

/**
 * Official Facebook pages, found October 22, 2026 by search (each is the
 * brand's own page, not a branch or fan page). Use these to message brands
 * with no public email. Messenger opens at m.me/<page>. Some brands (GCash,
 * for example) say they do not answer page messages about support, but a
 * sponsorship message to the page still reaches their social media team.
 */
const SPONSOR_FACEBOOK = {
  'REDMI / Xiaomi Philippines': 'https://www.facebook.com/XiaomiPhilippines',
  'Canva Philippines': 'https://www.facebook.com/CanvaPhilippines',
  'Sony Philippines': 'https://www.facebook.com/SonyPhilippines',
  'AIA Philippines': 'https://www.facebook.com/AIAPhilippines',
  'GCash': 'https://www.facebook.com/gcashofficial',
  'Puregold': 'https://www.facebook.com/Puregold.Mobile',
  'Acer Philippines': 'https://www.facebook.com/AcerPH',
  'IKEA Philippines': 'https://www.facebook.com/IKEAPhilippinesOfficial',
  'Avignon Clinic': 'https://www.facebook.com/avignonclinic',
  "Dunkin' Philippines": 'https://www.facebook.com/dunkin.ph',
  'Pasalubong ng Bayan': 'https://www.facebook.com/dunkin.ph',
  'Lazada Philippines': 'https://www.facebook.com/LazadaPhilippines',
  'TM (Globe)': 'https://www.facebook.com/TMtambayan',
  'Datu Puti': 'https://www.facebook.com/DatuPuti',
  'Timezone Philippines': 'https://www.facebook.com/ilovetimezone',
  'Fino Premium Touch': 'https://www.facebook.com/fino.philippines',
  'Lunari Global': 'https://www.facebook.com/lunariglobal',
  'Department of Tourism': 'https://www.facebook.com/DepartmentOfTourism',
  'Sony Music Philippines': 'https://www.facebook.com/sonymusicphilippines',
  'Universal Music Philippines': 'https://www.facebook.com/UMGPhilippines',
  'Warner Chappell Music': 'https://www.facebook.com/wcmasiapac',
};

/** How to reach brands with no public email, shown in Contact Person when it is blank. */
const SPONSOR_NO_EMAIL_NOTE = {
  'Puregold': 'No public marketing email. Message the Puregold Mobile page, which Puregold calls its official Facebook page',
  'Pasalubong ng Bayan': "This was Dunkin' Philippines' SB19 campaign. Contact Dunkin' instead",
  'KFC Philippines': 'No public marketing email, and no Facebook link could be confirmed. Search "KFC Philippines" on Facebook and use the page with the blue check',
  'Believe': 'No public email or Philippine Facebook page found. Use the contact form on believe.com',
  'United Talent Agency (UTA)': 'No public email or Facebook page found. Use the contact page on unitedtalent.com',
  'Sony Music Publishing': 'No public email or Philippine Facebook page found',
};

/** Fills Email / Contact Person / Website / Facebook Page on a row if they are blank. */
function sponsorApplyContact_(row, name) {
  const c = SPONSOR_CONTACTS[name] || ['', '', ''];
  const fb = SPONSOR_FACEBOOK[name] || '';
  const person = c[1] || SPONSOR_NO_EMAIL_NOTE[name] || (fb && !c[0] ? 'No public email. Message their Facebook page' : '');
  while (row.length < SPONSORS.HEADERS.length) row.push('');
  let changed = false;
  [['Email', c[0]], ['Contact Person', person], ['Website / Social', c[2]], ['Facebook Page', fb]].forEach(function (pair) {
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
  // Older sheets do not have the Facebook Page column yet: add the header.
  const lastCol = sheet.getLastColumn();
  if (lastCol < SPONSORS.HEADERS.length) {
    sheet.getRange(1, 1, 1, SPONSORS.HEADERS.length).setValues([SPONSORS.HEADERS])
      .setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
  }
  const data = sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), SPONSORS.HEADERS.length).getValues();
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
    facebook: String(c('Facebook Page') || ''),
    pledgedVia: String(c('Pledged Via') || ''),
    paymentMethod: String(c('Payment Method') || ''),
    handover: String(c('Item Handover') || ''),
  };
  if (staff.role === 'Admin') {
    rec.contactPerson = String(c('Contact Person') || '');
    rec.email = String(c('Email') || '');
    rec.mobile = String(c('Mobile') || '');
    rec.position = String(c('Contact Position') || '');
    rec.reference = String(c('GCash Reference') || '');
    rec.screenshot = String(c('Payment Screenshot') || '');
    rec.pickupNotes = String(c('Pickup Address / Notes') || '');
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
  if (field === 'facebook' && s) {
    const fb = normalizeFacebook_(s);
    if (!fb) throw new Error('Facebook page must be a facebook.com link, e.g. facebook.com/DatuPuti');
    return fb;
  }
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
    if (clean.status && ['Emailed', 'Messaged', 'Followed up'].indexOf(clean.status) !== -1 && !('lastContacted' in clean)) {
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

// ============================================================
//  BRAND NINANG PAGE (/brand-ninang/)
// ============================================================
//  A brand pledges cash, products or both on the public page. The pledge
//  lands in the Sponsors tab: on the brand's existing row if the name
//  matches (e.g. a brand we already emailed), or as a new row in the
//  "Brand Ninang page" group. Status becomes Replied so the team can check
//  it and set Confirmed. Nothing shows publicly until the team does that.

const BRAND_NINANG = {
  GIVING: ['Cash', 'Products', 'Cash and products'],
  PAYMENT: ['GCash now', 'Coordinate with the team'],
  HANDOVER: ['We will deliver', 'Please pick up'],
  MAX_LOGO_MB: 5,
};

function brandMoney_(v) {
  const s = String(v == null ? '' : v).replace(/[₱,\s]/g, '').replace(/^php/i, '');
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
}

function brandClean_(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || SPONSORS.MAX_TEXT);
}

/** Returns an error message or null. Cleans the payload in place. */
function validateBrandNinang_(p) {
  if (!p) return 'Missing submission data.';
  if (p[HONEYPOT_FIELD]) return 'Submission blocked.';
  p.brand = brandClean_(p.brand, 100);
  if (!p.brand) return 'Please enter your brand or company name.';
  p.contactName = brandClean_(p.contactName, 100);
  if (!p.contactName) return 'Please enter the name of the contact person.';
  p.position = brandClean_(p.position, 100);
  p.email = brandClean_(p.email, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return 'A valid email address is required.';
  p.phone = String(p.phone || '').replace(/[\s\-()]/g, '');
  if (!/^(\+?63|0)\d{9,10}$/.test(p.phone)) return 'Please enter a Philippine mobile or landline number, e.g. 09171234567.';
  p.page = brandClean_(p.page, 300);
  if (p.page && !/^https?:\/\//i.test(p.page)) p.page = 'https://' + p.page;
  if (BRAND_NINANG.GIVING.indexOf(p.giving) === -1) return 'Please choose what you would like to give: cash, products, or both.';
  const cash = p.giving !== 'Products';
  const products = p.giving !== 'Cash';
  if (cash) {
    p.cashAmount = brandMoney_(p.cashAmount);
    if (!(p.cashAmount > 0)) return 'Please enter the cash amount you are pledging.';
    if (BRAND_NINANG.PAYMENT.indexOf(p.paymentMethod) === -1) return 'Please choose how you will send the cash.';
    if (p.paymentMethod === 'GCash now') {
      p.paymentReference = brandClean_(p.paymentReference, 60);
      if (!p.paymentReference) return 'Please enter the GCash reference number.';
      if (!p.paymentScreenshotBase64) return 'Please upload a screenshot of the GCash payment.';
    } else {
      p.paymentReference = '';
      p.paymentScreenshotBase64 = '';
    }
  } else {
    p.cashAmount = 0;
    p.paymentMethod = '';
    p.paymentReference = '';
    p.paymentScreenshotBase64 = '';
  }
  if (products) {
    p.products = brandClean_(p.products);
    if (!p.products) return 'Please tell us what products you would like to give.';
    p.productQuantity = brandClean_(p.productQuantity, 60);
    p.productValue = p.productValue === '' || p.productValue == null ? 0 : brandMoney_(p.productValue);
    if (!(p.productValue >= 0)) return 'Please enter the estimated value as a number, or leave it blank.';
    if (BRAND_NINANG.HANDOVER.indexOf(p.handover) === -1) return 'Please choose whether you will deliver the products or want us to pick them up.';
    p.pickupNotes = brandClean_(p.pickupNotes);
    if (p.handover === 'Please pick up' && !p.pickupNotes) return 'Please give the pickup address and a good time to pick up.';
  } else {
    p.products = '';
    p.productQuantity = '';
    p.productValue = 0;
    p.handover = '';
    p.pickupNotes = '';
  }
  p.showOnSite = p.showOnSite === 'No' ? 'No' : 'Yes';
  p.message = brandClean_(p.message);
  if (!p.dpaConsent) return 'Please agree to the Data Privacy notice first.';
  return null;
}

/** Saves an uploaded logo to Drive and returns a link that works in <img>. */
function saveBrandLogo_(base64, filename, brand) {
  if (!base64) return '';
  const folder = getOrCreateDriveFolder();
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), guessContentType(filename),
    'LOGO_' + String(brand).replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40) + '_' + (filename || 'logo.png'));
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w600';
}

/** POST ?action=brandNinang */
function handleBrandNinang_(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    let p;
    try { p = JSON.parse(e.postData.contents); } catch (err) { return jsonResponse({ ok: false, error: 'Malformed request.' }); }
    const error = validateBrandNinang_(p);
    if (error) return jsonResponse({ ok: false, error: error });
    if (!getSwitch_('Brand Ninang Pledges Open')) {
      return jsonResponse({ ok: false, error: 'Brand Ninang pledges are closed. For questions, email ' + CONFIG.ORGANIZER_CONTACT_EMAIL + '.' });
    }

    let sheet = sponsorSheet_();
    if (!sheet) sheet = setupSponsorsSheet();
    if (sheet.getLastColumn() < SPONSORS.HEADERS.length) {
      sheet.getRange(1, 1, 1, SPONSORS.HEADERS.length).setValues([SPONSORS.HEADERS])
        .setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
    }
    const data = sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), SPONSORS.HEADERS.length).getValues();
    const now = new Date();
    const stamp = Utilities.formatDate(now, 'Asia/Manila', 'MMM d, h:mm a');
    const key = p.brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    let idx = -1;
    for (let i = 1; i < data.length; i++) {
      const n = String(data[i][sponsorCol_('Name / Brand')] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (n && (n === key || n.indexOf(key) === 0 && key.length >= 4 || key.indexOf(n) === 0 && n.length >= 4)) { idx = i; break; }
    }
    const row = idx === -1 ? SPONSORS.HEADERS.map(function () { return ''; }) : data[idx].slice();
    const id = idx === -1 ? sponsorNextId_(data) : String(row[sponsorCol_('Sponsor ID')]);
    const notes = [];

    let shot = '';
    if (p.paymentScreenshotBase64) {
      try { shot = saveScreenshotToDrive(p.paymentScreenshotBase64, p.paymentScreenshotFilename, id); }
      catch (err) { notes.push('Payment screenshot upload failed; ask for it again.'); }
    }
    let logo = '';
    if (p.logoBase64) {
      try { logo = saveBrandLogo_(p.logoBase64, p.logoFilename, p.brand); }
      catch (err) { notes.push('Logo upload failed; ask for it by email.'); }
    }

    const set = function (h, v) { row[sponsorCol_(h)] = typeof v === 'string' ? sanitizeForSheet_(v) : v; };
    const setIfBlank = function (h, v) { if (v !== '' && !String(row[sponsorCol_(h)] || '').trim()) set(h, v); };
    if (idx === -1) {
      set('Sponsor ID', id);
      set('Name / Brand', p.brand);
      set('Group', 'Brand Ninang page');
      set('Cash Received', 0);
      set('Pubmat', 'Not started');
      set('Source', 'Brand Ninang page');
    }
    set('Contact Person', p.contactName);
    set('Contact Position', p.position);
    set('Email', p.email);
    set('Mobile', p.phone);
    if (/facebook\.com|fb\.com/i.test(p.page)) setIfBlank('Facebook Page', normalizeFacebook_(p.page) || p.page);
    else setIfBlank('Website / Social', p.page);
    set('Offer Type', p.giving === 'Cash' ? 'Cash' : p.giving === 'Products' ? 'Products' : 'Mixed');
    set('Offer Details', [p.products, p.productQuantity ? '(' + p.productQuantity + ')' : ''].filter(Boolean).join(' '));
    set('Cash Pledged', p.cashAmount || 0);
    set('Item Value (est.)', p.productValue || 0);
    const st = String(row[sponsorCol_('Status')] || '');
    if (['', 'Not contacted', 'Emailed', 'Messaged', 'Followed up', 'No reply', 'Declined'].indexOf(st) !== -1) set('Status', 'Replied');
    set('Show on Site', p.showOnSite);
    if (logo) set('Logo URL', logo);
    set('Pledged Via', 'Brand Ninang page, ' + stamp);
    set('Payment Method', p.paymentMethod);
    set('GCash Reference', p.paymentReference);
    if (shot) set('Payment Screenshot', shot);
    set('Item Handover', p.handover);
    set('Pickup Address / Notes', p.pickupNotes);
    const prevNotes = String(row[sponsorCol_('Notes')] || '');
    const newNote = ['[' + stamp + '] Pledged on the Brand Ninang page.', p.message ? 'Message: ' + p.message : '', notes.join(' ')].filter(Boolean).join(' ');
    set('Notes', (prevNotes ? prevNotes + ' ' : '') + newNote);
    set('Last Updated', now);
    set('Updated By', 'Brand Ninang page');
    if (idx === -1) sheet.appendRow(row);
    else sheet.getRange(idx + 1, 1, 1, row.length).setValues([row]);

    try {
      if (mailQuotaLeft_() > CONFIG.QUOTA_RESERVE_FOR_QR) {
        sendBrandPledgeEmail_(p, id);
        sendBrandPledgeTeamAlert_(p, id);
      }
    } catch (err) {
      console.error('brand pledge email: ' + err.message);
    }
    return jsonResponse({ ok: true, sponsorId: id });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Server error: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

function brandPledgeRows_(p, id) {
  let rows = infoRow_('Reference', '<strong>' + escapeHtml_(id) + '</strong>') +
    infoRow_('Brand', escapeHtml_(p.brand)) +
    infoRow_('Contact', escapeHtml_(p.contactName + (p.position ? ', ' + p.position : '')));
  if (p.cashAmount) {
    rows += infoRow_('Cash', escapeHtml_(CONFIG.CURRENCY + Number(p.cashAmount).toLocaleString('en-US')) +
      (p.paymentMethod === 'GCash now' ? ' via GCash (Ref. ' + escapeHtml_(p.paymentReference) + ')' : ', to coordinate with the team'));
  }
  if (p.products) {
    rows += infoRow_('Products', escapeHtml_(p.products + (p.productQuantity ? ' (' + p.productQuantity + ')' : ''))) +
      infoRow_('Handover', escapeHtml_(p.handover));
  }
  return rows;
}

function sendBrandPledgeEmail_(p, id) {
  const next = [];
  if (p.cashAmount && p.paymentMethod === 'GCash now') next.push('Our team checks your GCash payment against the reference number above.');
  if (p.cashAmount && p.paymentMethod !== 'GCash now') next.push('We will reach out to arrange the cash sponsorship with you.');
  if (p.products) next.push(p.handover === 'Please pick up' ? 'We will contact you to set a pickup time for the products.' : 'We will send you where and when to drop off the products.');
  next.push('Once everything is confirmed, we post your "Thank you, Ninang" pubmat' + (p.showOnSite === 'Yes' ? ' and add your logo to our registration page.' : '.'));
  const bodyHtml =
    '<p>Hi ' + escapeHtml_(p.contactName.split(' ')[0]) + ',</p>' +
    '<p>Thank you for being a Ninang of GAME TIME! 💖 We are so happy to have <strong>' + escapeHtml_(p.brand) +
    '</strong> with us for SSOB\'s birthday celebration. Here is a copy of your pledge:</p>' +
    infoBox_(brandPledgeRows_(p, id)) +
    '<p><strong>What happens next</strong></p>' + stepsHtml_(next) +
    '<p>For anything else, reply to <strong>' + CONFIG.ORGANIZER_CONTACT_EMAIL + '</strong> or message us at m.me/sb19atinfanboys.</p>' +
    '<p>Salamat po, Ninang!<br>SB19 A\'tin Fanboys</p>';
  const shell = buildEmailShell_({ pillLabel: 'Ninang Pledge Received', pillColor: '#ff6fae', pillTextColor: '#0a0a0a', bodyHtml: bodyHtml });
  MailApp.sendEmail({
    to: p.email,
    replyTo: CONFIG.ORGANIZER_CONTACT_EMAIL,
    subject: '[GAME TIME] Thank you, Ninang ' + p.brand + '! We got your pledge',
    htmlBody: shell.html,
    body: 'Hi ' + p.contactName + ',\n\nThank you for being a Ninang of GAME TIME! We got the pledge from ' + p.brand + ' (' + id + ') and will be in touch.\n\nSB19 A\'tin Fanboys',
    name: 'SB19 A\'tin Fanboys',
    inlineImages: shell.inlineImages,
  });
}

/** A short heads-up to the team inbox, so new brand pledges are not missed. */
function sendBrandPledgeTeamAlert_(p, id) {
  MailApp.sendEmail({
    to: CONFIG.ORGANIZER_CONTACT_EMAIL,
    subject: '[GAME TIME] New brand Ninang pledge: ' + p.brand,
    body: p.brand + ' pledged on the Brand Ninang page (' + id + ').\n\n' +
      'Contact: ' + p.contactName + (p.position ? ', ' + p.position : '') + '\n' + p.email + ' · ' + p.phone + '\n' +
      (p.cashAmount ? 'Cash: ' + CONFIG.CURRENCY + p.cashAmount + ' (' + p.paymentMethod + (p.paymentReference ? ', Ref ' + p.paymentReference : '') + ')\n' : '') +
      (p.products ? 'Products: ' + p.products + (p.productQuantity ? ' (' + p.productQuantity + ')' : '') + ' · ' + p.handover + (p.pickupNotes ? ': ' + p.pickupNotes : '') + '\n' : '') +
      (p.message ? 'Message: ' + p.message + '\n' : '') +
      '\nCheck it in the Sponsors tab of the dashboard, then set the status to Confirmed.',
    name: 'GAME TIME system',
  });
}

