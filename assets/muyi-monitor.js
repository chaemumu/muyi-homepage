// 문의 접수 장애 감지 → 카카오워크 즉시 알림
// - contact 함수 / 첨부 업로드 요청이 실패(HTTP 오류·네트워크 오류)하면 고객 이름·연락처를 담아 알림
// - 브라우저 → 홈페이지 Supabase notify-alert (카카오워크 🐙 방)
// - Supabase 자체가 죽은 경우는 .github/workflows/health.yml(30분 점검, GitHub 실패 메일)이 잡는다
// - /assets 는 1년 캐시이므로 수정 시 페이지의 ?v= 값을 올릴 것
(function () {
  if (window.muyiAlert) return;
  var HP = 'https://pacyhanuwuizcxwoggen.supabase.co';
  var HP_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhY3loYW51d3VpemN4d29nZ2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTI2NDgsImV4cCI6MjA5MTI4ODY0OH0.oe39KUtwr-mZ4OsqWQT6Y3USpigQpD825IM14mIFEaY';
  var WATCH = [/\/functions\/v1\/contact(\?|$)/, /\/storage\/v1\/object\/attachments\//];

  var origFetch = window.fetch && window.fetch.bind(window);
  if (!origFetch) return;
  var sentAt = {};
  // 업로드 단계에서 실패하면 contact 본문이 없으므로, 페이지 입력칸에서 고객 정보를 읽어 보완
  // (박람회 페이지는 name 속성 없이 id만 있어서 둘 다 확인)
  function readLead() {
    var v = function (sel) {
      var els = document.querySelectorAll(sel);
      for (var i = 0; i < els.length; i++) if (els[i].value && String(els[i].value).trim()) return String(els[i].value).trim();
      return '';
    };
    var lead = { name: v('[name=name],#f-name'), phone: v('[name=phone],#f-phone,input[type=tel]'), email: v('[name=email],#f-email,input[type=email]') };
    return lead.name || lead.phone || lead.email ? lead : null;
  }

  function send(title, detail, lead) {
    if (!lead || (!lead.name && !lead.phone)) lead = readLead() || lead;
    var key = title + '|' + (lead && lead.phone || '');
    var now = Date.now();
    if (sentAt[key] && now - sentAt[key] < 60000) return;
    sentAt[key] = now;
    var payload = { system: '홈페이지 문의', title: title, detail: String(detail || '').slice(0, 400), page: location.href, lead: lead };
    origFetch(HP + '/functions/v1/notify-alert', {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: HP_KEY },
      body: JSON.stringify(payload)
    }).catch(function () {});
  }
  window.muyiAlert = send;

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var p = origFetch(input, init);
    if (!WATCH.some(function (re) { return re.test(url); })) return p;

    var isUpload = /\/storage\//.test(url);
    var lead = null;
    if (!isUpload && init && typeof init.body === 'string') {
      try { var b = JSON.parse(init.body); lead = { name: b.name, phone: b.phone, email: b.email, type: b.type, source: b.source }; } catch (e) {}
    }
    var what = isUpload ? '첨부파일 업로드 실패 (문의 미전송)' : '문의 전송 실패';
    return p.then(function (r) {
      if (!r.ok) {
        r.clone().text().then(function (t) { send(what + ' (HTTP ' + r.status + ')', t, lead); },
          function () { send(what + ' (HTTP ' + r.status + ')', '', lead); });
      }
      return r;
    }, function (err) {
      send(what + ' (네트워크 오류 — 고객 인터넷 문제일 수도 있음)', String(err && err.message || err), lead);
      throw err;
    });
  };
})();
