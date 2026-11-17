/**
 * After-event survey + raffle page. Posts to BACKEND_URL?action=feedback
 * as text/plain JSON (no CORS preflight), which writes into the Feedback tab.
 */
(function () {
  var cfg = EVENT_CONFIG;
  // Link to our own posted Google review. Leave '' to hide the link.
  var EXAMPLE_REVIEW_URL = '';
  var shot = { b64: '', name: '' };

  function $(id) { return document.getElementById(id); }
  function radio(n) { var el = document.querySelector('input[name="' + n + '"]:checked'); return el ? el.value : ''; }
  function setErr(id, bad) { var el = $(id); if (el) el.classList.toggle('invalid', !!bad); }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function showStatus(type, msg) {
    var b = $('statusBanner');
    b.className = 'status-banner show ' + type;
    b.textContent = msg;
    b.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function hideStatus() { $('statusBanner').className = 'status-banner'; }

  function collect() {
    return {
      name: $('name').value.trim().replace(/\s+/g, ' '),
      email: $('email').value.trim(),
      regId: $('regId').value,
      rating: Number(radio('rating')),
      enjoyed: $('enjoyed').value.trim(),
      better: $('better').value.trim(),
      join: radio('join'),
      ideas: $('ideas').value.trim(),
      reviewName: $('reviewName').value.trim(),
    };
  }

  function validate(v) {
    var ok = true;
    var check = function (id, bad) { setErr(id, bad); if (bad) ok = false; };
    check('field-name', !v.name);
    check('field-email', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email));
    check('field-rating', !v.rating);
    check('field-join', !v.join);
    check('field-reviewName', !!shot.b64 && !v.reviewName);
    check('field-dpa', !$('dpaCheckbox').checked);
    return ok;
  }

  function done(d, v) {
    hideStatus();
    $('feedbackForm').style.display = 'none';
    var html;
    if (d.raffleNo) {
      html = '<p>Your raffle number is</p><p class="raffle-no">' + esc(d.raffleNo) + '</p>' +
        '<p>' + (d.duplicate ? 'You already joined the raffle with this email.' :
        'We emailed it to ' + esc(v.email) + ' too.') + ' Our team checks each review screenshot before the draw. ' +
        'If you win, we will contact you through the email, mobile number or Facebook account you gave us when you registered.</p>';
    } else {
      html = '<p>' + (d.duplicate ? 'We already have your feedback. Thank you!' : 'We got your feedback. Thank you!') + '</p>' +
        '<p>To join the raffle, review Teaspoon Cafe Juan Luna on Google, then send this form again with the same email and your review screenshot.</p>';
    }
    $('successBody').innerHTML = html;
    $('successPanel').style.display = 'block';
    window.scrollTo({ top: $('successPanel').offsetTop - 20, behavior: 'smooth' });
  }

  function send(v) {
    var btn = $('submitBtn');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    var payload = Object.assign({}, v, {
      reviewScreenshotBase64: shot.b64,
      reviewScreenshotFilename: shot.name,
      dpaConsent: true,
      website: $('website').value,
    });
    fetch(cfg.BACKEND_URL + '?action=feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        btn.disabled = false;
        btn.textContent = 'Send My Feedback';
        if (!d.ok) { showStatus('error', d.error || 'Something went wrong. Please try again.'); return; }
        done(d, v);
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = 'Send My Feedback';
        showStatus('error', 'Network error. Please check your connection and try again.');
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    Array.prototype.forEach.call(document.querySelectorAll('.maxMb'), function (el) { el.textContent = cfg.MAX_SCREENSHOT_MB; });
    var m = /[?&]r=([A-Za-z0-9-]{1,40})/.exec(location.search);
    if (m) $('regId').value = m[1].toUpperCase();
    if (EXAMPLE_REVIEW_URL) {
      $('exampleCaption').innerHTML = '<a href="' + EXAMPLE_REVIEW_URL + '" target="_blank" rel="noopener">See our review on Google Maps</a>';
    }

    $('uploadBox').addEventListener('click', function () { $('screenshotInput').click(); });
    $('screenshotInput').addEventListener('change', function () {
      var f = this.files[0];
      if (!f) return;
      if (f.size > cfg.MAX_SCREENSHOT_MB * 1024 * 1024) {
        showStatus('error', 'File is too large. Max size is ' + cfg.MAX_SCREENSHOT_MB + 'MB.');
        this.value = '';
        return;
      }
      var r = new FileReader();
      r.onload = function () {
        shot.b64 = String(r.result).split(',')[1];
        shot.name = f.name;
        $('uploadPreview').src = r.result;
        $('uploadPreview').style.display = 'block';
        $('uploadBox').classList.add('has-file');
        $('uploadBoxText').textContent = 'Selected: ' + f.name;
      };
      r.readAsDataURL(f);
    });

    ['rating', 'join'].forEach(function (n) {
      Array.prototype.forEach.call(document.querySelectorAll('input[name="' + n + '"]'), function (el) {
        el.addEventListener('change', function () { setErr('field-' + n, false); });
      });
    });

    $('feedbackForm').addEventListener('submit', function (e) {
      e.preventDefault();
      hideStatus();
      var v = collect();
      if (!validate(v)) {
        showStatus('error', 'Please check the highlighted fields.');
        var first = document.querySelector('.invalid');
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      send(v);
    });
  });
})();
