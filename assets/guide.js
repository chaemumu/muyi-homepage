/* 업종별 마케팅 가이드(/marketing/*) 공통 동작: 등장 모션 · 문제 강조 · FAQ · 하단 CTA · 무료 진단 폼
   폼은 local-business 와 같은 접수 주소(/functions/v1/contact)·필드로 보낸다 (muyi-monitor.js 감시 대상)
   /assets 는 1년 캐시: 고치면 scripts/build-guides.js 의 ASSET_V 를 올리고 다시 생성할 것 */
(function(){
  var IO='IntersectionObserver' in window;

  // 1) 등장 모션 + 문제 줄 강조
  var els=document.querySelectorAll('.rise,.pain li');
  if(!IO){els.forEach(function(e){e.classList.add('on');});}
  else{
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target);}});},{threshold:.15,rootMargin:'0px 0px -8% 0px'});
    els.forEach(function(e){io.observe(e);});
  }

  // 2) FAQ 아코디언 (한 번에 하나)
  var items=document.querySelectorAll('.faq-i');
  items.forEach(function(it){
    it.querySelector('.faq-q').addEventListener('click',function(){
      var open=!it.classList.contains('open');
      items.forEach(function(o){o.classList.remove('open');o.querySelector('.faq-q').setAttribute('aria-expanded','false');});
      if(open){it.classList.add('open');this.setAttribute('aria-expanded','true');}
    });
  });

  // 3) 하단 CTA: 폼이 보이면 숨김
  var dock=document.querySelector('.dock'),order=document.getElementById('order');
  if(dock&&order&&IO){new IntersectionObserver(function(es){dock.classList.toggle('off',es[0].isIntersecting);},{threshold:.15}).observe(order);}

  // 4) 광고 유입 정보 (local-business 와 같은 규칙: 첫 진입 UTM·클릭ID 를 세션에 저장)
  var UTM=['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
  var q=new URLSearchParams(location.search),a={},hit=false;
  UTM.concat(['fbclid','gclid']).forEach(function(k){var v=q.get(k);if(v){a[k]=v;hit=true;}});
  if(hit){a.landed_at=Date.now();try{sessionStorage.setItem('muyi_attr',JSON.stringify(a));}catch(e){}}
  function cookie(n){try{var m=document.cookie.match('(?:^|; )'+n+'=([^;]*)');return m?decodeURIComponent(m[1]):null;}catch(e){return null;}}
  function attribution(){
    var s=a;
    if(!hit){try{s=JSON.parse(sessionStorage.getItem('muyi_attr')||'{}');}catch(e){s={};}}
    var utm={};UTM.forEach(function(k){if(s[k])utm[k]=s[k];});
    return {utm:utm,click:{fbclid:s.fbclid||null,gclid:s.gclid||null,fbp:cookie('_fbp'),fbc:cookie('_fbc')||(s.fbclid?'fb.1.'+s.landed_at+'.'+s.fbclid:null)}};
  }

  // 5) 무료 진단 폼
  var form=document.getElementById('form');
  if(!form)return;
  var ind=form.dataset.industry||'',page=form.dataset.page||'',src=form.dataset.source||'local-business-diagnosis';
  var storeEl=document.getElementById('f-store'),phoneEl=document.getElementById('f-phone'),msgEl=document.getElementById('f-msg'),agreeEl=document.getElementById('f-agree');
  var fst=document.getElementById('fst'),sbtn=document.getElementById('sbtn'),label=sbtn.textContent;
  function say(t,m){fst.className='fst on '+t;fst.textContent=m;}
  phoneEl.addEventListener('input',function(){
    var d=phoneEl.value.replace(/[^0-9]/g,'').slice(0,11);
    phoneEl.value=d.length<4?d:d.length<8?d.slice(0,3)+'-'+d.slice(3):d.slice(0,3)+'-'+d.slice(3,d.length-4)+'-'+d.slice(-4);
  });
  form.addEventListener('submit',function(e){
    e.preventDefault();
    [storeEl,phoneEl,msgEl].forEach(function(el){el.classList.remove('bad');});
    var store=storeEl.value.trim(),msg=msgEl.value.trim();
    if(!store){storeEl.classList.add('bad');storeEl.focus();return say('err','상호명을 입력해주세요.');}
    if(phoneEl.value.replace(/[^0-9]/g,'').length<10){phoneEl.classList.add('bad');phoneEl.focus();return say('err','연락처를 정확히 입력해주세요.');}
    if(!msg){msgEl.classList.add('bad');msgEl.focus();return say('err','문의 내용을 입력해주세요.');}
    if(!agreeEl.checked){agreeEl.focus();return say('err','개인정보 수집·이용 동의가 필요합니다.');}
    sbtn.disabled=true;sbtn.textContent='전송 중...';say('ok','접수 중입니다...');
    var eid='mg-'+Date.now()+'-'+Math.random().toString(36).slice(2,8); /* 픽셀·CAPI·구글 광고 중복 집계 방지 */
    var attr=attribution();
    var body={name:store,store:store,phone:phoneEl.value.trim(),message:'[업종 가이드: '+page+'] '+msg,type:ind,industry:ind,source:src,utm:attr.utm,click:attr.click,event_id:eid,page_url:location.href};
    fetch('https://pacyhanuwuizcxwoggen.supabase.co/functions/v1/contact',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhY3loYW51d3VpemN4d29nZ2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTI2NDgsImV4cCI6MjA5MTI4ODY0OH0.oe39KUtwr-mZ4OsqWQT6Y3USpigQpD825IM14mIFEaY'},
      body:JSON.stringify(body)
    }).then(function(r){
      if(!r.ok)throw new Error('fail');
      if(typeof fbq==='function'){fbq('track','Lead',{content_category:ind,content_name:'guide-'+page},{eventID:eid});}
      if(typeof gtag==='function'){
        gtag('event','generate_lead',{event_category:'form',event_label:ind,method:'guide-'+page});
        gtag('event','conversion',{send_to:'AW-11170573795/eEDoCKW5_rkdEOPbxc4p',transaction_id:eid}); /* 홈페이지 무료진단 문의 (소상공인) */
      }
      form.reset();
      say('ok','진단 신청이 접수됐습니다. 영업일 기준 24시간 안에 연락드리겠습니다.');
    }).catch(function(){
      say('err','전송에 실패했습니다. 다시 시도해 주세요. 계속 안 되면 070-8833-8210 또는 카카오톡으로 연락 주세요.');
    }).finally(function(){sbtn.disabled=false;sbtn.textContent=label;});
  });
})();
