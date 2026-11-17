const {test,expect}=require('@playwright/test');

for(const [language,historical] of [['ko',false],['en',true]])test(`clear entire check confirms, persists and undoes (${language}, historical=${historical})`,async({page})=>{
  await page.goto('/');
  await page.evaluate(({language,historical})=>{
    const s=DockCore.initial();s.settings.language=language;
    for(const time of ['07:30','09:30','11:30']){
      const r=DockCore.newRecord(s,'2026-11-17',time);
      r.rows.forEach(row=>Object.assign(row,{container:'DEMO-'+row.dock,codes:['DEMO-A','DEMO-B','DEMO-C'],contents:'DEMO-CARGO',status:'Full',note:'DEMO-NOTE'}));
      r.savedAt=new Date().toISOString();s.records.push(r);
    }
    s.draft=historical?{...DockCore.clone(s.records[1]),editOf:s.records[1].id}:DockCore.newRecord(s,'2026-11-17','13:30');
    s.draft.corrections=[1,20];s.draft.containerUndo={20:DockCore.clone(s.draft.rows[19])};
    localStorage.setItem('dock-notes-v1',JSON.stringify(s));
  },{language,historical});
  await page.reload();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')));
  const clear=page.locator('[data-action="clear-check"]');
  await expect(clear).toHaveText(language==='ko'?'현재 점검 전체 초기화':'Clear entire check');
  await clear.click();await page.getByRole('button',{name:language==='ko'?'취소':'Cancel',exact:true}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')))).toEqual(before);
  await clear.click();await page.locator('#confirm-action').click();
  await expect(page.locator('.dock')).toHaveCount(20);
  await expect(page.locator('#dock-20 [data-field="container"]')).toHaveValue('');
  await expect(page.locator('#dock-1 [data-field="status"]')).toHaveValue('');
  const cleared=await page.evaluate(()=>DockCore.parseBackup(localStorage.getItem('dock-notes-v1')));
  expect(cleared.draft.rows.every(r=>!r.container&&!r.contents&&!r.status&&!r.note&&r.codes.length===1&&r.codes[0]==='')).toBe(true);
  expect(cleared.draft.corrections).toEqual([]);expect(cleared.draft.containerUndo).toEqual({});
  expect(cleared.records).toEqual(before.records);expect(cleared.settings).toEqual(before.settings);
  for(const key of ['date','time','groups','baseline'])expect(cleared.draft[key]).toEqual(before.draft[key]);
  await page.reload();await expect(page.locator('#dock-20 [data-field="container"]')).toHaveValue('');
  await page.locator('[data-action="undo"]').click();
  expect(await page.evaluate(()=>DockCore.editSnapshot(DockCore.parseBackup(localStorage.getItem('dock-notes-v1')).draft))).toEqual(await page.evaluate(r=>DockCore.editSnapshot(r),before.draft));
  await page.locator('[data-action="redo"]').click();await page.locator('[data-action="save"]').click();
  const saved=await page.evaluate(()=>DockCore.parseBackup(localStorage.getItem('dock-notes-v1')));
  expect(saved.draft).toBeNull();expect(saved.records[historical?1:3].rows).toEqual(cleared.draft.rows);
  expect(saved.records[0]).toEqual(before.records[0]);expect(saved.records[2]).toEqual(before.records[2]);
  await expect(page.locator('[data-action="clear-check"]')).toHaveCount(0);
});

test('failed persistence restores the draft when clearing all fields',async({page})=>{
  await page.goto('/');await page.locator('#dock-1 [data-field="container"]').fill('DEMO-KEEP');
  await page.locator('#dock-1 [data-field="container"]').press('Tab');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')));
  await page.locator('[data-action="clear-check"]').click();
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('DEMO-FULL');};});
  await page.locator('#confirm-action').click();
  await expect(page.locator('#dock-1 [data-field="container"]')).toHaveValue('DEMO-KEEP');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')))).toEqual(before);
  expect(await page.evaluate(()=>state.draft)).toEqual(before.draft);
});
