/* ===== app.js - صفحة الحجز مع Supabase ===== */

// ===== Supabase API =====
function sbFetch(path, method, body) {
  var opts = {
    method: method || 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(SUPABASE_URL + '/rest/v1/' + path, opts).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error(t); });
    return r.json();
  });
}

// ===== عناصر الواجهة =====
var form           = document.getElementById('booking-form');
var submitBtn      = document.getElementById('submit-btn');
var successOverlay = document.getElementById('success-overlay');
var successCloseBtn= document.getElementById('success-close-btn');
var bookingNumValue= document.getElementById('booking-number-value');
var companyInput   = document.getElementById('company-name');
var phoneInput     = document.getElementById('phone-number');
var nationalIdInput= document.getElementById('national-id');
var closedBanner   = document.getElementById('closed-banner');
var closedMessage  = document.getElementById('closed-message');

// ===== التحقق من وقت العمل =====
function isServiceOpen(s) {
  if (!s || !s.enabled) return true;
  var now = new Date();
  var day = now.getDay();
  if (!s.days.includes(day)) return false;
  var fParts = s.from.split(':').map(Number);
  var tParts = s.to.split(':').map(Number);
  var cur  = now.getHours() * 60 + now.getMinutes();
  var from = fParts[0] * 60 + fParts[1];
  var to   = tParts[0] * 60 + tParts[1];
  return cur >= from && cur < to;
}

function applySchedule(s) {
  var open = isServiceOpen(s);
  if (open) {
    closedBanner.style.display = 'none';
    form.style.display = 'flex';
  } else {
    closedBanner.style.display = 'flex';
    form.style.display = 'none';
    if (s && s.message) {
      closedMessage.textContent = s.message;
    } else if (s && s.enabled) {
      var dayNames = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
      var daysText = s.days.map(function(d) { return dayNames[d]; }).join(' والـ');
      closedMessage.textContent = 'الخدمة متاحة أيام ' + daysText + ' من ' + s.from + ' حتى ' + s.to;
    }
  }
}

// ===== تحميل الجدول من Supabase =====
function loadSchedule() {
  sbFetch('schedule?id=eq.1&select=settings')
    .then(function(rows) {
      var s = (rows && rows[0]) ? rows[0].settings : null;
      applySchedule(s);
    })
    .catch(function() {
      // في حالة فشل الاتصال، اظهر الفورم
      applySchedule(null);
    });
}

loadSchedule();
setInterval(loadSchedule, 60000);

// ===== دوال التحقق =====
function validateName(v)       { return v.trim().length >= 2; }
function validatePhone(v)      { return /^[\d\+]{10,15}$/.test(v.replace(/\s/g, '')); }
function validateNationalId(v) { return /^\d{14}$/.test(v.trim()); }

function setError(groupId, inputEl, hasError) {
  var group = document.getElementById(groupId);
  group.classList.toggle('has-error', hasError);
  inputEl.classList.toggle('is-error', hasError);
  inputEl.classList.toggle('is-valid', !hasError);
}

companyInput.addEventListener('blur', function() {
  setError('group-company', companyInput, !validateName(companyInput.value));
});
phoneInput.addEventListener('blur', function() {
  setError('group-phone', phoneInput, !validatePhone(phoneInput.value));
});
nationalIdInput.addEventListener('input', function(e) {
  e.target.value = e.target.value.replace(/[^\d]/g, '');
});
nationalIdInput.addEventListener('blur', function() {
  setError('group-national-id', nationalIdInput, !validateNationalId(nationalIdInput.value));
});

// ===== إرسال النموذج =====
form.addEventListener('submit', function(e) {
  e.preventDefault();

  var nameVal       = companyInput.value;
  var phoneVal      = phoneInput.value;
  var nationalIdVal = nationalIdInput.value;

  var ok1 = validateName(nameVal);
  var ok2 = validatePhone(phoneVal);
  var ok3 = validateNationalId(nationalIdVal);

  setError('group-company',    companyInput,    !ok1);
  setError('group-phone',      phoneInput,      !ok2);
  setError('group-national-id',nationalIdInput, !ok3);

  if (!ok1 || !ok2 || !ok3) return;

  submitBtn.classList.add('is-loading');
  submitBtn.disabled = true;

  // حفظ في Supabase
  var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // الحصول على آخر رقم حجز
  sbFetch('bookings?select=booking_num&order=created_at.desc&limit=1')
    .then(function(rows) {
      var lastNum = 0;
      if (rows && rows.length > 0) {
        var m = rows[0].booking_num.match(/\d+/);
        if (m) lastNum = parseInt(m[0]);
      }
      var bookingNum = '#' + String(lastNum + 1).padStart(5, '0');

      return sbFetch('bookings', 'POST', {
        id: id,
        booking_num: bookingNum,
        name: nameVal.trim(),
        phone: phoneVal.trim(),
        national_id: nationalIdVal.trim()
      }).then(function() { return bookingNum; });
    })
    .then(function(bookingNum) {
      bookingNumValue.textContent = bookingNum;
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
      showSuccess();
    })
    .catch(function(err) {
      console.error(err);
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
      alert('حدث خطأ في الاتصال، تأكد من إعدادات Supabase');
    });
});

// ===== نافذة النجاح =====
function showSuccess() {
  successOverlay.classList.add('is-visible');
  document.body.style.overflow = 'hidden';
}
function closeSuccess() {
  successOverlay.classList.remove('is-visible');
  document.body.style.overflow = '';
  form.reset();
  [companyInput, phoneInput, nationalIdInput].forEach(function(inp) {
    inp.classList.remove('is-valid','is-error');
  });
  ['group-company','group-phone','group-national-id'].forEach(function(id) {
    document.getElementById(id).classList.remove('has-error');
  });
}
successCloseBtn.addEventListener('click', closeSuccess);
successOverlay.addEventListener('click', function(e) { if (e.target === successOverlay) closeSuccess(); });
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeSuccess(); });