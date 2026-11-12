/**
 * MUYI 문의함 → 구글 드라이브 매일 백업 (Google Apps Script)
 *
 * 설치 (한 번만):
 *  1. https://script.google.com → 기존 백업 프로젝트를 열고 코드 전체를 이 내용으로 교체 → 저장
 *  2. ⚙️ 프로젝트 설정 → 스크립트 속성: BACKUP_KEY (Supabase 문의함 프로젝트 Secret BACKUP_KEY와 같은 값)
 *  3. 함수 선택 setup → ▶ 실행 → 권한 허용
 *     → 매일 새벽 3~4시(KST) 자동 실행 + 첫 백업 1회 실행
 *
 * 결과: 내 드라이브 / MUYI 문의함 백업 /
 *         db/      muyi-YYYY-MM-DD.json.gz   (문의·상담 기록·관리자 등 전체, 최근 KEEP_DAYS일 보관)
 *         files/   attachments__contact__...  (문의 첨부·박람회 자료·사업자등록증, 새 파일만 추가, 삭제 안 함)
 * 첨부가 많아 한 번에 다 못 받으면 다음 실행 때 이어서 받습니다(실행 5분 제한 대비).
 * 실패하면 구글이 계정 메일로 오류 알림을 보냅니다.
 */
const CONFIG = {
  URL: 'https://pacyhanuwuizcxwoggen.supabase.co/functions/v1/backup-export',
  ROOT: 'MUYI 문의함 백업',
  KEEP_DAYS: 30,
  TIME_LIMIT_MS: 4.5 * 60 * 1000,
};

function setup() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'runBackup')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('runBackup').timeBased().everyDays(1).atHour(3).inTimezone('Asia/Seoul').create();
  runBackup();
}

function runBackup() {
  const started = Date.now();
  const key = PropertiesService.getScriptProperties().getProperty('BACKUP_KEY');
  if (!key) throw new Error('스크립트 속성 BACKUP_KEY가 없습니다 (설치 2단계)');

  const res = UrlFetchApp.fetch(CONFIG.URL, { method: 'post', headers: { 'x-backup-key': key }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('백업 서버 응답 ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  }
  const body = res.getContentText();
  const data = JSON.parse(body);

  const root = folder_(DriveApp.getRootFolder(), CONFIG.ROOT);
  const dbDir = folder_(root, 'db');
  const fileDir = folder_(root, 'files');

  // 1) DB 전체 (gzip)
  const day = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const name = 'muyi-' + day + '.json.gz';
  const old = dbDir.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true); // 같은 날 재실행 시 덮어쓰기
  dbDir.createFile(Utilities.gzip(Utilities.newBlob(body, 'application/json', 'muyi-' + day + '.json'), name));

  // 2) 첨부·사업자등록증: 아직 없는 파일만 (시간 제한 넘으면 다음 실행 때 이어서)
  let added = 0, pending = 0;
  (data.files || []).forEach((f) => {
    const fname = (f.bucket + '/' + f.path).split('/').join('__');
    if (fileDir.getFilesByName(fname).hasNext()) return;
    if (Date.now() - started > CONFIG.TIME_LIMIT_MS) { pending++; return; }
    const r = UrlFetchApp.fetch(f.url, { muteHttpExceptions: true });
    if (r.getResponseCode() === 200) { fileDir.createFile(r.getBlob().setName(fname)); added++; }
  });

  // 3) 오래된 DB 백업 정리 (파일은 지우지 않음)
  const cutoff = Date.now() - CONFIG.KEEP_DAYS * 864e5;
  const it = dbDir.getFiles();
  while (it.hasNext()) { const f = it.next(); if (f.getDateCreated().getTime() < cutoff) f.setTrashed(true); }

  if ((data.errors || []).length) throw new Error('일부 백업 실패: ' + data.errors.join(' / '));
  console.log('백업 완료', day, JSON.stringify(data.counts), '새 파일 ' + added + '건' + (pending ? ', 다음 실행 때 ' + pending + '건 이어서' : ''));
}

function folder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
