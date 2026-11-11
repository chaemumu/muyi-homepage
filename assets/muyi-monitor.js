// 문의 접수 장애 감지 → 카카오워크 즉시 알림
// - contact 함수 / 첨부 업로드 요청이 실패(HTTP 오류·네트워크 오류)하면 고객 이름·연락처를 담아 알림
// - 1차: 홈페이지 Supabase notify-alert, 실패 시 2차: CRM Supabase kakaowork-notify (서로 다른 프로젝트라 한쪽 장애에도 도달)
// - /assets 는 1년 캐시이므로 수정 시 페이지의 ?v= 값을 올릴 것
(function () {
  if (window.muyiAlert) return;
  var HP = 'https://pacyhanuwuizcxwoggen.supabase.co';
  var HP_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhY3loYW51d3VpemN4d29nZ2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTI2NDgsImV4cCI6MjA5MTI4ODY0OH0.oe39KUtwr-mZ4OsqWQT6Y3USpigQpD825IM14mIFEaY';
  var CRM = 'https://npkpxlbcwmwlxqauevyv.supabase.co';
  var CRM_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wa3B4bGJjd213bHhxYXVldnl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMjg2MTIsImV4cCI6MjA4OTkwNDYxMn0.t3n2RvYdJd1_1Ay44V3MW7p2GqJDiocqgrmt0qIov88';
  var WATCH = [/\/functions\/v1\/contact(\?|$)/, /\/storage\/v1\/object\/attachments\//];

  var origFetch = window.fetch && window.fetch.bind(window);
  if (!origFetch) return;
  var sentAt = {};
  var lastLead = null; // 업로드 단계에서 실패하면 contact 본문이 없으므로, 제출된 폼 값으로 고객 정보를 보완

  document.addEventListener('submit', function (e) {
    var f = e.target, v = function (n) { var el = f.querySelector && f.querySelector('[name=' + n + ']'); return el && el.value ? String(el.value).trim() : ''; };
    var lead = { name: v('name'), phone: v('phone'), email: v('email') };
    if (lead.name || lead.phone || lead.email) lastLead = lead;
  }, true);

  function send(title, detail, lead) {
    lead = lead || lastLead;
    var key = title + '|' + (lead && lead.phone || '');
    var now = Date.now();
    if (sentAt[key] && now - sentAt[key] < 60000) return;
    sentAt[key] = now;
    var payload = { system: '홈페이지 문의', title: title, detail: String(detail || '').slice(0, 400), page: location.href, lead: lead };
    origFetch(HP + '/functions/v1/notify-alert', {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: HP_KEY },
      body: JSON.stringify(payload)
    }).then(function (r) { if (!r.ok) throw new Error('alert ' + r.status); }).catch(function () {
      var text = '🚨 [홈페이지 문의 장애] ' + title +
        (lead ? '\n고객: ' + (lead.name || '-') + ' / ' + (lead.phone || '-') + '\n⚠️ 문의가 접수되지 않았을 수 있습니다. 직접 연락하세요.' : '') +
        (payload.detail ? '\n내용: ' + payload.detail : '') + '\n위치: ' + payload.page;
      origFetch(CRM + '/functions/v1/kakaowork-notify', {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', apikey: CRM_KEY, Authorization: 'Bearer ' + CRM_KEY },
        body: JSON.stringify({ type: 'alert', data: { message: text } })
      }).catch(function () {});
    });
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
