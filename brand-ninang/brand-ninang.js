/**
 * Brand Ninang page (unlisted; shared only in our emails and Messenger
 * messages to brands). Posts to BACKEND_URL?action=brandNinang as
 * text/plain JSON, which writes into the Sponsors tab.
 */
(function () {
  var cfg = EVENT_CONFIG;
  var shot = { b64: '', name: '' };
  var logo = { b64: '', name: '' };
  var pending = null;

  function $(id) { return document.getElementById(id); }
  function radio(n) { var el = document.querySelector('input[name="' + n + '"]:checked'); return el ? el.value : ''; }
  function setErr(id, bad) { var el = $(id); if (el) el.classList.toggle('invalid', !!bad); }
  function money(v) { var s = String(v || '').replace(/[₱,\s]/g, ''); return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN; }
  function peso(n) { return '₱' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function showStatus(type, msg) {
    var b = $('statusBanner');
    b.className = 'status-banner show ' + type;
    b.textContent = msg;
    b.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function hideStatus() { $('statusBanner').className = 'status-banner'; }

  function sync() {
    var g = radio('giving');
    $('cashCard').hidden = !(g === 'Cash' || g === 'Cash and products');
    $('productsCard').hidden = !(g === 'Products' || g === 'Cash and products');
    $('gcashPart').hidden = radio('paymentMethod') !== 'GCash now';
    var h = radio('handover');
    $('field-pickup').hidden = h !== 'Please pick up';
    $('deliverNote').hidden = h !== 'We will deliver';
  }

  function upload(boxId, inputId, previewId, textId, target, label) {
    $(boxId).addEventListener('click', function () { $(inputId).click(); });
    $(inputId).addEventListener('change', function () {
      var f = this.files[0];
      if (!f) return;
      if (f.size > cfg.MAX_SCREENSHOT_MB * 1024 * 1024) {
        alert('File is too large. Max size is ' + cfg.MAX_SCREENSHOT_MB + 'MB.');
        this.value = '';
        return;
      }
      var r = new FileReader();
      r.onload = function () {
        target.b64 = String(r.result).split(',')[1];
        target.name = f.name;
        $(previewId).src = r.result;
        $(previewId).style.display = 'block';
        $(boxId).classList.add('has-file');
        $(textId).textContent = label + ': ' + f.name;
        setErr('field-screenshot', false);
      };
      r.readAsDataURL(f);
    });
  }

  function collect() {
    return {
      brand: $('brand').value.trim().replace(/\s+/g, ' '),
      contactName: $('contactName').value.trim().replace(/\s+/g, ' '),
      position: $('position').value.trim(),
      email: $('email').value.trim(),
      phone: $('phone').value.replace(/[\s\-()]/g, ''),
      page: $('page').value.trim(),
      giving: radio('giving'),
      cashAmount: $('cashAmount').value,
      paymentMethod: radio('paymentMethod'),
      paymentReference: $('paymentReference').value.trim(),
      products: $('products').value.trim(),
      productQuantity: $('productQuantity').value.trim(),
      productValue: $('productValue').value.trim(),
      handover: radio('handover'),
      pickupNotes: $('pickupNotes').value.trim(),
      showOnSite: radio('showOnSite') || 'Yes',
      message: $('message').value.trim(),
    };
  }

  function validate(v) {
    var ok = true;
    var check = function (id, bad) { setErr(id, bad); if (bad) ok = false; };
    check('field-brand', !v.brand);
    check('field-contactName', !v.contactName);
    check('field-email', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email));
    check('field-phone', !/^(\+?63|0)\d{9,10}$/.test(v.phone));
    check('field-giving', !v.giving);
    var cash = v.giving === 'Cash' || v.giving === 'Cash and products';
    var prod = v.giving === 'Products' || v.giving === 'Cash and products';
    if (cash) {
      check('field-amount', !(money(v.cashAmount) > 0));
      check('field-payment', !v.paymentMethod);
      if (v.paymentMethod === 'GCash now') {
        check('field-reference', !v.paymentReference);
        check('field-screenshot', !shot.b64);
      }
    }
    if (prod) {
      check('field-products', !v.products);
      check('field-value', v.productValue !== '' && !(money(v.productValue) >= 0));
      check('field-handover', !v.handover);
      if (v.handover === 'Please pick up') check('field-pickup', !v.pickupNotes);
    }
    check('field-dpa', !$('dpaCheckbox').checked);
    return ok;
  }

  function openConfirm(v) {
    var rows = [['Brand', v.brand], ['Contact', v.contactName + (v.position ? ', ' + v.position : '')], ['Email', v.email], ['Phone', v.phone]];
    if (v.giving !== 'Products') {
      rows.push(['Cash', peso(money(v.cashAmount)) + (v.paymentMethod === 'GCash now' ? ' via GCash (Ref. ' + v.paymentReference + ')' : ', to coordinate with the team')]);
    }
    if (v.giving !== 'Cash') {
      rows.push(['Products', v.products + (v.productQuantity ? ' (' + v.productQuantity + ')' : '')]);
      rows.push(['Handover', v.handover === 'Please pick up' ? 'Please pick up: ' + v.pickupNotes : 'We will deliver']);
    }
    rows.push(['Logo on registration page', v.showOnSite]);
    $('confirmBody').innerHTML = '<div class="confirm-list">' + rows.map(function (r) {
      return '<div><span>' + esc(r[0]) + '</span><strong>' + esc(r[1]) + '</strong></div>';
    }).join('') + '</div>';
    $('confirmModal').hidden = false;
  }

  function send(v) {
    var btn = $('confirmSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    $('submitBtn').disabled = true;
    var cash = v.giving !== 'Products';
    var prod = v.giving !== 'Cash';
    var payload = {
      brand: v.brand, contactName: v.contactName, position: v.position, email: v.email, phone: v.phone, page: v.page,
      giving: v.giving,
      cashAmount: cash ? money(v.cashAmount) : '',
      paymentMethod: cash ? v.paymentMethod : '',
      paymentReference: cash && v.paymentMethod === 'GCash now' ? v.paymentReference : '',
      paymentScreenshotBase64: cash && v.paymentMethod === 'GCash now' ? shot.b64 : '',
      paymentScreenshotFilename: cash && v.paymentMethod === 'GCash now' ? shot.name : '',
      products: prod ? v.products : '', productQuantity: prod ? v.productQuantity : '',
      productValue: prod && v.productValue !== '' ? money(v.productValue) : '',
      handover: prod ? v.handover : '', pickupNotes: prod && v.handover === 'Please pick up' ? v.pickupNotes : '',
      logoBase64: logo.b64, logoFilename: logo.name,
      showOnSite: v.showOnSite, message: v.message, dpaConsent: true, website: $('website').value,
    };
    fetch(cfg.BACKEND_URL + '?action=brandNinang', {
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
        hideStatus();
        $('brandForm').style.display = 'none';
        $('successId').textContent = d.sponsorId;
        $('successText').textContent = 'We emailed a copy of your pledge to ' + v.email +
          '. Our team will reach out to confirm the details. Salamat po, Ninang ' + v.brand + '!';
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

  document.addEventListener('DOMContentLoaded', function () {
    Array.prototype.forEach.call(document.querySelectorAll('.maxMb'), function (el) { el.textContent = cfg.MAX_SCREENSHOT_MB; });
    var ch = (cfg.PAYMENT_CHANNELS || [])[0];
    $('gcashLine').textContent = ch ? ch.instructions : '';
    var lb = $('qrLightbox');
    $('gcashQrThumb').addEventListener('click', function () { lb.hidden = false; });
    lb.addEventListener('click', function () { lb.hidden = true; });
    upload('uploadBox', 'screenshotInput', 'uploadPreview', 'uploadBoxText', shot, 'Selected');
    upload('logoBox', 'logoInput', 'logoPreview', 'logoBoxText', logo, 'Logo');
    ['giving', 'paymentMethod', 'handover'].forEach(function (n) {
      Array.prototype.forEach.call(document.querySelectorAll('input[name="' + n + '"]'), function (el) {
        el.addEventListener('change', function () { sync(); setErr('field-' + (n === 'paymentMethod' ? 'payment' : n), false); });
      });
    });
    sync();
    $('brandForm').addEventListener('submit', function (e) {
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
  });
})();
