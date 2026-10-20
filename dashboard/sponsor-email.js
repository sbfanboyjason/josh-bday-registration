/**
 * Sponsor invitation template used by the dashboard's "Copy invitation"
 * and "Write in Gmail" buttons. {{BRAND}} is replaced with the sponsor's
 * name and {{GUESTS}} with the guest list below. Edit the text here;
 * SPONSOR-EMAIL.md in the repo has the same letter for reference.
 */
var SPONSOR_EMAIL = {
  MOBILE: '0924 110 2340',
  EMAIL: 'sbfanboyjason@gmail.com',
  MESSENGER: 'https://m.me/sb19atinfanboys',

  // Big fan accounts attending as guests: [name, Facebook link].
  // Leave the link empty ('') and the name is listed without one.
  GUESTS: [
    ['Ace Agoncillo', ''],
    ['Boy Panda', ''],
    ['Kielskie', ''],
    ['Rinacam', ''],
    ['Papawolf', ''],
    ['GentoBox', ''],
    ['Ma Ria', ''],
    ['MA1', ''],
    ['1 South', ''],
    ['Lloyd', ''],
  ],

  subject: 'Be a Ninang of GAME TIME, SSOB\'s birthday celebration (Nov 14)',

  body: [
    'Dear Ninang {{BRAND}},',
    '',
    'Hi! We are SB19 A\'tin Fanboys, a community of SB19 supporters. We would love to have {{BRAND}} as one of the Ninangs of GAME TIME: The Never Growing Old SSOB\'s Birthday Celebration, a fan-organized party for Josh of SB19.',
    '',
    'A\'TIN are loyal to the brands that support SB19. Being a Ninang puts {{BRAND}} in front of 125 of the most active fans in one room, plus everyone who follows the event online.',
    '',
    'EVENT DETAILS',
    'Event: GAME TIME: The Never Growing Old SSOB\'s Birthday Celebration',
    'Date: Saturday, November 14, 2026, 5:00 PM onwards',
    'Venue: Teaspoon Cafe, 5B & 6A Juan Luna Street, Gagalangin, Tondo, Manila',
    'Attendees: 125 A\'TIN and BBQs, fanboys and fangirls',
    'Organizer: SB19 A\'tin Fanboys',
    '',
    'OUR GUESTS',
    'These A\'TIN fan accounts with big followings will be with us and share the celebration with their audiences. Their Facebook pages are linked below so you can check them, and we are happy to connect you with any of them if you would like to ask them directly.',
    '{{GUESTS}}',
    '',
    'HOW YOU CAN BE OUR NINANG',
    'Our main request is a cash sponsorship. It goes straight to the food, venue and program for the celebration, and any amount you are comfortable with makes a real difference. We keep a record of every peso and will gladly send {{BRAND}} a short report of how your support was used after the event.',
    '',
    'If a cash sponsorship is not possible this time, we would be just as grateful for products:',
    '- Loot bag items: 125 or more pieces of a product, sample or promo item, so every attendee goes home with something from {{BRAND}}.',
    '- Prizes: a few items we can give away during the games and raffles. The theme is GAME TIME, so the prize rounds are a highlight of the program.',
    '',
    'A mix of cash and products is also very welcome.',
    '',
    'WHAT YOU GET AS OUR NINANG',
    '- A "Thank you, Ninang" pubmat on our page, with your logo and your page tagged.',
    '- Your name or logo on the event registration page, which every attendee opens.',
    '- Shout-outs during the program, and photos of fans with your items, which we will send you after the event.',
    '- Your brand in front of fans who make a point of supporting SB19\'s partner brands.',
    '',
    'NEXT STEP',
    'If you would like to join, we would appreciate hearing from you at your earliest convenience, so we can include {{BRAND}} in our pubmats and program. For products, you are welcome to deliver them to us, or our team can pick them up from you, whichever works best for you. We are happy to answer any questions by phone, email or Messenger.',
    '',
    'Thank you for considering this. It would mean a lot to the A\'TIN community to celebrate Josh\'s birthday with {{BRAND}} as our Ninang.',
    '',
    'Sincerely,',
    'SB19 A\'tin Fanboys',
    'Mobile: {{MOBILE}}',
    'Email: {{EMAIL}}',
    'Messenger: {{MESSENGER}}',
  ].join('\n'),

  /** The guest list, one per line, with the Facebook link when there is one. */
  guestLines: function () {
    return SPONSOR_EMAIL.GUESTS.map(function (g) {
      return '- ' + g[0] + (g[1] ? ': ' + g[1] : '');
    }).join('\n');
  },

  /** Personalized subject and body for one sponsor. */
  forBrand: function (brand) {
    var b = String(brand || '').trim() || '[BRAND NAME]';
    var fill = function (t) {
      return t
        .replace(/\{\{GUESTS\}\}/g, SPONSOR_EMAIL.guestLines())
        .replace(/\{\{BRAND\}\}/g, b)
        .replace(/\{\{MOBILE\}\}/g, SPONSOR_EMAIL.MOBILE)
        .replace(/\{\{EMAIL\}\}/g, SPONSOR_EMAIL.EMAIL)
        .replace(/\{\{MESSENGER\}\}/g, SPONSOR_EMAIL.MESSENGER);
    };
    return { subject: fill(SPONSOR_EMAIL.subject), body: fill(SPONSOR_EMAIL.body) };
  },
};
