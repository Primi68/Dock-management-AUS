const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../app/src/main/assets/core.js');
const date=s=>new Date(s);
test('15-minute early checks select the intended scheduled time',()=>{
  const s=C.defaults();
  for(const [now,time] of [['2026-09-25T07:15:00','07:30'],['2026-09-25T09:14:59','07:30'],['2026-09-25T09:15:00','09:30'],['2026-09-25T11:40:00','11:30'],['2026-09-25T13:15:00','13:30']])assert.equal(C.suggest(date(now),s,[]).time,time);
});
test('Friday last check advances to Monday and skips unworked days',()=>{
  const r=[{date:'2026-09-25',time:'15:30'}];
  for(const now of ['2026-09-25T15:35:00','2026-09-26T08:00:00','2026-09-28T07:15:00'])assert.deepEqual(C.suggest(date(now),C.defaults(),r),{date:'2026-09-28',time:'07:30'});
});
test('midnight belongs to preceding business day when enabled',()=>{
  const s=C.defaults();s.times.push('24:00');
  assert.deepEqual(C.suggest(date('2026-09-26T00:05:00'),s,[]),{date:'2026-09-25',time:'24:00'});
});
test('a future saved check still advances instead of proposing an older record',()=>{
  assert.deepEqual(C.suggest(date('2026-09-25T15:35:00'),C.defaults(),[{date:'2026-09-28',time:'07:30'}]),{date:'2026-09-28',time:'09:30'});
});
test('missed checks are skipped and duplicate slots advance',()=>{
  assert.equal(C.suggest(date('2026-09-25T13:15:00'),C.defaults(),[{date:'2026-09-25',time:'07:30'}]).time,'13:30');
  assert.equal(C.suggest(date('2026-09-25T09:15:00'),C.defaults(),[{date:'2026-09-25',time:'09:30'}]).time,'11:30');
});
test('all twenty rows copy independently with clean highlighting',()=>{
  const s=C.initial(),r=C.newRecord(s,'2026-09-25','07:30');
  r.rows[8]={...r.rows[8],container:'DEMO-TRAILER-A',codes:['DEMO-ITEM-A'],status:'Full'};s.records.push(r);
  const next=C.newRecord(s,'2026-09-25','09:30');
  assert.equal(next.rows.length,20);assert.deepEqual(next.rows.map(x=>x.dock),Array.from({length:20},(_,i)=>i+1));
  assert.deepEqual(C.diff(next.rows[8],next.baseline[8]).fields,[]);
  next.rows[8].codes[0]='DEMO-ITEM-B';assert.equal(r.rows[8].codes[0],'DEMO-ITEM-A');assert.equal(next.baseline[8].codes[0],'DEMO-ITEM-A');
});
test('new container is whole-row, status-only is field-only, reversion removes marks',()=>{
  const old={...C.blankRow(1),container:'DEMO-A',status:'Full'},row=C.clone(old);
  row.status='Empty';assert.deepEqual(C.diff(row,old),{whole:false,label:'항목 변경',fields:['status']});
  row.status='Full';assert.equal(C.diff(row,old).fields.length,0);
  row.container='DEMO-B';assert.equal(C.diff(row,old).whole,true);assert.equal(C.diff(row,old,true).whole,false);
});
test('departure is distinct from an empty container',()=>{
  const before={...C.blankRow(1),container:'DEMO-A',status:'Full'};
  assert.equal(C.diff({...before,status:'Empty'},before).whole,false);
  assert.equal(C.diff({...C.blankRow(1),status:'Ready to drop'},before).label,'컨테이너 없음');
});
test('settings preserve complete ascending coverage with editable sections',()=>{
  const s=C.defaults();s.groups=[{name:'Custom',start:1,end:20}];C.validateSettings(s);
  s.groups[0].start=2;assert.throws(()=>C.validateSettings(s));
  assert.throws(()=>C.validateSettings({...C.defaults(),times:['07:30','07:30']}));
  assert.throws(()=>C.validateSettings({...C.defaults(),days:[]}));
});
test('backup round trip includes draft, baselines, historical headers, three codes',()=>{
  const s=C.initial();s.records.push(C.newRecord(s,'2026-09-25','07:30'));s.draft=C.newRecord(s,'2026-09-25','09:30');
  s.draft.rows[0].codes=['DEMO-1','DEMO-2','DEMO-3'];
  assert.deepEqual(C.parseBackup(JSON.stringify(s)),s);
  const bad=C.clone(s);bad.draft.rows[0].codes.push('DEMO-4');assert.throws(()=>C.parseBackup(JSON.stringify(bad)));
  const duplicate=C.clone(s);duplicate.draft.date=duplicate.records[0].date;duplicate.draft.time=duplicate.records[0].time;assert.throws(()=>C.parseBackup(JSON.stringify(duplicate)));
  assert.throws(()=>C.parseBackup('{broken'));assert.throws(()=>C.parseBackup('{"schema":2}'));
});
test('invalid calendar dates and older or duplicate checks are rejected',()=>{
  const s=C.initial();s.records.push(C.newRecord(s,'2026-09-25','07:30'));
  for(const [d,t] of [['2026-09-25','07:30'],['2026-09-24','15:30'],['2026-02-30','07:30'],['2026-09-26','25:00']])assert.throws(()=>C.newRecord(s,d,t));
});
test('text export keeps order, all groups, Unicode notes, and change labels',()=>{
  const r=C.newRecord(C.initial(),'2026-09-25','07:30');r.rows[0].container='DEMO-A';r.rows[0].note='확인 필요';
  const text=C.text(r);assert.match(text,/확인 필요/);assert.match(text,/새 컨테이너/);assert.ok(text.indexOf('Tires')<text.indexOf('Wheels'));assert.match(text,/\n20\n/);
});
test('historical edit draft can restart without replacing the saved original',()=>{
  const s=C.initial();s.records.push(C.newRecord(s,'2026-09-25','07:30'));s.records.push(C.newRecord(s,'2026-09-25','09:30'));
  s.draft={...C.clone(s.records[0]),editOf:s.records[0].id};s.draft.rows[0].status='Full';
  const restored=C.parseBackup(JSON.stringify(s));assert.equal(restored.records[0].rows[0].status,'');assert.equal(restored.draft.rows[0].status,'Full');
  s.draft.editOf='missing';assert.throws(()=>C.parseBackup(JSON.stringify(s)));
});
test('number-edit recovery payload is validated before restoring',()=>{
  const s=C.initial();s.draft=C.newRecord(s,'2026-09-25','07:30');s.draft.pendingContainers={'1':C.blankRow(1)};
  assert.equal(C.parseBackup(JSON.stringify(s)).draft.pendingContainers[1].dock,1);
  s.draft.pendingContainers={'99':C.blankRow(1)};assert.throws(()=>C.parseBackup(JSON.stringify(s)));
});
test('undo and redo restore a full dock operation including cleared fields',()=>{
  const r=C.newRecord(C.initial(),'2026-09-25','07:30');
  Object.assign(r.rows[0],{container:'DEMO-A',codes:['DEMO-I1','DEMO-I2'],status:'Full',contents:'demo',note:'check'});
  const before=C.clone(r.rows[0]);C.rememberEdit(r);Object.assign(r.rows[0],{container:'',codes:[''],status:'Ready to drop',contents:'',note:''});
  assert.equal(C.travelEdit(r),true);assert.deepEqual(r.rows[0],before);
  assert.equal(C.travelEdit(r,true),true);assert.equal(r.rows[0].status,'Ready to drop');assert.equal(r.rows[0].container,'');
});
test('text edits coalesce, new edits invalidate redo, and history is bounded',()=>{
  const r=C.newRecord(C.initial(),'2026-09-25','07:30');
  C.rememberEdit(r);r.rows[0].note='D';C.rememberEdit(r,true);r.rows[0].note='DEMO';
  assert.equal(r.undoHistory.length,1);C.travelEdit(r);assert.equal(r.rows[0].note,'');
  C.rememberEdit(r);r.rows[0].note='different';assert.equal(C.travelEdit(r,true),false);
  for(let i=0;i<60;i++){C.rememberEdit(r);r.rows[0].note=String(i);}assert.equal(r.undoHistory.length,50);
});
test('draft undo and redo survive backup restore without changing saved records',()=>{
  const s=C.initial();s.records.push(C.newRecord(s,'2026-09-25','07:30'));
  s.draft={...C.clone(s.records[0]),editOf:s.records[0].id};C.rememberEdit(s.draft);s.draft.rows[0].status='Full';
  const restored=C.parseBackup(JSON.stringify(s));assert.equal(C.travelEdit(restored.draft),true);assert.equal(restored.draft.rows[0].status,'');assert.equal(restored.records[0].rows[0].status,'');
  assert.equal(C.travelEdit(C.parseBackup(JSON.stringify(restored)).draft,true),true);
});
test('malformed undo snapshots and time travel across saved records are rejected',()=>{
  const s=C.initial();s.records.push(C.newRecord(s,'2026-09-25','07:30'));s.draft=C.newRecord(s,'2026-09-25','09:30');C.rememberEdit(s.draft);
  s.draft.undoHistory[0].time='07:30';assert.throws(()=>C.parseBackup(JSON.stringify(s)));
  s.draft.undoHistory=[{rows:[]}];assert.throws(()=>C.parseBackup(JSON.stringify(s)));
});
