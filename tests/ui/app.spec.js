const {test,expect}=require('@playwright/test');

async function settings(page,section='language-settings'){await page.locator('#menu').click();await page.getByRole('button',{name:/^(설정|Settings)$/}).click();await page.locator('[data-action="'+section+'"]').click();}
async function language(page,value){await settings(page);await page.locator('#settings-language').selectOption(value);await page.locator('[data-action="save-settings"]').click();}

test('English setting persists, restores from backup and preserves user text, drafts and undo history',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);await container(page,'DEMO-EN');
  await page.locator('#dock-1 [data-field="note"]').fill('메모');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')));
  await language(page,'en');await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.getByRole('button',{name:'Save · View check'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeEnabled();
  await expect(page.locator('#dock-1 .change-tag')).toHaveText('New container');
  await expect(page.locator('#save-status')).toHaveText('Draft saved on this device');
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')));
  expect(after.draft).toEqual(before.draft);expect(after.records).toEqual(before.records);expect(after.settings.groups).toEqual(before.settings.groups);
  await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('#dock-1 [data-field="note"]')).toHaveValue('메모');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('#dock-1 [data-field="note"]')).toHaveValue('');
  await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(page.locator('#dock-1 [data-field="note"]')).toHaveValue('메모');
  await page.getByRole('button',{name:'Save · View check'}).click();
  const backup=await page.evaluate(()=>localStorage.getItem('dock-notes-v1'));
  await page.locator('#dock-1 .dock-line').click();await expect(page.locator('#dialog')).toContainText('메모');await expect(page.locator('#dialog')).toContainText('New container');await page.getByRole('button',{name:'Close',exact:true}).click();
  await language(page,'ko');await expect(page.getByRole('button',{name:'다음 점검 →',exact:true})).toBeVisible();
  await page.evaluate(raw=>window.receiveBackup(raw),backup);await page.locator('#confirm-action').click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('#dock-1 .read-note')).toHaveText('메모');
  await page.locator('#menu').click();await page.getByRole('button',{name:'Check history',exact:true}).click();
  await expect(page.locator('.history-item small')).toHaveText('1 changed · View check');
  expect(errors).toEqual([]);
});

