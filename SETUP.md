# Setup: GAME TIME registration

This is a copy of the Wakas at Simula block screening system, changed for SSOB's birthday celebration on Saturday, November 14, 2026, 5:00 PM onwards, at Teaspoon Cafe (5B & 6A Juan Luna Street, Gagalangin, Tondo, Manila 1013). The screening site and its spreadsheet are not touched. This event gets its own spreadsheet, its own Apps Script deployment and its own GitHub Pages site.

What changed from the screening:

- Individual registration: one person per form, no ticket quantity. Each attendee registers and pays ₱549 on their own.
- First name and last name are separate fields. The form also asks Fanboy or Fangirl and the person's Facebook profile link (any format like facebook.com/jeizone is cleaned up to https://facebook.com/jeizone). The sheet also keeps a combined Full Legal Name column, which the emails, the printed list and the scanner use.
- Fee is ₱549 per head. Capacity is 120 heads in total.
- New Attendee Type column: Registrant (paid), Guest, Admin, Volunteer. The last three are free passes added from the team dashboard. They need no form and no payment, they get a QR code, and each takes one seat.
- New team dashboard at `/dashboard/` with tabs for Overview, Registrants, Guests, Admin and Volunteers, plus a budget monitor.
- New Sponsors list (Sponsors tab in the sheet and on the dashboard), with a starter list of SB19's brand partners. Sponsor cash received counts in the budget. Confirmed sponsors are thanked on the registration page.
- The venue address and a Google Maps link are on the registration page and in the approval emails.
- The admin seat reserve from the screening is gone. Free passes do that job now and come out of the same 120 seats.
- The reminder email scripts were left out. They were written for the screening. Ask if you want a birthday version.

## 1. Publish the site (GitHub Pages)

1. Push this folder to a new repository, for example `sbfanboyjason/josh-bday-registration`.
2. In the repository: Settings > Pages > Source: Deploy from a branch > `main` / root > Save.
3. The site will be at `https://sbfanboyjason.github.io/josh-bday-registration/`. If you use a different repository name, change `SITE_BASE_URL` in `backend/Code.gs` to match.

## 2. Create the spreadsheet and backend (about 15 minutes)

1. Create a new Google Sheet, e.g. "GAME TIME Registrations", in the account that should send the emails.
2. Extensions > Apps Script. Rename the project, e.g. "GAME TIME Backend".
3. Replace the contents of `Code.gs` with `backend/Code.gs` from this repository.
4. Add three more script files with the + next to Files > Script:
   - `Checkin`, paste `backend/Checkin.gs`
   - `Dashboard`, paste `backend/Dashboard.gs`
   - `Sponsors`, paste `backend/Sponsors.gs`
5. Save (Ctrl+S). Go back to the sheet and reload it. A "Josh Birthday Admin" menu appears.
6. Josh Birthday Admin > Initialize / Reset Sheet Structure. Approve the permissions prompt. This creates the Registrations, `_Config` and `_AuditLog` tabs.
7. Josh Birthday Admin > Install Automated Triggers (run once).
8. Josh Birthday Admin > Set Up Event Check-in. This creates the `_Staff` tab and shows each person's 6-digit PIN once. Screenshot it. Rename Team 1 to Team 4 in `_Staff` if you like, and set Role to Admin for anyone else who should add or remove free passes.
9. Josh Birthday Admin > Set Up Sponsors Sheet, then Load SB19 Brand Partners into Sponsors.
10. Josh Birthday Admin > Build / Refresh Dashboard.
11. Deploy > New deployment > type Web app. Execute as: Me. Who has access: Anyone. Deploy and copy the `/exec` URL.
12. Paste that URL into `BACKEND_URL` in `assets/config.js` and push. The registration page, scanner and dashboard all read it from there.

Later code changes: Deploy > Manage deployments > pencil > Version: New version > Deploy. Do not make a new deployment, because that changes the URL.

## 3. The `_Config` tab

| Key | Value | Meaning |
|---|---|---|
| Registration Fee | 549 | What each paid registrant pays per head |
| Venue Cost per Head | 495 | What Teaspoon Cafe charges for every person inside, paid or free |
| Venue Capacity | 120 | Total heads: paid plus guests, admin and volunteers |

Change a number here and the dashboard, the seat count and the emails follow. If you change the fee, also change `PRICE_PER_TICKET` and the terms text in `assets/config.js`, since the public page shows it.

## 4. Using the team dashboard

Open `https://sbfanboyjason.github.io/josh-bday-registration/dashboard/` and sign in with the same PIN as the scanner. Signing in on one also signs you in on the other, on the same phone.

- Everyone with a PIN can see the numbers and the lists.
- Only Admin accounts can add or remove free passes and see contact details and QR codes.

