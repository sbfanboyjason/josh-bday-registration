/**
 * Be a Ninang page. Talks to the same Apps Script backend:
 *   GET  BACKEND_URL?action=ninangs  -> Ninang wall (names only)
 *   POST BACKEND_URL?action=ninang   -> pledge (text/plain JSON, no CORS preflight)
 */
(function () {
  var cfg = EVENT_CONFIG; // from ../assets/config.js
  var shotBase64 = '';
  var shotName = '';
  var pending = null;

  function $(id) { return document.getElementById(id); }
  function radio(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }
  function setErr(id, bad) { $(id).classList.toggle('invalid', !!bad); }
  function peso(n) {
    return '₱' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }
  function money(v) {
    var s = String(v || '').replace(/[₱,\s]/g, '');
    return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
  }
  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function showStatus(type, msg) {
    var b = $('statusBanner');
    b.className = 'status-banner show ' + type;
    b.textContent = msg;
    b.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function hideStatus() { $('statusBanner').className = 'status-banner'; }

  // Same rules as the registration page and the backend.
  function normalizeFacebook(raw) {
    var v = String(raw || '').trim();
    if (!v) return '';
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    var u;
    try { u = new URL(v); } catch (e) { return ''; }
    var host = u.hostname.toLowerCase().replace(/^(www|m|web|mbasic)\./, '');
    if (host !== 'facebook.com' && host !== 'fb.com') return '';
    var path = u.pathname.replace(/\/+$/, '');
    if (!path || path === '/') return '';
    if (/^\/profile\.php$/i.test(path)) {
      var id = u.searchParams.get('id');
      return id && /^\d+$/.test(id) ? 'https://facebook.com/profile.php?id=' + id : '';
    }
    if (!/^\/[A-Za-z0-9.\-_/]+$/.test(path)) return '';
    return 'https://facebook.com' + path;
  }

  // ---------- Wall ----------
  function loadWall() {
    if (!cfg.BACKEND_URL) return;
    fetch(cfg.BACKEND_URL + '?action=ninangs')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) throw new Error();
        var list = $('wallList');
        list.textContent = '';
        d.wall.forEach(function (name) {
          var li = document.createElement('li');
          li.textContent = name;
          if (name === 'Anonymous Ninang') li.className = 'anon';
          list.appendChild(li);
        });
        $('wallCount').textContent = d.count
          ? 'Thank you to our ' + d.count + ' Ninang' + (d.count === 1 ? '' : 's') + '! Names appear here once each gift is received.'
          : 'Be one of our first Ninangs! Names appear here once each gift is received.';
        if (d.open === false) {
          $('ninangForm').style.display = 'none';
          showStatus('error', 'Ninang pledges are now closed. Thank you to everyone who gave!');
        }
      })
      .catch(function () {
        $('wallCount').textContent = 'The Ninang wall could not load right now. Please refresh in a moment.';
      });
  }

  // ---------- Show / hide parts of the form ----------
  function syncSections() {
    var giving = radio('giving');
    $('cashCard').hidden = !(giving === 'Cash' || giving === 'Cash and items');
    $('itemsCard').hidden = !(giving === 'Items' || giving === 'Cash and items');
    var showAs = radio('showAs');
    $('field-wallName').hidden = showAs !== 'Name';
    $('anonNote').hidden = showAs !== 'Anonymous';
    var hand = radio('handover');
    $('field-pickup').hidden = hand !== 'Please pick up';
    $('deliverNote').hidden = hand !== 'I will deliver';
  }

  function setupUpload() {
    $('maxMb').textContent = cfg.MAX_SCREENSHOT_MB;
    $('uploadBox').addEventListener('click', function () { $('screenshotInput').click(); });
    $('screenshotInput').addEventListener('change', function () {
      var file = this.files[0];
      if (!file) return;
      if (file.size > cfg.MAX_SCREENSHOT_MB * 1024 * 1024) {
        alert('File is too large. Max size is ' + cfg.MAX_SCREENSHOT_MB + 'MB.');
        this.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        shotBase64 = String(reader.result).split(',')[1];
        shotName = file.name;
        $('uploadPreview').src = reader.result;
        $('uploadPreview').style.display = 'block';
        $('uploadBox').classList.add('has-file');
        $('uploadBoxText').textContent = 'Selected: ' + file.name;
        setErr('field-screenshot', false);
      };
      reader.readAsDataURL(file);
    });
  }

  function setupQr() {
    var box = $('qrLightbox');
    $('gcashQrThumb').addEventListener('click', function () { box.hidden = false; });
    box.addEventListener('click', function () { box.hidden = true; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.hidden = true; });
    var ch = (cfg.PAYMENT_CHANNELS || [])[0];
    $('gcashLine').textContent = ch ? ch.instructions : '';
  }

  // ---------- Validate ----------
  function collect() {
    return {
      firstName: $('firstName').value.trim().replace(/\s+/g, ' '),
      lastName: $('lastName').value.trim().replace(/\s+/g, ' '),
      email: $('email').value.trim(),
      phone: $('phone').value.replace(/\s|-/g, ''),
      facebook: normalizeFacebook($('facebook').value),
      showAs: radio('showAs'),
      wallName: $('wallName').value.trim().replace(/\s+/g, ' '),
      giving: radio('giving'),
      cashAmount: $('cashAmount').value,
      paymentReference: $('paymentReference').value.trim(),
      items: $('items').value.trim(),
      itemQuantity: $('itemQuantity').value.trim(),
      handover: radio('handover'),
      pickupNotes: $('pickupNotes').value.trim(),
      message: $('message').value.trim(),
    };
  }

  function validate(v) {
    var ok = true;
    var check = function (id, bad) { setErr(id, bad); if (bad) ok = false; };
    check('field-firstName', !v.firstName);
    check('field-lastName', !v.lastName);
    check('field-email', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email));
    check('field-phone', !/^(\+?63|0)9\d{9}$/.test(v.phone));
    check('field-facebook', !v.facebook);
    check('field-showAs', !v.showAs);
    check('field-giving', !v.giving);
    var cash = v.giving === 'Cash' || v.giving === 'Cash and items';
    var items = v.giving === 'Items' || v.giving === 'Cash and items';
    if (cash) {
      check('field-amount', !(money(v.cashAmount) > 0));
      check('field-reference', !v.paymentReference);
      check('field-screenshot', !shotBase64);
    }
    if (items) {
      check('field-items', !v.items);
      check('field-handover', !v.handover);
      if (v.handover === 'Please pick up') check('field-pickup', !v.pickupNotes);
    }
    check('field-dpa', !$('dpaCheckbox').checked);
    return ok;
  }

  // ---------- Confirm + send ----------
  function openConfirm(v) {
    var rows = [
      ['Name', v.firstName + ' ' + v.lastName],
      ['Thanked as', v.showAs === 'Anonymous' ? 'Anonymous Ninang' : (v.wallName || v.firstName + ' ' + v.lastName)],
      ['Email', v.email],
      ['Mobile', v.phone],
    ];
    if (v.giving !== 'Items') {
      rows.push(['Cash via GCash', peso(money(v.cashAmount))]);
      rows.push(['Reference No.', v.paymentReference]);
    }
    if (v.giving !== 'Cash') {
      rows.push(['Items', v.items + (v.itemQuantity ? ' (' + v.itemQuantity + ')' : '')]);
      rows.push(['Handover', v.handover === 'Please pick up' ? 'Please pick up: ' + v.pickupNotes : 'I will deliver']);
    }
    $('confirmBody').innerHTML = '<div class="confirm-list">' + rows.map(function (r) {
      return '<div><span>' + esc(r[0]) + '</span><strong>' + esc(r[1]) + '</strong></div>';
    }).join('') + '</div>' +
      (v.giving !== 'Items' ? '<p class="hint">Please make sure the amount and reference number match your GCash receipt.</p>' : '');
    $('confirmModal').hidden = false;
  }

  function send(v) {
    var btn = $('confirmSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    $('submitBtn').disabled = true;
    var payload = {
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email,
      phone: v.phone,
      facebook: v.facebook,
      showAs: v.showAs,
      wallName: v.wallName,
      giving: v.giving,
      cashAmount: v.giving !== 'Items' ? money(v.cashAmount) : '',
      paymentReference: v.giving !== 'Items' ? v.paymentReference : '',
      paymentScreenshotBase64: v.giving !== 'Items' ? shotBase64 : '',
      paymentScreenshotFilename: v.giving !== 'Items' ? shotName : '',
      items: v.giving !== 'Cash' ? v.items : '',
      itemQuantity: v.giving !== 'Cash' ? v.itemQuantity : '',
      handover: v.giving !== 'Cash' ? v.handover : '',
      pickupNotes: v.giving !== 'Cash' && v.handover === 'Please pick up' ? v.pickupNotes : '',
      message: v.message,
      dpaConsent: true,
      website: $('website').value,
    };
    fetch(cfg.BACKEND_URL + '?action=ninang', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        btn.disabled = false;
        btn.textContent = 'Send Pledge';
        $('confirmModal').hidden = true;
        if (!d.ok) {
          $('submitBtn').disabled = false;
          showStatus('error', d.error || 'Something went wrong. Please try again.');
          return;
        }
        $('ninangForm').style.display = 'none';
        hideStatus();
        $('successId').textContent = d.ninangId;
        var parts = [];
        if (v.giving !== 'Items') parts.push('we check your GCash payment');
        if (v.giving !== 'Cash') parts.push(v.handover === 'Please pick up' ? 'we message you to arrange the pickup' : 'we message you where to drop off your items');
        $('successText').textContent = 'We emailed a copy of your pledge to ' + v.email + '. Next, ' + parts.join(' and ') +
          '. Once your gift is received, ' + (v.showAs === 'Anonymous' ? 'an Anonymous Ninang' : 'your name') +
          ' goes up on the Ninang wall and we send you a thank-you email.';
        $('successPanel').style.display = 'block';
        window.scrollTo({ top: $('successPanel').offsetTop - 20, behavior: 'smooth' });
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = 'Send Pledge';
        $('confirmModal').hidden = true;
        $('submitBtn').disabled = false;
        showStatus('error', 'Network error. Please check your connection and try again.');
      });
  }

  function setupShare() {
    $('shareBtn').addEventListener('click', function () {
      var url = location.href.split('#')[0].split('?')[0];
      var data = { title: 'Be a Ninang of GAME TIME', text: 'Help celebrate SSOB\'s birthday! Be a Ninang, any amount from the heart.', url: url };
      if (navigator.share) {
        navigator.share(data).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { $('shareBtn').textContent = 'Link copied!'; });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupUpload();
    setupQr();
    setupShare();
    ['showAs', 'giving', 'handover'].forEach(function (n) {
      document.querySelectorAll('input[name="' + n + '"]').forEach(function (el) {
        el.addEventListener('change', function () { syncSections(); setErr('field-' + n, false); });
      });
    });
    syncSections();
    $('ninangForm').addEventListener('submit', function (e) {
      e.preventDefault();
      hideStatus();
      var v = collect();
      if (!validate(v)) {
        showStatus('error', 'Please check the highlighted fields.');
        var first = document.querySelector('.invalid');
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      pending = v;
      openConfirm(v);
    });
    $('confirmEditBtn').addEventListener('click', function () { $('confirmModal').hidden = true; });
    $('confirmSubmitBtn').addEventListener('click', function () { if (pending) send(pending); });
    loadWall();
  });
})();
