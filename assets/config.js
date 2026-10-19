/**
 * ============================================================
 * EVENT CONFIG — edit these values, no other file should need
 * touching for day-to-day changes (price, payment details, etc.)
 * ============================================================
 */
const EVENT_CONFIG = {
  EVENT_NAME: 'GAME TIME',
  EVENT_TAGLINE: "The Never Growing Old SSOB's Birthday Celebration",
  EVENT_DATE_DISPLAY: 'Sat, November 14, 2026 · 5:00 PM onwards',
  VENUE: 'Teaspoon Cafe',
  VENUE_ADDRESS: '5B & 6A Juan Luna Street, Gagalangin, Tondo, Manila 1013',
  VENUE_MAP_URL:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('Teaspoon Cafe, 5B & 6A Juan Luna Street, Gagalangin, Tondo, Manila'),
  ORGANIZER_NOTE:
    "Fan-organized birthday celebration by SB19 A'tin Fanboys. Not an official SB19 or management event.",

  // Fallback shown before the live backend responds. The real figure comes
  // from ?action=slots and already subtracts the guest, admin and volunteer
  // free passes added from the team dashboard.
  TOTAL_CAP: 120,

  // Individual registration: one person per form.
  MAX_TICKETS_PER_REGISTRATION: 1,

  PRICE_PER_TICKET: 549,
  CURRENCY: '₱',
  TICKET_INCLUSIONS_NOTE: 'Per head. Includes food, BBQ and freebies.',

  // Paste the /exec URL of the NEW Apps Script deployment here (see SETUP.md).
  BACKEND_URL: 'REPLACE_WITH_YOUR_APPS_SCRIPT_EXEC_URL',

  // GCash only.
  PAYMENT_CHANNELS: [
    {
      id: 'gcash',
      label: 'GCash',
      instructions: 'Send to +63 915 514 2491 (GCash) — Account Name: John Marvin Brazas',
    },
  ],

  // Max size (in MB) accepted for the payment-screenshot upload.
  MAX_SCREENSHOT_MB: 5,

  // Shown as "Questions" on the registration page. Edit freely; each item
  // is [question, answer HTML]. Keep answers short.
  FAQ: [
    [
      'How do I get to Teaspoon Cafe?',
      '<p>Teaspoon Cafe is at 5B &amp; 6A Juan Luna Street, Gagalangin, Tondo, Manila. ' +
        '<a href="https://www.google.com/maps/search/?api=1&query=Teaspoon%20Cafe%2C%205B%20%26%206A%20Juan%20Luna%20Street%2C%20Gagalangin%2C%20Tondo%2C%20Manila" target="_blank" rel="noopener">Open it in Google Maps</a>.</p>' +
        '<p><strong>By train:</strong> take LRT-1 to <strong>R. Papa</strong> or <strong>Abad Santos</strong> Station. Both have tricycles and e-trikes outside; ask for Juan Luna Street in Gagalangin. From R. Papa you can also walk, about 15 to 20 minutes.</p>' +
        '<p><strong>By Grab, Joyride or Angkas:</strong> set your drop-off to "Teaspoon Cafe Juan Luna".</p>' +
        '<p>If you are coming from far, give yourself extra time. Saturday evening traffic around Tondo can be heavy.</p>',
    ],
    [
      'Is there parking?',
      '<p>Yes, parking is free, but slots are limited and first come, first served. If you can, commute or book a ride so the slots go to those who really need them.</p>',
    ],
    [
      'What time should I arrive?',
      '<p>Doors open at 5:00 PM. We check every QR code and ID at the entrance, so coming early keeps the line short.</p>',
    ],
    [
      'What does the ₱549 include?',
      '<p>Your slot at the celebration, food at Teaspoon Cafe, BBQ, freebies, and a night with fellow A\'TIN celebrating SSOB.</p>',
    ],
    [
      'Can I register for my friends too?',
      '<p>No. Each person registers and pays on their own, because the name on each registration has to match a valid ID at the door. Send your friends the link instead.</p>',
    ],
    [
      'When do I get my entry QR code?',
      '<p>After we verify your GCash payment. You will get one email right after you register, then a second email with your QR code once your payment is confirmed. Check your spam or Promotions folder if you do not see it.</p>',
    ],
    [
      'What do I bring on the day?',
      '<p>Your entry QR code (a screenshot works) and a valid ID with the same name as your registration.</p>',
    ],
    [
      'What if there is a problem with my payment?',
      '<p>We will email you a link to fix it yourself. You have 24 hours to send the correct reference number or screenshot before your slot is given to someone else.</p>',
    ],
    [
      'Can I get a refund, or give my slot to someone else?',
      '<p>Registrations are non-refundable, but you can transfer your slot. Email us before the event with the full name of the person taking your place. They will need to bring a valid ID with that name.</p>',
    ],
    [
      'Who do I contact for questions?',
      '<p>Email <a href="mailto:sbfanboyjason@gmail.com">sbfanboyjason@gmail.com</a> and include your Registration ID if you have one.</p>',
    ],
  ],

  DPA_NOTICE_HTML: `
    <p><strong>Data Privacy Notice</strong></p>
    <p>By registering, you allow the organizers of GAME TIME: The Never Growing Old SSOB's Birthday Celebration
    to collect and process your first and last name, email address, mobile number, whether you are a fanboy or
    fangirl, your Facebook profile link, and payment
    verification details (reference number and screenshot), and on the event date a photo of your ID, solely for
    the purposes of:</p>
    <ul>
      <li>Processing and verifying your registration and payment</li>
      <li>Sending you registration status updates, your entry QR code, and event-related announcements</li>
      <li>Giving the venue the final headcount for food</li>
      <li>Validating your entry at the venue on the event date, including a photo of your valid ID taken
      by the registration team at check-in and stored privately by the organizers</li>
    </ul>
    <p>Your data will not be sold or shared with third parties outside of what is necessary to verify
    payment (e.g. your e-wallet reference) and to coordinate entry and headcount with the venue. Data is
    retained only for as long as needed to complete the event and resolve any post-event concerns, after
    which it is deleted.</p>
    <p>Under the Data Privacy Act of 2012 (RA 10173), you have the right to access, correct, or request
    deletion of your data, and to file a complaint with the National Privacy Commission. For any
    data privacy concerns, contact the organizers at sbfanboyjason@gmail.com.</p>
  `,

  TERMS_HTML: `
    <p><strong>Terms & Conditions</strong></p>
    <ul>
      <li>The registration fee is <strong>₱549 per head</strong> and includes your food, BBQ and freebies at the venue.</li>
      <li>All registrations are <strong>non-refundable</strong>, but <strong>transferable</strong> to
      another person, provided the original registrant informs the organizers before the event.</li>
      <li>Registration is only confirmed once payment has been manually verified by the organizers. Until
      then, your status remains "Pending Payment Verification."</li>
      <li>One registration is for one person. Each attendee registers and pays on their own.</li>
      <li>If a problem is found with your payment (e.g. the amount is not ₱549, or
      the reference number cannot be verified), you will be notified by email and given 24 hours to send
      corrected proof. If uncorrected after 24 hours, your reserved slot is automatically released
      to other registrants.</li>
      <li>Entry on the event date requires the QR code sent upon approval, and a valid ID matching the
      registered name (or the name of the person the ticket was transferred to, if pre-notified).</li>
      <li>The organizers reserve the right to reject a registration in cases of incomplete, fraudulent,
      or unverifiable payment information.</li>
      <li>This is an independently organized fan celebration and is not an official SB19 or management
      event.</li>
    </ul>
  `,
};
