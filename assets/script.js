/**
 * Registration page logic. Relies on EVENT_CONFIG from config.js.
 */
(function () {
  const cfg = EVENT_CONFIG;
  let remainingSlots = null;
  let selectedChannelId = null;
  let screenshotBase64 = null;
  let screenshotFilename = null;

  // ---------- Populate static event info ----------
  function populateEventInfo() {
    document.getElementById('eventNameGate').textContent = cfg.EVENT_NAME;
    document.getElementById('eventTaglineGate').textContent = cfg.EVENT_TAGLINE;
    document.getElementById('eventNameMain').textContent = cfg.EVENT_NAME;
    document.getElementById('eventTaglineMain').textContent = cfg.EVENT_TAGLINE;
    document.getElementById('metaDate').textContent = cfg.EVENT_DATE_DISPLAY;
    document.getElementById('metaVenue').textContent = cfg.VENUE;
    const addr = document.getElementById('venueAddress');
    if (addr && cfg.VENUE_ADDRESS) {
      addr.textContent = cfg.VENUE_ADDRESS + ' · Open in Maps';
      addr.href = cfg.VENUE_MAP_URL || '#';
    }
    document.getElementById('organizerNote').textContent = cfg.ORGANIZER_NOTE;
    document.getElementById('dpaText').innerHTML = cfg.DPA_NOTICE_HTML;
    document.getElementById('termsText').innerHTML = cfg.TERMS_HTML;
    document.getElementById('maxMb').textContent = cfg.MAX_SCREENSHOT_MB;
    document.getElementById('ticketInclusionsNote').textContent = cfg.TICKET_INCLUSIONS_NOTE || '';

    if (cfg.BACKEND_URL.indexOf('REPLACE_WITH') === 0) {
      showStatus(
        'error',
        'Developer notice: BACKEND_URL in assets/config.js has not been set yet. Submissions will not work until it is.'
      );
    }
  }

  // ---------- DPA gate ----------
  function setupDpaGate() {
    const checkbox = document.getElementById('dpaCheckbox');
    const continueBtn = document.getElementById('dpaContinueBtn');
    checkbox.addEventListener('change', function () {
      continueBtn.disabled = !checkbox.checked;
    });
    continueBtn.addEventListener('click', function () {
      document.getElementById('dpaGate').hidden = true;
      document.getElementById('mainForm').hidden = false;
      fetchSlots();
    });
  }

  // ---------- Live slot count ----------
  function fetchSlots() {
    const banner = document.getElementById('slotBanner');
    const countEl = document.getElementById('slotCount');
    const hintEl = document.getElementById('slotHint');

    if (cfg.BACKEND_URL.indexOf('REPLACE_WITH') === 0) {
      countEl.textContent = `${cfg.TOTAL_CAP} slots total`;
      hintEl.textContent = 'Live count unavailable until the backend URL is configured.';
      remainingSlots = cfg.TOTAL_CAP;
      updateQtyLimits();
      return;
    }

    fetch(cfg.BACKEND_URL + '?action=slots')
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error || 'Could not load ticket availability.');
        remainingSlots = data.remaining;
        countEl.textContent = `${data.remaining} / ${data.totalCap} slots left`;
        if (data.remaining <= 0) {
          banner.classList.add('sold-out');
          hintEl.textContent = 'All slots have been claimed. Registration is closed.';
          document.getElementById('submitBtn').disabled = true;
        } else if (data.remaining <= 15) {
          hintEl.textContent = 'Almost sold out — register soon.';
        } else {
          hintEl.textContent = '';
        }
        updateQtyLimits();
      })
      .catch((err) => {
        countEl.textContent = 'Availability unknown';
        hintEl.textContent = err.message;
      });
  }

  // One registration = one person, so the amount is always one fee.
  function updateQtyLimits() {
    updateAmountDue();
  }

  function updateAmountDue() {
    const qty = 1;
    const amountEl = document.getElementById('amountDue');
    if (!cfg.PRICE_PER_TICKET) {
      amountEl.textContent = 'Price per ticket to be announced';
      return;
    }
    const total = qty * cfg.PRICE_PER_TICKET;
    amountEl.textContent = `Amount Due: ${cfg.CURRENCY}${total.toLocaleString()}`;
  }

  // ---------- Payment channels ----------
  function renderChannels() {
    const container = document.getElementById('channelOptions');

    // Only one channel configured (e.g. GCash-only) — nothing to
    // choose between, so skip the selector buttons and just show the
    // instructions directly.
    if (cfg.PAYMENT_CHANNELS.length === 1) {
      const ch = cfg.PAYMENT_CHANNELS[0];
      container.style.display = 'none';
      selectedChannelId = ch.id;
      document.getElementById('channelDetails').innerHTML =
        `<strong>Pay via ${ch.label}</strong><br>${ch.instructions}`;
      return;
    }

    cfg.PAYMENT_CHANNELS.forEach((ch, idx) => {
      const label = document.createElement('label');
      label.className = 'channel-option';
      label.innerHTML = `<input type="radio" name="paymentChannel" value="${ch.id}" />${ch.label}`;
      label.addEventListener('click', function () {
        document
          .querySelectorAll('.channel-option')
          .forEach((el) => el.classList.remove('selected'));
        label.classList.add('selected');
        selectedChannelId = ch.id;
        document.getElementById('channelDetails').textContent = ch.instructions;
      });
      container.appendChild(label);
      if (idx === 0) label.click();
    });
  }

  // ---------- GCash QR lightbox (tap to enlarge for scanning) ----------
  function setupQrLightbox() {
    const thumb = document.getElementById('gcashQrThumb');
    const lightbox = document.getElementById('qrLightbox');
    const closeBtn = document.getElementById('qrLightboxClose');
    if (!thumb || !lightbox) return;

    const open = () => {
      lightbox.hidden = false;
    };
    const close = () => {
      lightbox.hidden = true;
    };

    thumb.addEventListener('click', open);
    lightbox.addEventListener('click', close);
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  // ---------- Screenshot upload ----------
  function setupUpload() {
    const box = document.getElementById('uploadBox');
    const input = document.getElementById('screenshotInput');
    const preview = document.getElementById('uploadPreview');
    const boxText = document.getElementById('uploadBoxText');

    box.addEventListener('click', () => input.click());
    input.addEventListener('change', function () {
      const file = input.files[0];
      if (!file) return;
      const maxBytes = cfg.MAX_SCREENSHOT_MB * 1024 * 1024;
      if (file.size > maxBytes) {
        alert(`File is too large. Max size is ${cfg.MAX_SCREENSHOT_MB}MB.`);
        input.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        screenshotBase64 = reader.result.split(',')[1]; // strip data: prefix
        screenshotFilename = file.name;
        preview.src = reader.result;
        preview.style.display = 'block';
        box.classList.add('has-file');
        boxText.textContent = `Selected: ${file.name}`;
      };
      reader.readAsDataURL(file);
    });
  }

  // ---------- Facebook link ----------
  // Accepts "facebook.com/jeizone", "https://www.facebook.com/jeizone",
  // "m.facebook.com/...", "fb.com/..." or profile.php?id=... and returns a
  // clean https://facebook.com/... link, or '' if it isn't a Facebook link.
  function normalizeFacebook(raw) {
    let v = String(raw || '').trim();
    if (!v) return '';
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    let u;
    try { u = new URL(v); } catch (e) { return ''; }
    const host = u.hostname.toLowerCase().replace(/^(www|m|web|mbasic)\./, '');
    if (host !== 'facebook.com' && host !== 'fb.com') return '';
    const path = u.pathname.replace(/\/+$/, '');
    if (!path || path === '/') return '';
    if (/^\/profile\.php$/i.test(path)) {
      const id = u.searchParams.get('id');
      return id && /^\d+$/.test(id) ? 'https://facebook.com/profile.php?id=' + id : '';
    }
    if (!/^\/[A-Za-z0-9.\-_/]+$/.test(path)) return '';
    return 'https://facebook.com' + path;
  }

  // ---------- Validation ----------
  function setFieldError(fieldId, hasError) {
    document.getElementById(fieldId).classList.toggle('invalid', hasError);
  }

  function validateForm(values) {
    let valid = true;

    if (!values.firstName) {
      setFieldError('field-firstName', true);
      valid = false;
    } else setFieldError('field-firstName', false);

    if (!values.lastName) {
      setFieldError('field-lastName', true);
      valid = false;
    } else setFieldError('field-lastName', false);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      setFieldError('field-email', true);
      valid = false;
    } else setFieldError('field-email', false);

    const cleanedPhone = (values.phone || '').replace(/\s|-/g, '');
    if (!/^(\+?63|0)9\d{9}$/.test(cleanedPhone)) {
      setFieldError('field-phone', true);
      valid = false;
    } else setFieldError('field-phone', false);

    if (values.fanType !== 'Fanboy' && values.fanType !== 'Fangirl') {
      setFieldError('field-fanType', true);
      valid = false;
    } else setFieldError('field-fanType', false);

    if (!normalizeFacebook(values.facebook)) {
      setFieldError('field-facebook', true);
      valid = false;
    } else setFieldError('field-facebook', false);

    if (!selectedChannelId) {
      valid = false;
      alert('Please select a payment channel.');
    }

    if (!values.paymentReference || values.paymentReference.trim().length < 3) {
      setFieldError('field-reference', true);
      valid = false;
    } else setFieldError('field-reference', false);

    if (!screenshotBase64) {
      document.getElementById('uploadError').style.display = 'block';
      valid = false;
    } else {
      document.getElementById('uploadError').style.display = 'none';
    }

    if (!document.getElementById('dpaCheckbox').checked) {
      valid = false;
    }
    if (!document.getElementById('termsCheckbox').checked) {
      alert('Please agree to the Terms & Conditions before submitting.');
      valid = false;
    }

    return valid;
  }

  // ---------- Status banner ----------
  function showStatus(type, message) {
    const el = document.getElementById('statusBanner');
    el.className = 'status-banner show ' + type;
    el.textContent = message;
  }

  function hideStatus() {
    const el = document.getElementById('statusBanner');
    el.className = 'status-banner';
  }

  // ---------- Pre-submit confirmation modal ----------
  // Registrants only get one shot at this — a wrong name, a stale email, or
  // a mistyped reference number are the most common reasons a registration
  // has to be corrected or rejected later. This forces a deliberate look
  // at exactly those fields before anything gets sent. All values here are
  // the registrant's own, set via textContent (never innerHTML), so there's
  // no way for typed text to be interpreted as markup.
  function channelLabel(id) {
    const ch = cfg.PAYMENT_CHANNELS.find(function (c) { return c.id === id; });
    return ch ? ch.label : id || '—';
  }

  function populateConfirmModal(values) {
    document.getElementById('confirmFullName').textContent = values.firstName + ' ' + values.lastName;
    document.getElementById('confirmEmail').textContent = values.email;
    document.getElementById('confirmPhone').textContent = values.phone;
    document.getElementById('confirmChannel').textContent = channelLabel(selectedChannelId);
    document.getElementById('confirmReference').textContent = values.paymentReference;

    document.getElementById('confirmFan').textContent = values.fanType;
    document.getElementById('confirmFacebook').textContent = normalizeFacebook(values.facebook);
    document.getElementById('confirmAmount').textContent = cfg.PRICE_PER_TICKET
      ? `${cfg.CURRENCY}${cfg.PRICE_PER_TICKET.toLocaleString()} (1 person)`
      : '1 person';

    const thumb = document.getElementById('confirmScreenshotThumb');
    const uploadedPreview = document.getElementById('uploadPreview');
    if (thumb && uploadedPreview && uploadedPreview.src) {
      thumb.src = uploadedPreview.src;
      thumb.style.display = 'block';
    } else if (thumb) {
      thumb.style.display = 'none';
    }
  }

  function openConfirmModal() {
    document.getElementById('confirmModal').hidden = false;
  }

  function closeConfirmModal() {
    document.getElementById('confirmModal').hidden = true;
  }

  function setupConfirmModal() {
    document.getElementById('confirmEditBtn').addEventListener('click', closeConfirmModal);
    document.getElementById('confirmModal').addEventListener('click', function (e) {
      if (e.target.id === 'confirmModal') closeConfirmModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !document.getElementById('confirmModal').hidden) closeConfirmModal();
    });
  }

  // ---------- Submit ----------
  function setupSubmit() {
    const form = document.getElementById('registrationForm');
    const submitBtn = document.getElementById('submitBtn');
    const confirmSubmitBtn = document.getElementById('confirmSubmitBtn');
    let pendingValues = null;

    function doActualSubmit(values) {
      const honeypotEl = document.getElementById('website');

      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        ticketQuantity: 1,
        fanType: values.fanType,
        facebook: normalizeFacebook(values.facebook),
        paymentChannel: selectedChannelId,
        paymentReference: values.paymentReference,
        paymentScreenshotBase64: screenshotBase64,
        paymentScreenshotFilename: screenshotFilename,
        dpaConsent: true,
        termsAccepted: true,
        website: honeypotEl ? honeypotEl.value : '',
      };

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
      confirmSubmitBtn.disabled = true;

      // NOTE: Content-Type is text/plain on purpose — see Code.gs comments.
      // This avoids a CORS preflight that Apps Script web apps don't handle,
      // while the backend still parses the body as JSON.
      fetch(cfg.BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((data) => {
          confirmSubmitBtn.disabled = false;
          if (!data.ok) {
            showStatus('error', data.error || 'Something went wrong. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Registration';
            return;
          }
          form.style.display = 'none';
          document.getElementById('successPanel').style.display = 'block';
          document.getElementById('successRegId').textContent = data.registrationId;
          window.scrollTo({ top: 0, behavior: 'smooth' });
        })
        .catch(() => {
          confirmSubmitBtn.disabled = false;
          showStatus('error', 'Network error — please check your connection and try again.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Registration';
        });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideStatus();

      const values = {
        firstName: document.getElementById('firstName').value.trim().replace(/\s+/g, ' '),
        lastName: document.getElementById('lastName').value.trim().replace(/\s+/g, ' '),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        fanType: (document.querySelector('input[name="fanType"]:checked') || {}).value || '',
        facebook: document.getElementById('facebook').value.trim(),
        paymentReference: document.getElementById('paymentReference').value.trim(),
      };

      if (!validateForm(values)) {
        showStatus('error', 'Please fix the highlighted fields before submitting.');
        return;
      }

      if (cfg.BACKEND_URL.indexOf('REPLACE_WITH') === 0) {
        showStatus('error', 'Cannot submit yet — BACKEND_URL is not configured in assets/config.js.');
        return;
      }

      pendingValues = values;
      populateConfirmModal(values);
      openConfirmModal();
    });

    confirmSubmitBtn.addEventListener('click', function () {
      if (!pendingValues) return;
      closeConfirmModal();
      doActualSubmit(pendingValues);
    });

  }

  // ---------- FAQ ----------
  // Answers come from FAQ in config.js (trusted, written by the organizers).
  function renderFaq() {
    const list = document.getElementById('faqList');
    if (!list || !cfg.FAQ || !cfg.FAQ.length) {
      const sec = document.getElementById('faq');
      if (sec) sec.hidden = true;
      return;
    }
    cfg.FAQ.forEach(function (item) {
      const d = document.createElement('details');
      d.className = 'faq-item';
      const s = document.createElement('summary');
      s.textContent = item[0];
      const a = document.createElement('div');
      a.className = 'faq-answer';
      a.innerHTML = item[1];
      d.appendChild(s);
      d.appendChild(a);
      list.appendChild(d);
    });
  }

  // ---------- Sponsors strip ----------
  // Only confirmed sponsors with "Show on Site" = Yes come back from the
  // backend, and only their name and logo link. Hidden if there are none.
  function loadSponsors() {
    if (cfg.BACKEND_URL.indexOf('REPLACE_WITH') === 0) return;
    fetch(cfg.BACKEND_URL + '?action=sponsors')
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok || !data.sponsors || !data.sponsors.length) return;
        const list = document.getElementById('sponsorList');
        data.sponsors.forEach(function (sp) {
          const li = document.createElement('li');
          if (sp.logoUrl) {
            const img = document.createElement('img');
            img.src = sp.logoUrl;
            img.alt = sp.name;
            img.loading = 'lazy';
            img.onerror = function () { li.textContent = sp.name; };
            li.appendChild(img);
          } else {
            li.textContent = sp.name;
          }
          list.appendChild(li);
        });
        document.getElementById('sponsorsStrip').hidden = false;
      })
      .catch(function () {});
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', function () {
    populateEventInfo();
    setupDpaGate();
    renderChannels();
    setupQrLightbox();
    setupUpload();
    setupConfirmModal();
    setupSubmit();
    renderFaq();
    loadSponsors();
  });
})();
