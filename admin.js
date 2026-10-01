/* ===== admin.js - لوحة التحكم مع Supabase ===== */

const KEY_PASS    = 'admin_password';
const KEY_SESSION = 'admin_session';
const DEFAULT_PASS= 'admin123';

if (!localStorage.getItem(KEY_PASS)) localStorage.setItem(KEY_PASS, DEFAULT_PASS);

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
    var ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) return r.json();
    return [];
  });
}

document.addEventListener('DOMContentLoaded', function () {

  var loginScreen    = document.getElementById('login-screen');
  var dashboard      = document.getElementById('dashboard');
  var adminPassEl    = document.getElementById('admin-pass');
  var loginBtn       = document.getElementById('login-btn');
  var loginError     = document.getElementById('login-error');
  var logoutBtn      = document.getElementById('logout-btn');
  var togglePassBtn  = document.getElementById('toggle-pass');
  var menuToggle     = document.getElementById('menu-toggle');
  var sidebar        = document.getElementById('sidebar');
  var pageTitle      = document.getElementById('page-title');
  var pageTime       = document.getElementById('page-time');
  var topStatusPill  = document.getElementById('top-status-pill');
  var topStatusLabel = document.getElementById('top-status-label');
  var toastEl        = document.getElementById('toast');
  var confirmOverlay = document.getElementById('confirm-overlay');
  var confirmOkBtn   = document.getElementById('confirm-ok');
  var confirmCancelBtn = document.getElementById('confirm-cancel');

  if (localStorage.getItem(KEY_SESSION) === '1') showDashboard();
  else showLogin();

  function showLogin() {
    loginScreen.style.display = 'flex';
    dashboard.style.display = 'none';
    setTimeout(function() { adminPassEl && adminPassEl.focus(); }, 300);
  }

  function showDashboard() {
    loginScreen.classList.add('hidden');
    setTimeout(function() { loginScreen.style.display = 'none'; }, 400);
    dashboard.style.display = 'flex';
    initDashboard();
  }

  function doLogin() {
    var pass = adminPassEl.value.trim();
    if (pass === localStorage.getItem(KEY_PASS)) {
      localStorage.setItem(KEY_SESSION, '1');
      loginError.classList.remove('show');
      showDashboard();
    } else {
      loginError.classList.add('show');
      adminPassEl.value = '';
      adminPassEl.focus();
    }
  }

  loginBtn.addEventListener('click', doLogin);
  adminPassEl.addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });

  logoutBtn.addEventListener('click', function() {
    localStorage.removeItem(KEY_SESSION);
    location.reload();
  });

  togglePassBtn.addEventListener('click', function() {
    var isPass = adminPassEl.type === 'password';
    adminPassEl.type = isPass ? 'text' : 'password';
    document.getElementById('eye-icon').innerHTML = isPass
      ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
      : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  });

  // ===== Navigation =====
  var sections = ['overview','bookings','schedule','settings'];
  var titleMap = { overview:'نظرة عامة', bookings:'الحجوزات', schedule:'أوقات العمل', settings:'الإعدادات' };

  window.switchSection = function(name) {
    sections.forEach(function(s) {
      document.getElementById('section-'+s).classList.toggle('active', s===name);
      document.getElementById('nav-'+s).classList.toggle('active', s===name);
    });
    pageTitle.textContent = titleMap[name];
    if (window.innerWidth <= 768) sidebar.classList.remove('open');
  };

  document.querySelectorAll('.nav-item').forEach(function(item) {
    item.addEventListener('click', function(e) { e.preventDefault(); switchSection(item.dataset.section); });
  });
  menuToggle.addEventListener('click', function() { sidebar.classList.toggle('open'); });
  document.addEventListener('click', function(e) {
    if (window.innerWidth<=768 && !sidebar.contains(e.target) && !menuToggle.contains(e.target))
      sidebar.classList.remove('open');
  });

  // ===== Helpers =====
  var cachedSchedule = null;

  function getScheduleFromSupabase() {
    return sbFetch('schedule?id=eq.1&select=settings').then(function(rows) {
      cachedSchedule = (rows && rows[0]) ? rows[0].settings : { enabled:false, from:'08:00', to:'17:00', days:[0,1,2,3,4], message:'' };
      return cachedSchedule;
    });
  }

  function isServiceOpen(s) {
    if (!s || !s.enabled) return true;
    var now = new Date();
    var day = now.getDay();
    if (!s.days.includes(day)) return false;
    var fParts = s.from.split(':').map(Number);
    var tParts = s.to.split(':').map(Number);
    var cur  = now.getHours()*60 + now.getMinutes();
    return cur >= (fParts[0]*60+fParts[1]) && cur < (tParts[0]*60+tParts[1]);
  }

  function formatDateTime(iso) {
    if (!iso) return '--';
    var d = new Date(iso);
    return d.toLocaleDateString('ar-EG') + ' ' + d.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ===== Clock =====
  function updateClock() {
    var now = new Date();
    if (pageTime) pageTime.textContent = now.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'}) + ' | ' + now.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    var stEl = document.getElementById('status-time-now');
    if (stEl) stEl.textContent = now.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    if (cachedSchedule !== null) updateStatusUI(cachedSchedule);
  }

  function updateStatusUI(s) {
    var open = isServiceOpen(s);
    var dayNames = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    if (topStatusPill) { topStatusPill.classList.toggle('open',open); topStatusPill.classList.toggle('closed',!open); }
    if (topStatusLabel) topStatusLabel.textContent = open ? 'الخدمة متاحة' : 'الخدمة مغلقة';
    var circle = document.getElementById('status-circle');
    var bigLabel = document.getElementById('status-big-label');
    if (circle) { circle.classList.toggle('open',open); circle.classList.toggle('closed',!open); }
    if (bigLabel) bigLabel.textContent = open ? '✅ الخدمة متاحة الآن' : '🔴 الخدمة مغلقة الآن';
    var statCard = document.getElementById('stat-status-card');
    if (statCard) statCard.textContent = open ? 'مفتوحة' : 'مغلقة';
    var summary = document.getElementById('schedule-summary');
    if (summary) {
      if (!s || !s.enabled) { summary.textContent = 'أوقات العمل غير مفعّلة — الخدمة متاحة دائماً'; }
      else { summary.textContent = 'من '+s.from+' إلى '+s.to+'\n'+s.days.map(function(d){return dayNames[d];}).join(' - '); }
    }
  }

  // ===== Stats & Tables =====
  var allBookings = [];

  function loadBookings() {
    return sbFetch('bookings?select=*&order=created_at.asc').then(function(rows) {
      allBookings = rows || [];
      updateStats();
      renderRecentTable();
      renderAllTable(document.getElementById('search-input').value);
    }).catch(function(e) { console.error('bookings error', e); });
  }

  function updateStats() {
    var today = new Date().toDateString();
    var todayCount = allBookings.filter(function(b) { return new Date(b.created_at).toDateString()===today; }).length;
    document.getElementById('stat-total').textContent = allBookings.length;
    document.getElementById('stat-today').textContent = todayCount;
    document.getElementById('nav-badge').textContent  = allBookings.length;
    var lastEl = document.getElementById('stat-last');
    if (lastEl) lastEl.textContent = allBookings.length ? allBookings[allBookings.length-1].booking_num : '--';
  }

  function renderRecentTable() {
    var tbody  = document.getElementById('recent-tbody');
    var recent = allBookings.slice(-5).reverse();
    if (!recent.length) { tbody.innerHTML='<tr class="empty-row"><td colspan="5">لا توجد حجوزات بعد</td></tr>'; return; }
    tbody.innerHTML = recent.map(function(b) {
      return '<tr>'+
        '<td><span class="booking-num">'+b.booking_num+'</span></td>'+
        '<td><span class="company-name">'+escHtml(b.name)+'</span></td>'+
        '<td>'+escHtml(b.phone)+'</td>'+
        '<td style="font-family:monospace;letter-spacing:1px">'+escHtml(b.national_id||'')+'</td>'+
        '<td>'+formatDateTime(b.created_at)+'</td>'+
        '</tr>';
    }).join('');
  }

  function renderAllTable(filter) {
    filter = filter || '';
    var lower    = filter.toLowerCase();
    var filtered = filter ? allBookings.filter(function(b) {
      return b.name.toLowerCase().includes(lower) || b.phone.includes(lower);
    }) : allBookings.slice();

    var tbody = document.getElementById('all-tbody');
    document.getElementById('total-count').textContent = 'إجمالي: '+filtered.length+' حجز';
    if (!filtered.length) { tbody.innerHTML='<tr class="empty-row"><td colspan="6">لا توجد حجوزات</td></tr>'; return; }
    tbody.innerHTML = filtered.slice().reverse().map(function(b) {
      return '<tr id="row-'+b.id+'">'+
        '<td><span class="booking-num">'+b.booking_num+'</span></td>'+
        '<td><span class="company-name">'+escHtml(b.name)+'</span></td>'+
        '<td>'+escHtml(b.phone)+'</td>'+
        '<td style="font-family:monospace;letter-spacing:1px">'+escHtml(b.national_id||'')+'</td>'+
        '<td>'+formatDateTime(b.created_at)+'</td>'+
        '<td><button class="action-del" onclick="deleteBooking(\''+b.id+'\')">حذف</button></td>'+
        '</tr>';
    }).join('');
  }

  window.deleteBooking = function(id) {
    showConfirm('حذف الحجز','هل تريد حذف هذا الحجز نهائياً؟', function() {
      sbFetch('bookings?id=eq.'+id,'DELETE').then(function() {
        allBookings = allBookings.filter(function(b){return b.id!==id;});
        updateStats(); renderRecentTable();
        renderAllTable(document.getElementById('search-input').value);
        showToast('تم حذف الحجز','success');
      }).catch(function(){showToast('خطأ في الحذف','error');});
    });
  };

  document.getElementById('search-input').addEventListener('input', function(e) { renderAllTable(e.target.value); });

  document.getElementById('clear-all-btn').addEventListener('click', function() {
    if (!allBookings.length) { showToast('لا توجد حجوزات لحذفها','error'); return; }
    showConfirm('حذف جميع الحجوزات','هل تريد حذف جميع الحجوزات نهائياً؟ لا يمكن التراجع.', function() {
      sbFetch('bookings?id=neq.NULL','DELETE').then(function() {
        allBookings = [];
        updateStats(); renderRecentTable(); renderAllTable();
        showToast('تم حذف جميع الحجوزات','success');
      }).catch(function(){showToast('خطأ في الحذف','error');});
    });
  });

  document.getElementById('export-btn').addEventListener('click', function() {
    if (!allBookings.length) { showToast('لا توجد بيانات للتصدير','error'); return; }
    var header = ['رقم الحجز','الاسم','رقم الهاتف','الرقم القومي','التاريخ والوقت'];
    var rows = allBookings.map(function(b){ return [b.booking_num,b.name,b.phone,b.national_id,formatDateTime(b.created_at)]; });
    var csv = '\uFEFF'+[header].concat(rows).map(function(r){ return r.map(function(c){return '"'+c+'"';}).join(','); }).join('\n');
    var blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    var a = document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download='bookings_'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
    showToast('تم تصدير الملف بنجاح','success');
  });

  // ===== Schedule =====
  function loadScheduleForm(s) {
    document.getElementById('schedule-enabled').checked = s.enabled || false;
    document.getElementById('time-from').value  = s.from || '08:00';
    document.getElementById('time-to').value    = s.to   || '17:00';
    document.getElementById('custom-msg').value = s.message || '';
    document.querySelectorAll('input[name="day"]').forEach(function(cb) {
      cb.checked = (s.days||[]).includes(parseInt(cb.value));
    });
  }

  document.getElementById('save-schedule-btn').addEventListener('click', function() {
    var enabled = document.getElementById('schedule-enabled').checked;
    var from    = document.getElementById('time-from').value;
    var to      = document.getElementById('time-to').value;
    var message = document.getElementById('custom-msg').value.trim();
    var days    = Array.from(document.querySelectorAll('input[name="day"]:checked')).map(function(cb){return parseInt(cb.value);});

    if (enabled && !days.length) { showToast('الرجاء تحديد يوم عمل واحد على الأقل','error'); return; }
    if (enabled && from >= to)   { showToast('وقت البدء يجب أن يكون قبل وقت الانتهاء','error'); return; }

    var settings = { enabled:enabled, from:from, to:to, days:days, message:message };
    sbFetch('schedule?id=eq.1','PATCH',{settings:settings}).then(function() {
      cachedSchedule = settings;
      updateStatusUI(settings);
      showToast('تم حفظ إعدادات أوقات العمل ✓','success');
    }).catch(function(){showToast('خطأ في الحفظ، تأكد من إعدادات Supabase','error');});
  });

  // ===== Password =====
  document.getElementById('save-pass-btn').addEventListener('click', function() {
    var np=document.getElementById('new-pass').value, cp=document.getElementById('confirm-pass').value;
    var msg=document.getElementById('settings-msg');
    if (np.length<6) { msg.className='settings-msg err'; msg.textContent='كلمة المرور يجب أن تكون 6 أحرف على الأقل'; return; }
    if (np!==cp) { msg.className='settings-msg err'; msg.textContent='كلمتا المرور غير متطابقتين'; return; }
    localStorage.setItem(KEY_PASS,np);
    msg.className='settings-msg ok'; msg.textContent='تم تغيير كلمة المرور بنجاح ✓';
    document.getElementById('new-pass').value=''; document.getElementById('confirm-pass').value='';
    setTimeout(function(){msg.textContent='';},3000);
  });

  document.getElementById('reset-data-btn').addEventListener('click', function() {
    showConfirm('إعادة الضبط الكامل','سيتم حذف جميع البيانات نهائياً. هل أنت متأكد؟', function() {
      sbFetch('bookings?id=neq.NULL','DELETE').then(function() {
        localStorage.removeItem(KEY_SESSION);
        location.reload();
      });
    });
  });

  // ===== Confirm Modal =====
  var confirmCallback = null;
  function showConfirm(title,msg,cb) {
    document.getElementById('confirm-title').textContent=title;
    document.getElementById('confirm-msg').textContent=msg;
    confirmCallback=cb; confirmOverlay.classList.add('show');
  }
  confirmOkBtn.addEventListener('click',function(){ confirmOverlay.classList.remove('show'); if(confirmCallback){confirmCallback();confirmCallback=null;} });
  confirmCancelBtn.addEventListener('click',function(){ confirmOverlay.classList.remove('show'); confirmCallback=null; });

  // ===== Toast =====
  var toastTimer=null;
  function showToast(msg,type) {
    clearTimeout(toastTimer); toastEl.textContent=msg; toastEl.className='toast show '+(type||'success');
    toastTimer=setTimeout(function(){toastEl.classList.remove('show');},3000);
  }

  // ===== Init =====
  function initDashboard() {
    getScheduleFromSupabase().then(function(s) {
      loadScheduleForm(s);
      updateStatusUI(s);
    });
    loadBookings();
    setInterval(updateClock, 1000);
    setInterval(function() { loadBookings(); getScheduleFromSupabase(); }, 10000);
    updateClock();
  }

  initDashboard();

}); // end DOMContentLoaded