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
  ORGANIZER_NOTE:
    "Fan-organized birthday celebration by SB19 A'tin Fanboys. Not an official SB19 or management event.",

  // Fallback shown before the live backend responds. The real figure comes
  // from ?action=slots and already subtracts the guest, admin and volunteer
  // free passes added from the team dashboard.
  TOTAL_CAP: 100,

  MAX_TICKETS_PER_REGISTRATION: 10,

  PRICE_PER_TICKET: 549,
  CURRENCY: '₱',
  TICKET_INCLUSIONS_NOTE: 'Per head, food at Teaspoon Cafe included.',

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

  DPA_NOTICE_HTML: `
    <p><strong>Data Privacy Notice</strong></p>
    <p>By registering, you allow the organizers of GAME TIME: The Never Growing Old SSOB's Birthday Celebration
    to collect and process your first and last name, email address, mobile number, ticket quantity, and payment
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
      <li>The registration fee is <strong>₱549 per head</strong> and includes your food at the venue.</li>
      <li>All registrations are <strong>non-refundable</strong>, but <strong>transferable</strong> to
      another person, provided the original registrant informs the organizers before the event.</li>
      <li>Registration is only confirmed once payment has been manually verified by the organizers. Until
      then, your status remains "Pending Payment Verification."</li>
      <li>If a problem is found with your payment (e.g. amount does not match your ticket quantity, or
      the reference number cannot be verified), you will be notified by email and given 24 hours to send
      corrected proof. If uncorrected after 24 hours, your reserved slot(s) are automatically released
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
