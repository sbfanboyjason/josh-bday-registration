/**
 * Team dashboard. Signs in with the check-in PIN (?action=checkin, op
 * "login"), then talks to ?action=dash (backend/Dashboard.gs).
 *
 *   Overview      budget, headcount, how many paid heads cover the free passes
 *   Registrants   paid registrations (read-only here; status is managed in the sheet)
 *   Guests / Admin / Volunteers
 *                 free passes: add, remove, show QR, email QR (Admin role only)
 */
(function () {
  'use strict';

  var cfg = typeof EVENT_CONFIG !== 'undefined' ? EVENT_CONFIG : {};
  var BASE = cfg.BACKEND_URL || '';
  var SESSION_KEY = 'gameTimeStaffSession'; // same key as the scanner, so one sign-in covers both
  var REFRESH_MS = 60000;
  var TYPES = ['Registrant', 'Guest', 'Admin', 'Volunteer'];
  var FREE_TYPES = ['Guest', 'Admin', 'Volunteer'];

  var session = null;
  var budget = null;
  var currentTab = 'overview';
  var listCache = {}; // type -> rows
  var refreshTimer = null;
  var pendingRemove = null;

  function $(id) { return document.getElementById(id); }

  function peso(n) {
    var v = Math.round(Number(n) || 0);
    return (v < 0 ? '-₱' : '₱') + Math.abs(v).toLocaleString('en-PH');
  }
  function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 3200);
  }

  function showError(msg) {
    var b = $('globalError');
    b.textContent = msg;
    b.hidden = !msg;
  }

  // ---------- session ----------
  function loadSession() {
    try {
      var s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (s && s.token && s.exp > Date.now()) return s;
    } catch (e) {}
    return null;
  }
  function saveSession(s) {
    session = s;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function clearSession() {
    session = null;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    clearInterval(refreshTimer);
  }
  function isAdmin() { return session && session.role === 'Admin'; }

  // ---------- network ----------
  // text/plain avoids a CORS preflight, which Apps Script web apps can't answer.
  function post(action, body, timeoutMs) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 30000) : null;
    return fetch(BASE + '?action=' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (r) { return r.json(); })
      .catch(function (err) {
        return { ok: false, code: 'NETWORK', error: err && err.name === 'AbortError' ? 'The server took too long. Try again.' : 'Network problem. Check your signal and try again.' };
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  function dash(op, data) {
    var body = Object.assign({ op: op, token: session && session.token }, data || {});
    return post('dash', body).then(function (res) {
      if (!res.ok && res.code === 'AUTH') {
        clearSession();
        showLogin('Your session ended. Sign in again.');
      }
      return res;
    });
  }

  // ---------- sign in ----------
  function showLogin(msg) {
    $('appView').hidden = true;
    $('loginView').hidden = false;
    $('loginError').textContent = msg || '';
    setTimeout(function () { $('pinInput').focus(); }, 50);
  }

  function setupLogin() {
    $('loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var pin = $('pinInput').value.trim();
      if (!/^\d{6}$/.test(pin)) {
        $('loginError').textContent = 'Enter your 6-digit PIN.';
        return;
      }
      $('loginBtn').disabled = true;
      $('loginError').textContent = '';
      post('checkin', { op: 'login', pin: pin }).then(function (res) {
        $('loginBtn').disabled = false;
        $('pinInput').value = '';
        if (!res.ok) {
          $('loginError').textContent = res.error || 'Could not sign in.';
          return;
        }
        saveSession({
          token: res.token,
          name: res.staff.name,
          role: res.staff.role,
          exp: Date.now() + (res.expiresInSeconds - 60) * 1000,
        });
        startApp();
      });
    });
    $('logoutBtn').addEventListener('click', function () {
      if (session) post('checkin', { op: 'logout', token: session.token });
      clearSession();
      showLogin('Signed out.');
    });
  }

  // ---------- tabs ----------
  function setupTabs() {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (btn) {
      btn.addEventListener('click', function () { selectTab(btn.getAttribute('data-tab')); });
    });
  }

  function selectTab(tab) {
    currentTab = tab;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      var on = b.getAttribute('data-tab') === tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('tab-overview').hidden = tab !== 'overview';
    $('tab-list').hidden = tab === 'overview';
    if (tab === 'overview') {
      loadOverview();
    } else {
      setupListView(tab);
      loadList(tab);
    }
  }

  // ---------- overview ----------
  function loadOverview() {
    return dash('overview').then(function (res) {
      if (!res.ok) { if (res.code !== 'AUTH') showError(res.error); return; }
      showError('');
      budget = res.budget;
      renderOverview(res);
      renderCounts();
    });
  }

  function renderCounts() {
    if (!budget) return;
    $('countGuest').textContent = budget.free.Guest || '';
    $('countAdmin').textContent = budget.free.Admin || '';
    $('countVolunteer').textContent = budget.free.Volunteer || '';
    var paid = budget.paidConfirmed + budget.paidPending;
    $('countRegistrant').textContent = paid || '';
  }

  function renderOverview(res) {
    var b = res.budget;

    // Verdict
    var card = $('verdictCard');
    card.classList.toggle('ok', b.covered);
    card.classList.toggle('short', !b.covered);
    if (b.covered) {
      $('verdictLabel').textContent = 'Free passes covered';
      $('verdictAmount').textContent = '+' + peso(b.surplus);
      $('verdictSub').textContent = b.freeTotal
        ? 'Verified payments already pay for all ' + b.freeTotal + ' free ' + plural(b.freeTotal, 'pass', 'passes') + '.'
        : 'No free passes yet.';
    } else {
      $('verdictLabel').textContent = 'Short right now';
      $('verdictAmount').textContent = peso(b.surplus);
      $('verdictSub').textContent =
        b.morePaidNeeded === null
          ? 'The fee does not leave any margin over the venue cost.'
          : 'Need ' + b.morePaidNeeded + ' more verified paid ' + plural(b.morePaidNeeded, 'head') + ' to cover the free passes.';
    }

    // Headcount meter
    var cap = b.capacity || 1;
    var w = function (n) { return Math.max(0, Math.min(100, (n / cap) * 100)) + '%'; };
    var segs = document.querySelectorAll('#meter .seg');
    segs[0].style.width = w(b.paidConfirmed);
    segs[1].style.width = w(b.paidPending);
    segs[2].style.width = w(b.freeTotal);
    $('capLabel').textContent = b.headcountWithPending + ' of ' + b.capacity + ' seats';
    $('hcPaid').textContent = b.paidConfirmed;
    $('hcPending').textContent = b.paidPending;
    $('hcFree').textContent = b.freeTotal;
    $('hcLeft').textContent = b.seatsLeft;
    $('hcGuest').textContent = b.free.Guest;
    $('hcAdmin').textContent = b.free.Admin;
    $('hcVolunteer').textContent = b.free.Volunteer;
    $('hcIn').textContent = b.checkedIn;

    // Money
    $('lnCollected').textContent = peso(b.collected);
    $('lnCollectedHow').textContent = b.paidConfirmed + ' paid × ' + peso(b.fee);
    $('lnBill').textContent = peso(b.venueBill);
    $('lnBillHow').textContent = b.headcountConfirmed + ' heads × ' + peso(b.costPerHead);
    var s = $('lnSurplus');
    s.textContent = peso(b.surplus);
    s.className = b.surplus < 0 ? 'neg' : 'pos';
    $('projection').textContent = b.paidPending
      ? 'If the ' + b.paidPending + ' pending ' + plural(b.paidPending, 'payment') + ' all get verified: ' + peso(b.surplusWithPending) + '.'
      : 'No payments waiting for verification.';

    // Coverage
    $('cvFree').textContent = b.freeTotal;
    $('cvCost').textContent = peso(b.freeCost);
    $('cvNeeded').textContent = b.paidNeededToCover === null ? 'n/a' : b.paidNeededToCover;
    $('cvMore').textContent = b.morePaidNeeded === null ? 'n/a' : b.morePaidNeeded;
    $('cvAfford').textContent = b.freePassesAffordableNow;

    var rule = $('ruleBox');
    var perPass = b.marginPerPaid > 0 ? (b.costPerHead / b.marginPerPaid) : null;
    var text =
      'Each paid head leaves ' + peso(b.marginPerPaid) + ' after the venue’s ' + peso(b.costPerHead) + '. ' +
      (perPass ? 'So one free pass needs about ' + perPass.toFixed(1) + ' paid heads. ' : '') +
      'If all ' + b.capacity + ' seats fill, the most free passes the fees can cover is ' + b.maxFreeIfSoldOut + '.';
    if (!b.coverableIfSoldOut) {
      text = 'Even a sold-out venue cannot cover ' + b.freeTotal + ' free passes. The most a full house covers is ' +
        b.maxFreeIfSoldOut + '. Anything above that comes out of pocket or sponsors. ' + text;
    }
    rule.textContent = text;
    rule.classList.toggle('warn', !b.coverableIfSoldOut);

    $('updatedAt').textContent = 'Updated ' + res.generatedAt + ' · refreshes every minute';
  }

  // ---------- lists ----------
  function setupListView(type) {
    var free = FREE_TYPES.indexOf(type) !== -1;
    $('addCard').hidden = !(free && isAdmin());
    $('viewOnlyNote').hidden = !(free && !isAdmin());
    $('addTitle').textContent = 'Add ' + (type === 'Admin' ? 'an Admin' : 'a ' + type) + ' pass';
    $('addError').textContent = '';
    $('showCancelledWrap').querySelector('span').textContent = free ? 'Show removed passes' : 'Show rejected, cancelled and expired';
    $('listSearch').value = '';
    renderImpact();
    renderList();
  }

  function loadList(type) {
    $('listSummary').textContent = listCache[type] ? '' : 'Loading…';
    return dash('list', { type: type }).then(function (res) {
      if (!res.ok) { if (res.code !== 'AUTH') showError(res.error); return; }
      showError('');
      listCache[type] = res.rows;
      if (currentTab === type) renderList();
    });
  }

  function statusPill(row) {
    if (row.checkedIn) return ['Checked in', 'pill-in'];
    switch (row.status) {
      case 'Approved': return [FREE_TYPES.indexOf(row.type) !== -1 ? 'Active' : 'Verified', 'pill-ok'];
      case 'Pending Payment Verification': return ['Pending', 'pill-pending'];
      case 'Payment Mismatch - Awaiting Correction': return ['Mismatch', 'pill-bad'];
      case 'Cancelled': return [FREE_TYPES.indexOf(row.type) !== -1 ? 'Removed' : 'Cancelled', 'pill-muted'];
      case 'Rejected': return ['Rejected', 'pill-muted'];
      case 'Expired - Auto-Released': return ['Expired', 'pill-muted'];
      default: return [row.status || '?', 'pill-muted'];
    }
  }

  function isActive(row) {
    return ['Approved', 'Pending Payment Verification', 'Payment Mismatch - Awaiting Correction'].indexOf(row.status) !== -1;
  }

  function renderList() {
    var type = currentTab;
    var rows = listCache[type];
    var ul = $('peopleList');
    ul.textContent = '';
    if (!rows) { $('listEmpty').hidden = true; return; }

    var q = $('listSearch').value.trim().toLowerCase();
    var showAll = $('showCancelled').checked;
    var shown = rows.filter(function (r) {
      if (!showAll && !isActive(r)) return false;
      if (!q) return true;
      return (r.firstName + ' ' + r.lastName + ' ' + r.regId).toLowerCase().indexOf(q) !== -1;
    });

    var active = rows.filter(isActive);
    var heads = active.reduce(function (a, r) { return a + r.qty; }, 0);
    var free = FREE_TYPES.indexOf(type) !== -1;
    $('listSummary').textContent = free
      ? active.length + ' active ' + plural(active.length, 'pass', 'passes') + (budget ? ' · ' + peso(active.length * budget.costPerHead) + ' venue cost' : '')
      : active.length + ' active ' + plural(active.length, 'registration') + ' · ' + heads + ' ' + plural(heads, 'head');

    $('listEmpty').hidden = shown.length > 0;

    shown.forEach(function (r) {
      var li = document.createElement('li');
      li.className = 'person' + (isActive(r) ? '' : ' inactive');

      var name = document.createElement('div');
      name.className = 'person-name';
      name.textContent = r.lastName ? r.lastName + ', ' : '';
      var first = document.createElement('span');
      first.className = 'first';
      first.textContent = r.firstName || r.name;
      name.appendChild(first);

      var pillInfo = statusPill(r);
      var pill = document.createElement('span');
      pill.className = 'pill ' + pillInfo[1];
      pill.textContent = pillInfo[0];

      var meta = document.createElement('div');
      meta.className = 'person-meta';
      var bits = [r.regId];
      if (!free) bits.push(r.qty + ' ' + plural(r.qty, 'head'));
      if (r.email) bits.push(r.email);
      if (r.phone) bits.push(r.phone);
      if (free && r.note) {
        var lastNote = r.note.split('\n').pop();
        bits.push(lastNote);
      }
      meta.textContent = bits.join(' · ');

      li.appendChild(name);
      li.appendChild(pill);
      li.appendChild(meta);

      if (free && isAdmin() && r.status === 'Approved' && r.key) {
        var actions = document.createElement('div');
        actions.className = 'person-actions';
        actions.appendChild(chip('Show QR', '', function () { openQr(r); }));
        if (r.email) actions.appendChild(chip('Email pass', '', function (btn) { resend(r, btn); }));
        if (!r.checkedIn) actions.appendChild(chip('Remove', 'danger', function () { openRemove(r); }));
        li.appendChild(actions);
      }
      ul.appendChild(li);
    });
  }

  function chip(label, extra, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip-btn' + (extra ? ' ' + extra : '');
    b.textContent = label;
    b.addEventListener('click', function () { onClick(b); });
    return b;
  }

  // ---------- add a free pass ----------
  function renderImpact() {
    var box = $('addImpact');
    if (!budget) { box.textContent = ''; return; }
    var after = budget.surplus - budget.costPerHead;
    var seatsAfter = budget.seatsLeft - 1;
    box.className = 'impact' + (after < 0 ? ' neg' : '');
    box.textContent =
      'Adding one costs ' + peso(budget.costPerHead) + '. Surplus goes from ' + peso(budget.surplus) + ' to ' + peso(after) +
      (seatsAfter >= 0 ? ', and ' + seatsAfter + ' ' + plural(seatsAfter, 'seat') + ' will be left.' : '. The venue is full.');
  }

  function setupAddForm() {
    $('addForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var type = currentTab;
      var first = $('addFirst').value.trim();
      var last = $('addLast').value.trim();
      if (!first || !last) {
        $('addError').textContent = 'First name and last name are both required.';
        return;
      }
      $('addError').textContent = '';
      $('addBtn').disabled = true;
      $('addBtn').textContent = 'Adding…';
      dash('addFree', {
        type: type,
        firstName: first,
        lastName: last,
        email: $('addEmail').value.trim(),
        phone: $('addPhone').value.trim(),
        note: $('addNote').value.trim(),
        sendEmail: $('addSendEmail').checked,
      }).then(function (res) {
        $('addBtn').disabled = false;
        $('addBtn').textContent = 'Add pass';
        if (!res.ok) {
          if (res.code !== 'AUTH') $('addError').textContent = res.error || 'Could not add.';
          return;
        }
        budget = res.budget;
        renderCounts();
        renderImpact();
        ['addFirst', 'addLast', 'addEmail', 'addPhone', 'addNote'].forEach(function (id) { $(id).value = ''; });
        var who = res.record.firstName + ' ' + res.record.lastName;
        toast(who + ' added as ' + res.record.regId + (res.emailed ? ', pass emailed' : ''));
        if (res.warning) showError(res.warning);
        listCache[type] = (listCache[type] || []).concat([res.record]);
        renderList();
        loadList(type);
        if (!res.emailed) openQr(res.record);
      });
    });
  }

  // ---------- QR / resend / remove ----------
  function openQr(r) {
    $('qrName').textContent = r.firstName + ' ' + r.lastName + ' · ' + r.type;
    $('qrId').textContent = r.regId;
    $('qrImg').src = 'https://api.qrserver.com/v1/create-qr-code/?size=520x520&margin=8&data=' + encodeURIComponent(r.key);
    $('qrModal').hidden = false;
  }

  function resend(r, btn) {
    btn.disabled = true;
    btn.textContent = 'Sending…';
    dash('resendPass', { key: r.key }).then(function (res) {
      btn.disabled = false;
      btn.textContent = 'Email pass';
      if (res.ok) toast('Pass emailed to ' + r.email);
      else if (res.code !== 'AUTH') toast(res.error || 'Could not send.');
    });
  }

  function openRemove(r) {
    pendingRemove = r;
    $('removeWho').textContent = r.firstName + ' ' + r.lastName + ' (' + r.regId + ', ' + r.type + ')';
    $('removeReason').value = '';
    $('removeError').textContent = '';
    $('removeModal').hidden = false;
  }

  function setupModals() {
    $('qrClose').addEventListener('click', function () { $('qrModal').hidden = true; });
    $('qrModal').addEventListener('click', function (e) { if (e.target.id === 'qrModal') $('qrModal').hidden = true; });
    $('removeCancel').addEventListener('click', function () { $('removeModal').hidden = true; });
    $('removeModal').addEventListener('click', function (e) { if (e.target.id === 'removeModal') $('removeModal').hidden = true; });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { $('qrModal').hidden = true; $('removeModal').hidden = true; }
    });
    $('removeConfirm').addEventListener('click', function () {
      if (!pendingRemove) return;
      var r = pendingRemove;
      $('removeConfirm').disabled = true;
      dash('removeFree', { key: r.key, reason: $('removeReason').value.trim() }).then(function (res) {
        $('removeConfirm').disabled = false;
        if (!res.ok) {
          if (res.code !== 'AUTH') $('removeError').textContent = res.error || 'Could not remove.';
          return;
        }
        $('removeModal').hidden = true;
        budget = res.budget;
        renderCounts();
        renderImpact();
        toast(r.firstName + ' ' + r.lastName + ' removed');
        loadList(currentTab);
      });
    });
  }

  // ---------- start ----------
  function refresh() {
    var btn = $('refreshBtn');
    btn.classList.add('spin');
    var p = currentTab === 'overview' ? loadOverview() : Promise.all([loadOverview(), loadList(currentTab)]);
    return p.then(function () { btn.classList.remove('spin'); }, function () { btn.classList.remove('spin'); });
  }

  function startApp() {
    $('loginView').hidden = true;
    $('appView').hidden = false;
    $('whoAmI').textContent = session.name + ' · ' + session.role;
    selectTab('overview');
    // Warm the tab counts and lists in the background.
    TYPES.forEach(function (t) { loadList(t); });
    clearInterval(refreshTimer);
    refreshTimer = setInterval(function () {
      if (!session || document.hidden) return;
      refresh();
    }, REFRESH_MS);
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupLogin();
    setupTabs();
    setupAddForm();
    setupModals();
    $('refreshBtn').addEventListener('click', refresh);
    $('listSearch').addEventListener('input', renderList);
    $('showCancelled').addEventListener('change', renderList);

    if (!BASE || BASE.indexOf('REPLACE_WITH') === 0) {
      showLogin('BACKEND_URL in assets/config.js is not set yet. See SETUP.md.');
      $('loginBtn').disabled = true;
      return;
    }
    session = loadSession();
    if (session) startApp();
    else showLogin('');
  });
})();
