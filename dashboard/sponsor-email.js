/**
 * Sponsor invitation template used by the dashboard's "Copy invitation"
 * and "Write in Gmail" buttons. {{BRAND}} is replaced with the sponsor's
 * name. Edit the text here; SPONSOR-EMAIL.md in the repo has the same
 * letter for reference.
 */
var SPONSOR_EMAIL = {
  SENDER_NAME: 'SB19 A\'tin Fanboys Team',
  MOBILE: '0924 110 2340',
  EMAIL: 'sbfanboyjason@gmail.com',
  MESSENGER: 'm.me/sb19atinfanboys',

  subject: 'Be a Ninang of GAME TIME, SSOB\'s birthday celebration (Nov 14)',

  body: [
    'Dear {{BRAND}} team,',
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
    'Our guests are A\'TIN fan accounts with big followings who share fan events with their audiences:',
    'Ace Agoncillo, Boy Panda, Kielskie, Rinacam, Papawolf, GentoBox, Ma Ria, MA1, 1 South and Lloyd.',
    '',
    'HOW YOU CAN BE OUR NINANG',
    'Our main request is a cash sponsorship. It goes straight to the food, venue and program for the celebration, and any amount you are comfortable with makes a real difference. We keep a record of every peso and will gladly send {{BRAND}} a short report of how your support was used after the event.',
    '',
    'If a cash sponsorship is not possible this time, we would be just as grateful for products:',
    '- Loot bag items: 125 pieces of a product, sample or promo item, so every attendee goes home with something from {{BRAND}}.',
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
    'If you would like to join, please reply by Thursday, November 5 with what {{BRAND}} can share. For products, our team will pick them up from you on or before Monday, November 9, so there is nothing for you to deliver. We are happy to answer any questions by phone or Messenger.',
    '',
    'Thank you for considering this. It would mean a lot to the A\'TIN community to celebrate Josh\'s birthday with {{BRAND}} as our Ninang.',
    '',
    'Sincerely,',
    '{{SENDER}}',
    'SB19 A\'tin Fanboys',
    'Mobile: {{MOBILE}}',
    'Email: {{EMAIL}}',
    'Messenger: {{MESSENGER}}',
    '',
    '#GAMETIME #SB19 #SSOB #ATIN #NINANG',
  ].join('\n'),

  /** Personalized subject and body for one sponsor. */
  forBrand: function (brand) {
    var b = String(brand || '').trim() || '[BRAND NAME]';
    var fill = function (t) {
      return t
        .replace(/\{\{BRAND\}\}/g, b)
        .replace(/\{\{SENDER\}\}/g, SPONSOR_EMAIL.SENDER_NAME)
        .replace(/\{\{MOBILE\}\}/g, SPONSOR_EMAIL.MOBILE)
        .replace(/\{\{EMAIL\}\}/g, SPONSOR_EMAIL.EMAIL)
        .replace(/\{\{MESSENGER\}\}/g, SPONSOR_EMAIL.MESSENGER);
    };
    return { subject: fill(SPONSOR_EMAIL.subject), body: fill(SPONSOR_EMAIL.body) };
  },
};