To add someone: open the Guests, Admin or Volunteers tab, type first and last name, and tap Add pass. Email and mobile are optional. With an email, the QR pass is emailed. Without one, the QR shows on screen so you can screenshot it and send it yourself. Before you tap Add, the form shows what the pass will do to the surplus.

To remove someone: tap Remove on their card. Their QR stops working, their seat goes back to the pool, and the row stays in the sheet as Cancelled with your name and reason in Admin Notes.

Paid registrations are still approved in the spreadsheet, the same way as the screening: change the Status cell, confirm the popup, and the email goes out.

## 5. How the budget works

Every person inside costs the venue ₱495, paid or free. A paid registrant pays ₱549, so each one leaves ₱54 after their own plate. Free passes are paid for out of those ₱54 margins.

- One free pass costs ₱495, which takes 495 ÷ 54 = about 9.2 paid registrants to cover.
- Paid heads needed = free passes × 495 ÷ 54, rounded up. 6 free passes need 55 paid heads. 10 need 92.
- With 120 seats, the most free passes a full house can cover is 11. At 109 paid + 11 free the fees cover everything with ₱441 left. At 108 paid + 12 free you are ₱108 short. Sponsor cash received raises that limit.

The dashboard shows these numbers live, counting only verified payments, with a separate line for what happens if the pending ones go through. It turns red and says how many more paid heads you need whenever the free passes are not yet covered.

## 6. Sponsors

The Sponsors tab keeps one row per sponsor or prospect. The system sends nothing to sponsors. The team emails them one by one from sbfanboyjason@gmail.com and updates the status as they go.

The starter list has 38 brands. Most are SB19 endorsements from news reports, plus everything on the partner logo wall the team shared. The Group column separates them:

- SB19 partner 2026: current deals (REDMI/Xiaomi, Canva, Sony, Watsons, AIA)
- SB19 partner 2024-2025 and SB19 past partner: earlier deals
- SB19 partner (logo wall): on the logo wall, year not checked (TM, Datu Puti, Great Taste, NovoDental, Timezone, Fino, Bonchon, Bioderm)
- Member partner: deals with one member (IKEA with Josh)
- Music / industry partner: labels, publishers, agencies and the DOT. Kept for completeness, but they rarely sponsor fan events.

19 of the consumer brands come with a public contact from the company's own site or official page (15 have an email). Where a brand has no public email, the Contact Person column says the best route, usually its contact form or a message to its Facebook page. A few emails go to customer care, so ask them to forward your letter to Marketing. Check each one before sending, since contacts change.

Each sponsor card on the dashboard has Copy invitation, which copies the letter with the brand's name filled in, and Write in Gmail, which opens a ready-to-send draft from sbfanboyjason@gmail.com. Send it yourself, then set the status to Emailed. The letter is in `dashboard/sponsor-email.js` (copy in SPONSOR-EMAIL.md). Replace `[Messenger link]` there with the page's m.me link before you start sending.

On the dashboard Sponsors tab, admins can change a status straight from the dropdown on each card, or tap Edit for the full record. Setting Emailed or Followed up stamps today's date in Last Contacted.

Statuses: Not contacted, Emailed, Followed up, Replied, Confirmed, Received, Declined, No reply.

Money:

- Cash Received counts in the budget right away and pays for free passes before the ₱54 margins are needed. ₱3,000 in sponsor cash covers 6 free passes outright.
- Cash Pledged shows separately and does not count until it is marked received.
- Item Value is an estimate for products or freebies, shown for reference only.
- Declined sponsors never count.

What sponsors get: a shoutout pubmat and engagement, tracked in the Pubmat column (Not started, Drafted, Posted). Sponsors marked Confirmed or Received with Show on Site = Yes appear in a "Thank you to our sponsors" section at the bottom of the registration page. Paste an https logo link in Logo URL to show their logo instead of the name.

## 7. Rehearsal and event day

Same as the screening. Josh Birthday Admin > Create Check-in Test Tickets adds five test rows, including one free Guest pass, and shows their QR codes. Scan them with `/checkin/`, then run Remove Check-in Test Tickets before registration opens. Test rows hold seats until removed.

The scanner shows "FREE GUEST PASS" (or ADMIN / VOLUNTEER) under the name, so the door team knows that person did not pay.

Print a backup list with Josh Birthday Admin > Print Attendee List. It now includes free passes, sorted by last name.

After the event, delete the "Josh Birthday - Check-in ID Photos" Drive folder once there are no more concerns, in line with the Data Privacy Notice.

## Things to confirm

- Start time: 5:00 PM onwards. To change it, edit `EVENT_DATE_DISPLAY` in both `assets/config.js` and `backend/Code.gs`.
- GCash account: the same number and name as the screening. Change `PAYMENT_CHANNELS` in `assets/config.js` and replace `assets/gcash-qr.jpg` if a different account will receive payments.
- Contact email: `sbfanboyjason@gmail.com`, in `backend/Code.gs` and the privacy notice in `assets/config.js`.
