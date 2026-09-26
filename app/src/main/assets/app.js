'use strict';
const C=DockCore, $=s=>document.querySelector(s), native=window.DockNative;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state, screen='record', selected=null, editing=false, onlyChanged=false, settingsDraft, brokenRaw=null;
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',3500);}
function persist(){
  try {
    const raw=JSON.stringify(state);
    if(native){if(!native.save(raw))throw new Error('저장 실패');}
    else localStorage.setItem('dock-notes-v1',raw);
    const status=$('#save-status');if(status)status.textContent='기기에 임시 저장됨';
    return true;
  }catch(e){const status=$('#save-status');if(status)status.textContent='저장 실패 — 공간을 확인하고 다시 저장해 주세요';toast('저장하지 못했습니다. 앱을 닫지 말고 백업해 주세요.');return false;}
}
function current(){return editing?state.draft:(state.records.find(r=>r.id===selected)||state.records[state.records.length-1]);}
function change(r,row){return C.diff(row,r.baseline&&r.baseline[row.dock-1],r.corrections.includes(row.dock));}
function closeDialog(){$('#dialog').close();}
function modal(html){$('#dialog-body').innerHTML=html;if(!$('#dialog').open)$('#dialog').showModal();}
function confirmAction(title,body,label,action){modal(`<h2>${esc(title)}</h2><p>${esc(body)}</p><div class="actions"><button data-action="close">취소</button><button class="primary" id="confirm-action">${esc(label)}</button></div>`);$('#confirm-action').onclick=()=>{closeDialog();action();};}
function download(name,mime,content){
  if(native){native.exportFile(name,mime,content);return;}
  const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function copyRecord(){const text=C.text(current());if(native)native.copy(text);else navigator.clipboard.writeText(text).then(()=>toast('점검 기록을 복사했습니다')).catch(()=>download('dock-check.txt','text/plain',text));}
function openNew(){
  if(state.draft){editing=true;screen='record';onlyChanged=false;render();return;}
  const slot=C.suggest(new Date(),state.settings,state.records);
  modal(`<h2>다음 점검</h2><p>최근 Dock 1~20 기록을 그대로 가져옵니다.<br>점검 시간은 실제 입력 시각과 다를 수 있습니다.</p><label>업무 날짜<input id="new-date" type="date" value="${slot.date}"></label><label>점검 시간<select id="new-time">${state.settings.times.map(t=>`<option ${t===slot.time?'selected':''}>${t}</option>`).join('')}</select></label><p id="new-error" class="danger" role="alert"></p><div class="actions"><button data-action="close">취소</button><button class="primary" id="create-check">기록 불러오기 →</button></div>`);
  $('#create-check').onclick=()=>{
    try{
      state.draft=C.newRecord(state,$('#new-date').value,$('#new-time').value);
      if(!persist()){state.draft=null;return;}
      editing=true;onlyChanged=false;screen='record';closeDialog();render();window.scrollTo(0,0);
    }catch(e){$('#new-error').textContent=e.message;}
  };
}
function render(){
  $('#bottom').innerHTML='';
  if(screen==='settings'){renderSettings();return;}
  if(screen==='history'){renderHistory();return;}
  if(screen==='broken'){renderBroken();return;}
  const r=current();
  if(!r){
    $('#app').innerHTML=`<div class="intro"><div class="eyebrow">YOUR DAILY DOCK CHECK</div><h1>다음 점검도,<br>가볍게 시작하세요.</h1><p class="muted">이전 기록은 그대로.<br>달라진 부분만 고치면 됩니다.</p></div><div class="hero"><div class="hero-icon" aria-hidden="true">▤</div><h2>첫 점검을 시작해 볼까요?</h2><p class="muted">Dock 1~20을 한 화면에서 기록하세요.<br>구역 이름과 점검 시간은 설정에서 바꿀 수 있어요.</p><button class="primary wide" data-action="next">첫 점검 만들기 →</button></div><p class="smallprint">기록은 이 휴대전화에만 저장됩니다.<br>처음에는 빈 기록으로 시작합니다. 백업 파일이 있다면 메뉴에서 복원하세요.</p>`;
    return;
  }
  const changed=r.rows.filter(row=>change(r,row).fields.length).length;
  const latest=state.records[state.records.length-1];
  $('#app').innerHTML=`<section class="intro"><div class="eyebrow">${editing?'FIELD NOTES':'DOCK CHECK'}</div><div class="row between"><h1>${esc(r.time)}${r.time==='24:00'?' 마감':''}</h1><span class="pill">${editing?'작성 중':r.id===latest?.id?'최신 점검':'지난 점검'}</span></div><div class="timeline-label">${esc(r.date)} · ${['일','월','화','수','목','금','토'][new Date(r.date+'T12:00:00').getDay()]}요일</div><div class="summary"><span class="pill">20 Docks</span><span class="pill yellow count" id="change-count">${changed}곳 변경</span></div><p class="smallprint">전체 노랑 = 새 컨테이너 / 반출 · 부분 노랑 = 해당 항목 변경</p>${editing?'<div class="autosave" id="save-status">기기에 임시 저장됨</div>':`<div class="toolbar"><button data-action="filter" class="toggle ${onlyChanged?'active':''}">${onlyChanged?'전체 보기':'변경된 Dock만'}</button><button data-action="copy">전체 복사</button><button data-action="text">텍스트 저장</button></div>`}</section><div id="dock-list">${r.groups.map(g=>groupHtml(r,g)).join('')}</div>${onlyChanged&&!changed?'<div class="notice">이전 점검과 달라진 내용이 없습니다.</div>':''}`;
  $('#bottom').innerHTML=`<div class="footer"><div class="footer-inner">${editing?'<button class="primary" data-action="save">저장 · 점검 보기</button>':`${r.id===latest?.id&&!state.draft?'<button data-action="edit">수정</button>':'<button data-action="latest">최신 점검</button>'}<button class="primary" data-action="next">${state.draft?'작성 중인 점검 이어서 →':'다음 점검 →'}</button>`}</div></div>`;
}
function groupHtml(r,g){
  const rows=r.rows.filter(row=>row.dock>=g.start&&row.dock<=g.end&&(!onlyChanged||editing||change(r,row).fields.length));
  if(!rows.length)return '';
  return `<section class="group"><div class="group-title"><h3>${esc(g.name)}</h3><small>Dock ${g.start}${g.end!==g.start?'–'+g.end:''}</small></div>${rows.map(row=>rowHtml(r,row)).join('')}</section>`;
}
function rowHtml(r,row){
  const d=change(r,row), marked=f=>d.fields.includes(f)?'changed':'', empty=row.status==='Ready to drop';
  const field=(key,title,placeholder)=>`<label class="${marked(key)} ${key==='note'?'span2':''}">${title}<input data-field="${key}" data-dock="${row.dock}" value="${esc(row[key])}" maxlength="${key==='note'?2000:200}" placeholder="${placeholder}" ${empty&&key==='contents'?'disabled':''}></label>`;
  return `<article class="dock ${d.whole?'whole':''}" id="dock-${row.dock}"><div class="dock-head"><div class="dock-number">DOCK <b>${row.dock}</b></div><span class="change-tag" ${d.fields.length?'':'hidden'}>${d.whole?d.label:'항목 변경'}</span></div>${editing?`<div class="fields"><label class="span2 ${marked('container')}">컨테이너 번호<button class="wide" data-action="container" data-dock="${row.dock}">${esc(row.container)||'번호 입력 / 변경'}</button></label><label class="span2 ${marked('codes')}">아이템 코드 ${row.codes.length}/3${row.codes.map((code,i)=>`<span class="code-row"><input aria-label="Dock ${row.dock} 아이템 코드 ${i+1}" data-field="codes" data-index="${i}" data-dock="${row.dock}" value="${esc(code)}" maxlength="200" placeholder="아이템 코드" ${empty?'disabled':''}>${row.codes.length>1?`<button aria-label="코드 ${i+1} 삭제" data-action="remove-code" data-dock="${row.dock}" data-index="${i}">−</button>`:''}</span>`).join('')}${row.codes.length<3&&!empty?`<button class="link" data-action="add-code" data-dock="${row.dock}">+ 아이템 코드 추가</button>`:''}</label>${field('contents','내용물','자유롭게 입력')}<label class="${marked('status')}">상태<select data-field="status" data-dock="${row.dock}">${C.statuses.map(s=>`<option value="${s}" ${s===row.status?'selected':''}>${s||'상태 선택'}</option>`).join('')}</select></label>${field('note','메모','필요할 때만 입력')}</div>`:`<div class="read-main value ${marked('container')}">${esc(row.container)||`<span class="empty">${empty?'컨테이너 없음':'번호 미입력'}</span>`}</div>${row.codes.some(Boolean)?`<div class="read-meta value ${marked('codes')}">${row.codes.filter(Boolean).map(esc).join(' / ')}</div>`:''}${row.contents?`<div class="read-meta value ${marked('contents')}">${esc(row.contents)}</div>`:''}<div class="read-status ${marked('status')}">${esc(row.status)||'상태 미입력'}</div>${row.note?`<div class="read-meta value ${marked('note')}">${esc(row.note)}</div>`:''}`}${r.baseline&&d.fields.length?`<details class="previous"><summary>이전 점검 보기</summary><p>${esc(rowSummary(r.baseline[row.dock-1]))}</p></details>`:''}</article>`;
}
function rowSummary(row){return [row.container||'번호 없음',row.codes.filter(Boolean).join(' / '),row.contents,row.status||'상태 미입력',row.note].filter(Boolean).join(' · ');}
function refreshRow(n){const el=$('#dock-'+n);if(el)el.outerHTML=rowHtml(current(),current().rows[n-1]);refreshCount();}
function refreshCount(){const r=current();const el=$('#change-count');if(el)el.textContent=r.rows.filter(row=>change(r,row).fields.length).length+'곳 변경';}
function refreshMark(n){
  const row=current().rows[n-1],d=change(current(),row),el=$('#dock-'+n);
  el.classList.toggle('whole',d.whole);const tag=el.querySelector('.change-tag');tag.hidden=!d.fields.length;tag.textContent=d.whole?d.label:'항목 변경';
  el.querySelectorAll('[data-field]').forEach(input=>input.closest('label').classList.toggle('changed',d.fields.includes(input.dataset.field)));
  refreshCount();
}
function editContainer(n){
  const row=current().rows[n-1], before=row.container;
  modal(`<h2>Dock ${n} · 컨테이너</h2><label>컨테이너 번호<input id="container-value" value="${esc(before)}" maxlength="200" autocapitalize="characters" autocomplete="off"></label><p>다른 컨테이너가 왔다면 기존 코드·내용물·상태·메모를 비우고 새로 기록합니다.</p><div class="menu-list"><button class="primary" id="replace-container">${before?'새 컨테이너로 변경':'번호 입력'}</button>${before?'<button id="correct-container">같은 컨테이너 · 번호 정정</button>':''}<button data-action="close">취소</button></div><p id="container-error" class="danger" role="alert"></p>`);
  const apply=correction=>{
    const number=$('#container-value').value.trim();
    if(!number){$('#container-error').textContent='컨테이너가 나갔다면 상태를 Ready to drop으로 바꿔 주세요.';return;}
    if(C.normalized(number)!==C.normalized(before)){
      if(!correction && before.trim())Object.assign(row,{codes:[''],contents:'',status:'',note:''});
      const set=new Set(current().corrections);if(correction)set.add(n);else set.delete(n);current().corrections=[...set];
    }
    row.container=number;if(row.status==='Ready to drop')row.status='';persist();closeDialog();refreshRow(n);
  };
  $('#replace-container').onclick=()=>apply(false);if($('#correct-container'))$('#correct-container').onclick=()=>apply(true);
  $('#container-value').focus();
}
function saveCheck(){
  const snapshot=C.clone(state),r=state.draft;r.savedAt=new Date().toISOString();state.records.push(r);state.draft=null;
  if(!persist()){state=snapshot;return;}
  selected=r.id;editing=false;onlyChanged=false;render();window.scrollTo(0,0);toast('저장했습니다. 변경된 부분을 보고 엑셀에 반영하세요.');
}
function menu(){
  modal(`<h2>Dock Notes</h2><div class="menu-list"><button data-action="latest">최신 점검${state.draft?' / 작성 중':''}</button><button data-action="history">지난 점검 기록</button><button data-action="settings">점검 시간 · 구역 설정</button><button data-action="backup">전체 기록 백업 (JSON)</button><button data-action="restore">백업 복원</button><button data-action="all-text">모든 기록 텍스트 저장</button><button data-action="close">닫기</button></div><p class="smallprint">v0.1.0 · 오프라인 개인 기록장<br>실제 기록은 GitHub에 전송하지 않습니다.<br>앱 삭제 전에는 전체 백업을 저장해 주세요.</p>`);
}
function renderHistory(){
  $('#app').innerHTML=`<div class="eyebrow">HISTORY</div><h1>지난 점검</h1><p class="muted">${state.records.length}개 기록 · 이전 점검과의 변경 표시를 보존합니다.</p><button data-action="latest">← 최신 점검</button>${state.records.slice().reverse().map(r=>`<button class="history-item" data-action="record" data-id="${esc(r.id)}">${esc(r.date)} · ${esc(r.time)}<small>${r.rows.filter(row=>change(r,row).fields.length).length}곳 변경 · 기록 보기</small></button>`).join('')||'<p class="muted">저장한 점검이 없습니다.</p>'}`;
}
function renderSettings(){
  if(!settingsDraft)settingsDraft=C.clone(state.settings);
  $('#app').innerHTML=`<div class="eyebrow">PREFERENCES</div><h1>내 점검 설정</h1><p class="muted">변경한 설정은 다음에 만드는 점검부터 적용됩니다.</p><section class="settings-box"><h2>점검 시간</h2><label>시간마다 줄을 나눠 입력<textarea id="settings-times" rows="6">${esc(settingsDraft.times.join('\n'))}</textarea></label><p class="smallprint">예: 07:30 · 마감 점검은 24:00<br>시작 15분 전부터 해당 점검 시간을 제안합니다.</p><div class="section-label">근무 요일</div><div class="days">${['일','월','화','수','목','금','토'].map((d,i)=>`<label class="day"><input type="checkbox" data-day="${i}" ${settingsDraft.days.includes(i)?'checked':''}>${d}</label>`).join('')}</div></section><section class="settings-box"><h2>구역 제목과 Dock 범위</h2><p class="smallprint">제목 / 시작 번호 / 끝 번호<br>Dock 1~20을 빠짐없이 순서대로 포함해 주세요.</p><div id="group-editors">${settingsDraft.groups.map((g,i)=>`<div class="group-edit"><input aria-label="구역 ${i+1} 이름" data-group="${i}" data-key="name" value="${esc(g.name)}" maxlength="80"><input aria-label="구역 ${i+1} 시작 Dock" data-group="${i}" data-key="start" type="number" min="1" max="20" value="${g.start}"><input aria-label="구역 ${i+1} 끝 Dock" data-group="${i}" data-key="end" type="number" min="1" max="20" value="${g.end}"><button aria-label="구역 ${i+1} 삭제" data-action="remove-group" data-index="${i}">−</button></div>`).join('')}</div><button data-action="add-group">+ 구역 추가</button></section><p id="settings-error" class="danger" role="alert"></p><div class="notice">Dunnage도 다른 Dock과 동일하게 불러옵니다. 별도 입력 제한이나 엑셀 시간 규칙은 없습니다.</div>`;
  $('#bottom').innerHTML='<div class="footer"><div class="footer-inner"><button data-action="cancel-settings">취소</button><button class="primary" data-action="save-settings">설정 저장</button></div></div>';
}
function captureSettings(){
  settingsDraft.times=$('#settings-times').value.split(/[\n,]+/).map(t=>t.trim()).filter(Boolean);
  settingsDraft.days=[...document.querySelectorAll('[data-day]:checked')].map(e=>Number(e.dataset.day));
  document.querySelectorAll('[data-group]').forEach(e=>settingsDraft.groups[Number(e.dataset.group)][e.dataset.key]=e.dataset.key==='name'?e.value:Number(e.value));
}
function renderBroken(){
  $('#app').innerHTML='<h1>저장 기록 확인이 필요합니다</h1><p>저장된 내용을 읽지 못했습니다. 기존 데이터를 덮어쓰지 않았습니다.</p><div class="menu-list"><button data-action="raw-backup">원본 파일 보관</button><button data-action="restore">정상 백업 복원</button></div>';$('#menu').disabled=true;
}
window.receiveBackup=raw=>{
  try{
    const recovered=C.parseBackup(raw);
    confirmAction('백업을 복원할까요?',`${recovered.records.length}개 기록${recovered.draft?'과 작성 중인 점검':''}으로 현재 기기의 데이터를 교체합니다. 현재 기록이 필요하면 취소 후 먼저 백업해 주세요.`,'복원',()=>{
      const old=state;state=recovered;if(!persist()){state=old;return;}
      brokenRaw=null;$('#menu').disabled=false;editing=!!state.draft;selected=null;screen='record';onlyChanged=false;render();toast('백업을 복원했습니다');
    });
  }catch(e){toast('복원하지 않았습니다: '+e.message);}
};
window.handleBack=()=>{if($('#dialog').open){closeDialog();return;}if(screen==='settings'){confirmAction('설정을 닫을까요?','저장하지 않은 설정 변경은 취소됩니다.','닫기',()=>{settingsDraft=null;screen='record';render();});return;}if(screen!=='broken'){screen='record';selected=null;editing=!!state.draft;onlyChanged=false;render();toast(editing?'작성 내용은 임시 저장되어 있습니다.':'최신 점검입니다.');}};
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action,n=Number(b.dataset.dock);
  if(action==='close'){closeDialog();return;}
  if(action==='next'){openNew();return;}
  if(action==='save'){saveCheck();return;}
  if(action==='container'){editContainer(n);return;}
  if(action==='filter'){onlyChanged=!onlyChanged;render();return;}
  if(action==='copy'){copyRecord();return;}
  if(action==='text'){download(`dock-${current().date}-${current().time.replace(':','')}.txt`,'text/plain',C.text(current()));return;}
  if(action==='edit'){state.draft=state.records.pop();editing=true;onlyChanged=false;persist();render();return;}
  if(action==='add-code'||action==='remove-code'){const row=state.draft.rows[n-1];if(action==='add-code'&&row.codes.length<3)row.codes.push('');else if(action==='remove-code'&&row.codes.length>1)row.codes.splice(Number(b.dataset.index),1);persist();refreshRow(n);return;}
  if(action==='latest'){closeDialog();screen='record';selected=null;editing=!!state.draft;onlyChanged=false;render();window.scrollTo(0,0);return;}
  if(action==='record'){selected=b.dataset.id;editing=false;screen='record';onlyChanged=false;render();window.scrollTo(0,0);return;}
  if(action==='history'){closeDialog();screen='history';render();window.scrollTo(0,0);return;}
  if(action==='settings'){closeDialog();screen='settings';settingsDraft=null;render();window.scrollTo(0,0);return;}
  if(action==='cancel-settings'){settingsDraft=null;screen='record';render();return;}
  if(action==='add-group'||action==='remove-group'){captureSettings();if(action==='add-group'&&settingsDraft.groups.length<20)settingsDraft.groups.push({name:'새 구역',start:20,end:20});else if(action==='remove-group')settingsDraft.groups.splice(Number(b.dataset.index),1);renderSettings();return;}
  if(action==='save-settings'){
    captureSettings();try{C.validateSettings(settingsDraft);settingsDraft.times.sort((a,b)=>C.minutes(a)-C.minutes(b));const old=state.settings;state.settings=C.clone(settingsDraft);if(!persist()){state.settings=old;return;}settingsDraft=null;screen='record';render();toast('설정을 저장했습니다');}catch(err){$('#settings-error').textContent=err.message;}return;
  }
  if(action==='backup'){download(`dock-${C.dateKey(new Date())}.dock-backup.json`,'application/json',JSON.stringify(state,null,2));return;}
  if(action==='raw-backup'){download('dock-recovery.json','application/json',brokenRaw||'');return;}
  if(action==='all-text'){download('dock-history.txt','text/plain',state.records.map(C.text).join('\n\n────────────────\n\n'));return;}
  if(action==='restore'){closeDialog();if(native)native.importFile();else $('#import-file').click();}
});
document.addEventListener('input',e=>{
  const el=e.target,key=el.dataset.field;if(!key||key==='status'||!editing)return;
  const n=Number(el.dataset.dock),row=state.draft.rows[n-1];
  if(key==='codes')row.codes[Number(el.dataset.index)]=el.value;else row[key]=el.value;
  persist();refreshMark(n);
});
document.addEventListener('change',e=>{
  const el=e.target;if(el.dataset.field!=='status'||!editing)return;
  const n=Number(el.dataset.dock),row=state.draft.rows[n-1],value=el.value;
  if(value==='Ready to drop'&&(row.container||row.contents||row.codes.some(Boolean)||row.note)){
    el.value=row.status;
    confirmAction('컨테이너가 나갔나요?','현재 점검의 번호·아이템 코드·내용물·메모를 비웁니다. 이전 점검 기록은 유지됩니다.','컨테이너 없음',()=>{Object.assign(row,{container:'',codes:[''],contents:'',note:'',status:value});persist();refreshRow(n);});
  }else{row.status=value;persist();refreshRow(n);}
});
$('#menu').onclick=menu;
$('#import-file').onchange=async e=>{const file=e.target.files[0];if(file){if(file.size>20*1024*1024)toast('백업은 20MB 이하여야 합니다.');else window.receiveBackup(await file.text());}e.target.value='';};
try{const raw=native?native.load():localStorage.getItem('dock-notes-v1');brokenRaw=raw;state=raw?C.parseBackup(raw):C.initial();brokenRaw=null;editing=!!state.draft;}
catch(e){state=C.initial();screen='broken';}
render();
