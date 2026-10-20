/**
 * Sponsor invitation used by the dashboard's sponsor buttons.
 *
 * The letter is written once below and built two ways:
 *   - html: the themed GAME TIME version, with the guests' names linked.
 *     "Copy invitation" puts it on the clipboard; paste it into Gmail and
 *     the design and links come along.
 *   - body: a plain-text copy, used where rich copy is not available.
 *
 * {{BRAND}} is replaced with the sponsor's name. SPONSOR-EMAIL.md in the
 * repo has the plain-text letter for reference.
 */
var SPONSOR_EMAIL = {
  MOBILE: '0924 110 2340',
  EMAIL: 'sbfanboyjason@gmail.com',
  MESSENGER: 'https://m.me/sb19atinfanboys',
  SITE: 'https://sbfanboyjason.github.io/josh-bday-registration/',

  // Guests (big fan accounts and P-pop groups): [name, Facebook link, note].
  GUESTS: [
    ['Ace Agoncillo', 'https://www.facebook.com/ace.agoncillo'],
    ['Boy Panda', 'https://www.facebook.com/profile.php?id=100064733887177'],
    ['Kielskie', 'https://www.facebook.com/KIELSKIE.ph'],
    ['Rinacam', 'https://www.facebook.com/profile.php?id=61577886231195'],
    ['Papawolf', 'https://www.facebook.com/PAPAmoWOLF'],
    ['GentoBox', 'https://www.facebook.com/Gentobox01'],
    ['Ma Ria', 'https://www.facebook.com/Aimyat1995'],
    ['MA1', 'https://www.facebook.com/profile.php?id=61577758042157', 'P-pop group'],
    ['One South', 'https://www.facebook.com/onesouth24', 'P-pop group'],
  ],

  subject: 'Be a Ninang of GAME TIME, SSOB\'s birthday celebration (Nov 14)',

  greeting: 'Dear Ninang {{BRAND}},',

  intro: [
    'Hi! We are SB19 A\'tin Fanboys, a community of SB19 supporters. We would love to have {{BRAND}} as one of the Ninangs of GAME TIME: The Never Growing Old SSOB\'s Birthday Celebration, a fan-organized party for Josh of SB19.',
    'A\'TIN are loyal to the brands that support SB19. Being a Ninang puts {{BRAND}} in front of 125 of the most active fans in one room, plus everyone who follows the event online.',
  ],

  details: [
    ['Event', 'GAME TIME: The Never Growing Old SSOB\'s Birthday Celebration'],
    ['Date', 'Saturday, November 14, 2026, 5:00 PM onwards'],
    ['Venue', 'Teaspoon Cafe, 5B & 6A Juan Luna Street, Gagalangin, Tondo, Manila'],
    ['Attendees', '125 A\'TIN and BBQs, fanboys and fangirls'],
    ['Organizer', 'SB19 A\'tin Fanboys'],
  ],

  guestsIntro: 'These A\'TIN fan accounts with big followings will be with us and share the celebration with their audiences. Joining them are the P-pop groups MA1 and One South, who are SB19 fanboys themselves. Tap a name to open their Facebook page, and we are happy to connect you with any of them if you would like to ask them directly.',
  guestsIntroPlain: 'These A\'TIN fan accounts with big followings will be with us and share the celebration with their audiences. Joining them are the P-pop groups MA1 and One South, who are SB19 fanboys themselves. Their Facebook pages are linked below so you can check them, and we are happy to connect you with any of them if you would like to ask them directly.',

  askIntro: 'Our main request is a cash sponsorship. It goes straight to the food, venue and program for the celebration, and any amount you are comfortable with makes a real difference. We keep a record of every peso and will gladly send {{BRAND}} a short report of how your support was used after the event.',
  productsIntro: 'If a cash sponsorship is not possible this time, we would be just as grateful for products:',
  products: [
    ['Loot bag items', '125 or more pieces of a product, sample or promo item, so every attendee goes home with something from {{BRAND}}.'],
    ['Prizes', 'a few items we can give away during the games and raffles. The theme is GAME TIME, so the prize rounds are a highlight of the program.'],
  ],
  mix: 'A mix of cash and products is also very welcome.',

  benefits: [
    'A "Thank you, Ninang" pubmat on our page, with your logo and your page tagged.',
    'Your name or logo on the event registration page, which every attendee opens.',
    'Shout-outs during the program, and photos of fans with your items, which we will send you after the event.',
    'Your brand in front of fans who make a point of supporting SB19\'s partner brands.',
  ],

  nextStep: 'If you would like to join, we would appreciate hearing from you at your earliest convenience, so we can include {{BRAND}} in our pubmats and program. For products, you are welcome to deliver them to us, or our team can pick them up from you, whichever works best for you. We are happy to answer any questions by phone, email or Messenger.',

  thanks: 'Thank you for considering this. It would mean a lot to the A\'TIN community to celebrate Josh\'s birthday with {{BRAND}} as our Ninang.',

  /** Plain-text letter. */
  plain: function () {
    var S = SPONSOR_EMAIL;
    var L = [S.greeting, ''];
    S.intro.forEach(function (p) { L.push(p, ''); });
    L.push('EVENT DETAILS');
    S.details.forEach(function (d) { L.push(d[0] + ': ' + d[1]); });
    L.push('', 'OUR GUESTS', S.guestsIntroPlain);
    S.GUESTS.forEach(function (g) { L.push('- ' + g[0] + (g[2] ? ' (' + g[2] + ')' : '') + (g[1] ? ': ' + g[1] : '')); });
    L.push('', 'HOW YOU CAN BE OUR NINANG', S.askIntro, '', S.productsIntro);
    S.products.forEach(function (p) { L.push('- ' + p[0] + ': ' + p[1]); });
    L.push('', S.mix, '', 'WHAT YOU GET AS OUR NINANG');
    S.benefits.forEach(function (b) { L.push('- ' + b); });
    L.push('', 'NEXT STEP', S.nextStep, '', S.thanks, '',
      'Sincerely,', 'SB19 A\'tin Fanboys', 'Mobile: ' + S.MOBILE, 'Email: ' + S.EMAIL, 'Messenger: ' + S.MESSENGER);
    return L.join('\n');
  },

  /** Themed letter. Inline styles and tables only, so it survives pasting into Gmail. */
  html: function () {
    var S = SPONSOR_EMAIL;
    var esc = function (t) {
      return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };
    var FONT = 'font-family:Arial,Helvetica,sans-serif;';
    var P = 'margin:0 0 14px;' + FONT + 'font-size:15px;line-height:1.6;color:#ffe9f2;';
    var H = function (t) {
      return '<p style="margin:26px 0 10px;' + FONT + 'font-size:13px;font-weight:bold;letter-spacing:2px;color:#ff6fae;">' + esc(t) + '</p>';
    };
    var box = function (inner) {
      return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#22091a" ' +
        'style="background:#22091a;border:1px solid #5a1f3e;border-radius:10px;"><tr><td style="padding:16px 20px;">' + inner + '</td></tr></table>';
    };
    var bullets = function (items) {
      return items.map(function (t) {
        return '<p style="margin:0 0 8px;' + FONT + 'font-size:15px;line-height:1.55;color:#ffe9f2;">' +
          '<span style="color:#ff6fae;">&#9654;</span>&nbsp; ' + t + '</p>';
      }).join('');
    };
    var details = S.details.map(function (d) {
      return '<tr><td valign="top" style="padding:5px 14px 5px 0;' + FONT + 'font-size:14px;font-weight:bold;color:#ff6fae;white-space:nowrap;">' + esc(d[0]) +
        '</td><td style="padding:5px 0;' + FONT + 'font-size:14px;color:#ffe9f2;">' + esc(d[1]) + '</td></tr>';
    }).join('');
    var guests = S.GUESTS.map(function (g) {
      var name = g[1]
        ? '<a href="' + esc(g[1]) + '" style="color:#ff6fae;font-weight:bold;text-decoration:underline;">' + esc(g[0]) + '</a>'
        : '<strong>' + esc(g[0]) + '</strong>';
      return name + (g[2] ? ' <span style="color:#ffc6de;">(' + esc(g[2]) + ')</span>' : '');
    });
    var link = function (href, text) { return '<a href="' + esc(href) + '" style="color:#ff6fae;">' + esc(text) + '</a>'; };

    return '' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0e0409" style="background:#0e0409;">' +
      '<tr><td align="center" style="padding:24px 12px;">' +
      '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#170611" ' +
      'style="width:600px;max-width:100%;background:#170611;border:1px solid #5a1f3e;border-radius:14px;">' +
      '<tr><td align="center" bgcolor="#1c0714" style="padding:26px 24px 18px;background:#1c0714;border-radius:14px 14px 0 0;">' +
      '<img src="' + S.SITE + 'assets/logo.png" width="64" height="64" alt="SB19 A\'tin Fanboys" style="display:block;border:0;margin:0 auto 10px;">' +
      '<p style="margin:0;font-family:\'Courier New\',monospace;font-size:30px;font-weight:bold;letter-spacing:8px;color:#ffc6de;">GAME TIME</p>' +
      '<p style="margin:6px 0 14px;' + FONT + 'font-size:11px;letter-spacing:3px;color:#c99ab0;">THE NEVER GROWING OLD SSOB\'S BIRTHDAY CELEBRATION</p>' +
      '<span style="display:inline-block;background:#ff4f9a;color:#0e0409;' + FONT + 'font-size:11px;font-weight:bold;letter-spacing:2px;padding:6px 14px;border-radius:999px;">NINANG INVITATION</span>' +
      '</td></tr>' +
      '<tr><td style="padding:0;"><img src="' + S.SITE + 'assets/hero.jpg" width="600" alt="GAME TIME: The Never Growing Old SSOB\'s Birthday Celebration, 14.11.2026" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>' +
      '<tr><td style="padding:28px 30px 8px;">' +
      '<p style="' + P + '">' + esc(S.greeting) + '</p>' +
      S.intro.map(function (p) { return '<p style="' + P + '">' + esc(p) + '</p>'; }).join('') +
      H('EVENT DETAILS') +
      box('<table role="presentation" cellpadding="0" cellspacing="0" border="0">' + details + '</table>') +
      H('OUR GUESTS') +
      '<p style="' + P + '">' + esc(S.guestsIntro) + '</p>' +
      box(bullets(guests)) +
      H('HOW YOU CAN BE OUR NINANG') +
      '<p style="' + P + '">' + esc(S.askIntro) + '</p>' +
      '<p style="' + P + '">' + esc(S.productsIntro) + '</p>' +
      box(bullets(S.products.map(function (p) { return '<strong style="color:#ffc6de;">' + esc(p[0]) + ':</strong> ' + esc(p[1]); }))) +
      '<p style="' + P + 'margin-top:14px;">' + esc(S.mix) + '</p>' +
      H('WHAT YOU GET AS OUR NINANG') +
      box(bullets(S.benefits.map(esc))) +
      H('NEXT STEP') +
      '<p style="' + P + '">' + esc(S.nextStep) + '</p>' +
      '<p style="' + P + '">' + esc(S.thanks) + '</p>' +
      '<p style="' + P + 'margin-top:22px;">Sincerely,<br><strong style="color:#ffc6de;">SB19 A\'tin Fanboys</strong><br>' +
      'Mobile: ' + esc(S.MOBILE) + '<br>' +
      'Email: ' + link('mailto:' + S.EMAIL, S.EMAIL) + '<br>' +
      'Messenger: ' + link(S.MESSENGER, S.MESSENGER.replace('https://', '')) + '</p>' +
      '</td></tr>' +
      '<tr><td align="center" style="padding:16px 24px 24px;border-top:1px solid #3d1530;' + FONT + 'font-size:12px;line-height:1.7;color:#c99ab0;">' +
      '<strong style="color:#ff6fae;">Saturday, November 14, 2026, 5:00 PM onwards</strong> &middot; Teaspoon Cafe<br>' +
      'Fan-organized by SB19 A\'tin Fanboys. Not an official SB19 or management event.' +
      '</td></tr>' +
      '</table></td></tr></table>';
  },

  /** Personalized subject, plain body and themed html for one sponsor. */
  forBrand: function (brand) {
    var b = String(brand || '').trim() || '[BRAND NAME]';
    var escB = b.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return {
      subject: SPONSOR_EMAIL.subject.replace(/\{\{BRAND\}\}/g, b),
      body: SPONSOR_EMAIL.plain().replace(/\{\{BRAND\}\}/g, b),
      html: SPONSOR_EMAIL.html().replace(/\{\{BRAND\}\}/g, escB),
    };
  },
};