test('English schedule, validation, departure confirmation, exports and settings cancellation',async({page})=>{
  await page.goto('/');await language(page,'en');await expect(page.getByRole('button',{name:'Start first check →'})).toBeVisible();
  await page.getByRole('button',{name:'Start first check →'}).click();
  await page.getByRole('button',{name:'Change check date / time'}).click();
  await page.locator('#new-date').fill('');await page.getByRole('button',{name:'Apply time'}).click();
  await expect(page.locator('#new-error')).toHaveText('Check the date and inspection time.');
  await page.locator('#new-date').fill('2026-09-25');await page.locator('#new-time').selectOption('07:30');await page.getByRole('button',{name:'Apply time'}).click();
  await container(page,'DEMO-EN');await page.locator('#dock-1 [data-field="note"]').fill('메모');
  await page.locator('#dock-1 [data-field="status"]').selectOption('Ready to drop');
  await expect(page.getByRole('heading',{name:'Has the container left?'})).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('#dock-1 [data-field="container"]')).toHaveValue('DEMO-EN');
  await page.getByRole('button',{name:'Save · View check'}).click();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Save text',exact:true}).click();
  const download=await downloadPromise;const content=require('fs').readFileSync(await download.path(),'utf8');
  expect(content).toContain('DEMO-EN 메모 [New container]');
  await page.evaluate(()=>window.receiveBackup('{broken'));await expect(page.locator('#toast')).toHaveText('Not restored: The backup is not valid JSON.');
  await settings(page,'check-settings');await expect(page.locator('#settings-language')).toHaveCount(0);await page.locator('#settings-times').fill('invalid');await page.getByRole('button',{name:'Save settings'}).click();
  await expect(page.locator('#settings-error')).toHaveText('Enter 1–24 different valid check times.');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Language settings',exact:true}).click();await expect(page.locator('#settings-times')).toHaveCount(0);
  await page.locator('#settings-language').selectOption('ko');await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','en');
  await settings(page);await expect(page.locator('#settings-language')).toHaveValue('en');
  await page.locator('#toast').waitFor({state:'hidden'});
  await page.screenshot({path:'test-results/07-english-settings.png'});
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.locator('[data-action="leave-settings"]').click();await page.getByRole('button',{name:'Edit',exact:true}).click();
  await page.screenshot({path:'test-results/08-english-editing.png'});
  await page.setViewportSize({width:320,height:700});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
async function start(page){
  await page.goto('/');await page.getByRole('button',{name:'첫 점검 만들기'}).click();
  await expect(page.locator('.dock')).toHaveCount(20);
  await page.getByRole('button',{name:'날짜·점검 시간 수정'}).click();
  await page.locator('#new-date').fill('2026-09-25');await page.locator('#new-time').selectOption('07:30');
  await page.getByRole('button',{name:'시간 적용'}).click();
}
async function container(page,value){
  await page.locator('#dock-1 [data-field="container"]').fill(value);
  await page.locator('#dock-1 [data-field="container"]').press('Tab');
}
async function next(page,time){
  await page.getByRole('button',{name:'다음 점검 →',exact:true}).click();await expect(page.locator('.dock')).toHaveCount(20);await page.getByRole('button',{name:'날짜·점검 시간 수정'}).click();await page.locator('#new-date').fill('2026-09-25');await page.locator('#new-time').selectOption(time);await page.getByRole('button',{name:'시간 적용'}).click();
}
test('complete field workflow, carry-forward, highlight, restart and departure',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);await expect(page.locator('.dock')).toHaveCount(20);
  await expect(page.locator('.dock').first()).toHaveAttribute('id','dock-1');await expect(page.locator('.dock').last()).toHaveAttribute('id','dock-20');
  await container(page,'DEMO-TRAILER-A');await page.locator('#dock-1 [data-field="codes"]').fill('DEMO-ITEM-A');
  await page.locator('#dock-1 [data-field="status"]').selectOption('Full');
  await page.reload();await expect(page.locator('#dock-1 [data-field="codes"]')).toHaveValue('DEMO-ITEM-A');
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();
  await next(page,'09:30');await expect(page.locator('#dock-1')).not.toHaveClass(/whole/);
  await page.locator('#dock-1 [data-field="status"]').selectOption('Empty');
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();
  await expect(page.locator('#dock-1 .read-status')).toHaveClass(/changed/);await expect(page.locator('#dock-1')).not.toHaveClass(/whole/);
  await page.screenshot({path:'test-results/02-status-change.png',fullPage:false});
  await next(page,'11:30');await container(page,'DEMO-TRAILER-B');
  await expect(page.locator('#dock-1')).toHaveClass(/whole/);await expect(page.locator('#dock-1 [data-field="codes"]')).toHaveValue('DEMO-ITEM-A');await expect(page.locator('#dock-1 [data-field="status"]')).toHaveValue('Empty');
  await page.locator('#dock-1 [data-field="codes"]').fill('DEMO-ITEM-B');await page.locator('#dock-1 [data-field="status"]').selectOption('Full');await page.getByRole('button',{name:'저장 · 점검 보기'}).click();
  await page.screenshot({path:'test-results/03-container-change.png',fullPage:false});
  await next(page,'13:30');await page.locator('#dock-1 [data-field="status"]').selectOption('Ready to drop');await page.locator('#confirm-action').click();
  await expect(page.locator('#dock-1')).toHaveClass(/whole/);await expect(page.locator('#dock-1 [data-field="codes"]')).toBeEnabled();
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();await expect(page.locator('#dock-1 .read-main')).toHaveText('—');
  expect(errors).toEqual([]);
});
test('editable settings, header isolation, backups and history',async({page})=>{
  await start(page);await container(page,'DEMO-TRAILER-A');
  await page.locator('#dock-1 [data-action="add-code"]').click();await page.locator('#dock-1 [data-action="add-code"]').click();await expect(page.locator('#dock-1 [data-field="codes"]')).toHaveCount(3);
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();
  const backup=await page.evaluate(()=>localStorage.getItem('dock-notes-v1'));
  await settings(page,'check-settings');
  await page.locator('[data-group="0"][data-key="name"]').fill('Tires / revised');
  await page.locator('#settings-times').fill('07:30\n09:30\n11:30\n13:30\n15:30\n24:00');await page.getByRole('button',{name:'설정 저장'}).click();
  await expect(page.getByRole('heading',{name:'Tires',exact:true})).toBeVisible();
  await next(page,'09:30');await expect(page.getByRole('heading',{name:'Tires / revised'})).toBeVisible();
  await expect(page.locator('.group-title input')).toHaveCount(0);await page.getByRole('button',{name:'저장 · 점검 보기'}).click();
  await page.evaluate(raw=>window.receiveBackup(raw),backup);await page.locator('#confirm-action').click();
  await expect(page.locator('h1')).toHaveText('07:30');
  const before=await page.evaluate(()=>localStorage.getItem('dock-notes-v1'));await page.evaluate(()=>window.receiveBackup('{broken'));expect(await page.evaluate(()=>localStorage.getItem('dock-notes-v1'))).toBe(before);
  await page.locator('#menu').click();await page.getByRole('button',{name:'지난 점검 기록'}).click();await expect(page.locator('.history-item')).toHaveCount(1);
});
test('empty state and no horizontal overflow on narrow phones',async({page})=>{
  await page.goto('/');await page.screenshot({path:'test-results/01-welcome.png'});await start(page);
  await page.screenshot({path:'test-results/04-editing.png'});
  await page.setViewportSize({width:320,height:700});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('late number entry preserves observations and same-container typo correction preserves contents',async({page})=>{
  await start(page);
  await page.locator('#dock-1 [data-field="codes"]').fill('DEMO-LATE-CODE');
  await page.locator('#dock-1 [data-field="status"]').selectOption('Full');
  await container(page,'DEMO-NUMBER-LATE');
  await expect(page.locator('#dock-1 [data-field="codes"]')).toHaveValue('DEMO-LATE-CODE');
  await expect(page.locator('#dock-1 [data-field="status"]')).toHaveValue('Full');
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();await next(page,'09:30');
  await container(page,'DEMO-NUMBER-CORRECTED');await page.locator('#dock-1 [data-field="note"]').fill('demo note after number edit');await page.locator('#dock-1 [data-action="number-correction"]').click();
  await expect(page.locator('#dock-1')).not.toHaveClass(/whole/);await expect(page.locator('#dock-1 [data-field="codes"]')).toHaveValue('DEMO-LATE-CODE');
  await expect(page.locator('#dock-1 [data-field="note"]')).toHaveValue('demo note after number edit');
  await page.reload();await expect(page.locator('#dock-1')).not.toHaveClass(/whole/);
  await page.locator('#dock-1 [data-action="number-correction"]').click();await expect(page.locator('#dock-1')).toHaveClass(/whole/);
});
test('codes entered before a replacement number survive on every dock and after save and reload',async({page})=>{
  test.setTimeout(60000);
  await start(page);
  await page.evaluate(()=>{state.draft.rows.forEach(row=>Object.assign(row,{container:'DEMO-OLD-'+row.dock,codes:['DEMO-OLD-CODE'],status:'Empty'}));persist();render();});
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();await next(page,'09:30');
  const previous=await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')).records);
  for(let n=1;n<=20;n++){
    const dock=page.locator('#dock-'+n);
    await dock.locator('[data-field="codes"]').fill('DEMO-NEW-CODE-'+n);
    await dock.locator('[data-field="contents"]').fill('demo cargo');
    await dock.locator('[data-field="status"]').selectOption('Full');
    await dock.locator('[data-field="note"]').fill('demo note');
    await dock.locator('[data-field="container"]').fill('DEMO-NEW-'+n);await dock.locator('[data-field="container"]').press('Tab');
    for(const [field,value] of [['codes','DEMO-NEW-CODE-'+n],['contents','demo cargo'],['status','Full'],['note','demo note']])await expect(dock.locator('[data-field="'+field+'"]')).toHaveValue(value);
    await expect(dock).toHaveClass(/whole/);
  }
  const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')).draft);
  await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')).draft.rows)).toEqual(draft.rows);
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')));
  expect(saved.records[0]).toEqual(previous[0]);expect(saved.records[1].rows).toEqual(draft.rows);expect(saved.records[1].baseline).toEqual(previous[0].rows);
  await page.locator('[data-range="14-20"]').click();await page.screenshot({path:'test-results/09-wheel-numbers-preserve-codes.png'});
});

for(const [n,lang] of [[1,'ko'],[20,'en']])test(`explicit contents reset on Dock ${n} (${lang}) keeps the number and supports cancel, undo and redo`,async({page})=>{
  await start(page);if(lang==='en')await language(page,'en');
  const dock=page.locator('#dock-'+n);
  await dock.locator('[data-field="container"]').fill('DEMO-KEEP-NUMBER');
  await dock.locator('[data-field="codes"]').fill('DEMO-I1');await dock.locator('[data-action="add-code"]').click();await dock.locator('[data-field="codes"]').nth(1).fill('DEMO-I2');
  await dock.locator('[data-field="contents"]').fill('demo cargo');await dock.locator('[data-field="status"]').selectOption('Full');await dock.locator('[data-field="note"]').fill('demo note');
  const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')).draft.rows);
  await dock.locator('[data-action="clear-contents"]').click();
  await expect(page.locator('#dialog h2')).toHaveText(lang==='en'?`Clear contents for Dock ${n}?`:`Dock ${n} 내용을 초기화할까요?`);
  await page.locator('#dialog [data-action="close"]').click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')).draft.rows)).toEqual(original);
  await dock.locator('[data-action="clear-contents"]').click();await page.locator('#confirm-action').click();await page.reload();
  await expect(dock.locator('[data-field="container"]')).toHaveValue('DEMO-KEEP-NUMBER');
  for(const key of ['codes','contents','status','note'])await expect(dock.locator('[data-field="'+key+'"]')).toHaveValue('');
  await page.locator('[data-action="undo"]').click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')).draft.rows)).toEqual(original);
  await page.locator('[data-action="redo"]').click();await expect(dock.locator('[data-field="codes"]')).toHaveValue('');
  await expect(dock.locator('[data-field="container"]')).toHaveValue('DEMO-KEEP-NUMBER');
  if(lang==='en'){
    await page.setViewportSize({width:320,height:700});await dock.scrollIntoViewIfNeeded();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await dock.locator('[data-action="clear-contents"]').click();await page.screenshot({path:'test-results/10-confirm-clear-contents.png'});
  }
});

test('previous-version auto-clear recovery stays available without making number correction erase newer edits',async({page})=>{
  await start(page);await container(page,'DEMO-OLD');await page.locator('#dock-1 [data-field="codes"]').fill('DEMO-RECOVER');
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();await next(page,'09:30');
  await page.evaluate(()=>{const r=state.draft;r.containerUndo={1:C.clone(r.rows[0])};Object.assign(r.rows[0],{container:'DEMO-NEW',codes:['']});persist();});
  await page.reload();await page.locator('#dock-1 [data-field="note"]').fill('demo newer note');
  await page.locator('#dock-1 [data-action="number-correction"]').click();await expect(page.locator('#dock-1 [data-field="note"]')).toHaveValue('demo newer note');
  await page.locator('#dock-1 [data-action="restore-container"]').click();await page.locator('#dialog [data-action="close"]').click();await expect(page.locator('#dock-1 [data-field="note"]')).toHaveValue('demo newer note');
  await page.locator('#dock-1 [data-action="restore-container"]').click();await page.locator('#confirm-action').click();
  await expect(page.locator('#dock-1 [data-field="codes"]')).toHaveValue('DEMO-RECOVER');await expect(page.locator('#dock-1 [data-field="container"]')).toHaveValue('DEMO-NEW');
  await page.locator('[data-action="undo"]').click();await expect(page.locator('#dock-1 [data-field="note"]')).toHaveValue('demo newer note');await expect(page.locator('#dock-1 [data-action="restore-container"]')).toBeVisible();
});

test('ready to drop cancellation preserves data; confirmation clears every field and survives reload',async({page})=>{
  await start(page);await container(page,'DEMO-A');
  await page.locator('#dock-1 [data-field="codes"]').fill('DEMO-I');
  await page.locator('#dock-1 [data-field="contents"]').fill('demo cargo');
  await page.locator('#dock-1 [data-field="note"]').fill('demo note');
  await page.locator('#dock-1 [data-field="status"]').selectOption('Full');
  await page.locator('#dock-1 [data-field="status"]').selectOption('Ready to drop');
  await page.locator('#dialog [data-action="close"]').click();
  await expect(page.locator('#dock-1 [data-field="container"]')).toHaveValue('DEMO-A');
  await expect(page.locator('#dock-1 [data-field="status"]')).toHaveValue('Full');
  await page.locator('#dock-1 [data-field="status"]').selectOption('Ready to drop');await page.locator('#confirm-action').click();
  await page.reload();
  for(const key of ['container','codes','contents','note'])await expect(page.locator('#dock-1 [data-field="'+key+'"]')).toHaveValue('');
  await expect(page.locator('#dock-1 [data-field="status"]')).toHaveValue('Ready to drop');
});
test('accidental future draft can be cancelled and older saved inspections can be corrected safely',async({page})=>{
  await start(page);await container(page,'DEMO-A');await page.locator('#dock-1 [data-field="status"]').selectOption('Full');
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();
  for(const time of ['09:30','11:30','13:30']){await next(page,time);await page.getByRole('button',{name:'저장 · 점검 보기'}).click();}
  await next(page,'15:30');
  await page.locator('#record-switch').selectOption({label:'2026-09-25 · 11:30'});
  await page.getByRole('button',{name:'수정',exact:true}).click();await page.locator('#confirm-action').click();
  await page.locator('#dock-1 [data-field="status"]').selectOption('Empty');await page.reload();
  await expect(page.locator('#dock-1 [data-field="status"]')).toHaveValue('Empty');
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();
  await page.locator('#record-switch').selectOption({label:'2026-09-25 · 13:30'});
  await expect(page.locator('#dock-1 .read-status')).toHaveText('Full');
  await page.getByRole('button',{name:'점검 삭제',exact:true}).click();await page.locator('#confirm-action').click();
  await expect(page.locator('h1')).toHaveText('11:30');
  await page.getByRole('button',{name:'수정',exact:true}).click();
  await page.locator('#dock-1 [data-field="status"]').selectOption('Full');
  await page.getByRole('button',{name:'수정 취소',exact:true}).click();await page.locator('#confirm-action').click();
  await expect(page.locator('#dock-1 .read-status')).toHaveText('Empty');
  await next(page,'13:30');await page.getByRole('button',{name:'다음 점검 취소',exact:true}).click();await page.locator('#confirm-action').click();
  await expect(page.locator('h1')).toHaveText('11:30');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')).records.length)).toBe(3);
});
test('compact result shows at least ten populated docks and exact working ranges',async({page})=>{
  await start(page);
  await page.evaluate(()=>{
    state.draft.rows.forEach((row,i)=>{row.container='DEMO-'+(i+1);row.codes=['DEMO-I'];row.status='Full';});persist();render();
  });
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();
  const visible=await page.locator('.dock.compact').evaluateAll(nodes=>nodes.filter(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=window.innerHeight-65;}).length);
  expect(visible).toBeGreaterThanOrEqual(10);
  await expect(page.locator('#dock-1 .dock-line')).toContainText('DEMO-1');
  await page.locator('[data-range="9-13"]').click();await expect(page.locator('.dock')).toHaveCount(5);
  await expect(page.locator('.dock').first()).toHaveAttribute('id','dock-9');await expect(page.locator('.dock').last()).toHaveAttribute('id','dock-13');
  await page.locator('[data-range="14-20"]').click();await expect(page.locator('.dock')).toHaveCount(7);
  await page.locator('[data-range="all"]').click();await page.locator('#toast').waitFor({state:'hidden'});
  await page.screenshot({path:'test-results/05-compact-results.png'});
});
test('ready to drop can be undone and redone after restarting the draft',async({page})=>{
  await start(page);await container(page,'DEMO-A');await page.locator('#dock-1 [data-field="codes"]').fill('DEMO-I');
  await page.locator('#dock-1 [data-field="contents"]').fill('demo cargo');await page.locator('#dock-1 [data-field="note"]').fill('demo note');
  await page.locator('#dock-1 [data-field="status"]').selectOption('Full');await page.getByRole('button',{name:'저장 · 점검 보기'}).click();
  await page.getByRole('button',{name:'수정',exact:true}).click();await expect(page.getByRole('button',{name:'되돌리기',exact:true})).toBeDisabled();
  await page.locator('#dock-1 [data-field="status"]').selectOption('Ready to drop');await page.locator('#confirm-action').click();
  await page.reload();await page.getByRole('button',{name:'되돌리기',exact:true}).click();
  for(const [field,value] of [['container','DEMO-A'],['codes','DEMO-I'],['contents','demo cargo'],['note','demo note'],['status','Full']])await expect(page.locator('#dock-1 [data-field="'+field+'"]')).toHaveValue(value);
  await page.getByRole('button',{name:'다시 실행',exact:true}).click();await expect(page.locator('#dock-1 [data-field="container"]')).toHaveValue('');
  await expect(page.locator('#dock-1 [data-field="status"]')).toHaveValue('Ready to drop');
  await page.getByRole('button',{name:'되돌리기',exact:true}).click();await page.screenshot({path:'test-results/06-undo.png'});
});
test('container replacement undo and redo keep codes and status',async({page})=>{
  await start(page);await container(page,'DEMO-A');await page.locator('#dock-1 [data-field="codes"]').fill('DEMO-I');await page.locator('#dock-1 [data-field="status"]').selectOption('Full');
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();await next(page,'09:30');
  await container(page,'DEMO-B');await expect(page.locator('#dock-1 [data-field="codes"]')).toHaveValue('DEMO-I');
  await page.getByRole('button',{name:'되돌리기',exact:true}).click();
  await expect(page.locator('#dock-1 [data-field="container"]')).toHaveValue('DEMO-A');await expect(page.locator('#dock-1 [data-field="codes"]')).toHaveValue('DEMO-I');await expect(page.locator('#dock-1 [data-field="status"]')).toHaveValue('Full');
  await page.getByRole('button',{name:'다시 실행',exact:true}).click();await expect(page.locator('#dock-1 [data-field="container"]')).toHaveValue('DEMO-B');await expect(page.locator('#dock-1 [data-field="codes"]')).toHaveValue('DEMO-I');
});
test('keyboard undo groups typing, supports redo, and saving resets editing history',async({page})=>{
  await start(page);const note=page.locator('#dock-1 [data-field="note"]');
  await note.pressSequentially('DEMO NOTE');await page.keyboard.press('Control+z');await expect(note).toHaveValue('');
  await page.keyboard.press('Control+Shift+z');await expect(note).toHaveValue('DEMO NOTE');
  await page.keyboard.press('Control+z');await note.fill('NEW NOTE');await expect(page.getByRole('button',{name:'다시 실행',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();await page.getByRole('button',{name:'수정',exact:true}).click();
  await expect(page.getByRole('button',{name:'되돌리기',exact:true})).toBeDisabled();await expect(note).toHaveValue('NEW NOTE');
});
