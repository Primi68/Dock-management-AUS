const {test,expect}=require('@playwright/test');

async function readyDraft(page,language='ko'){
  await page.goto('/');
  await page.evaluate(language=>{
    const s=DockCore.initial();s.settings.language=language;
    const previous=DockCore.newRecord(s,'2026-10-08','07:30');
    previous.rows.forEach(row=>row.status='Ready to drop');
    previous.savedAt=new Date().toISOString();s.records.push(previous);
    s.draft=DockCore.newRecord(s,'2026-10-08','09:30');
    localStorage.setItem('dock-notes-v1',JSON.stringify(s));
  },language);
  await page.reload();await expect(page.locator('.dock')).toHaveCount(20);
}
async function stored(page){return page.evaluate(()=>DockCore.parseBackup(localStorage.getItem('dock-notes-v1')));}

for(const field of ['codes','container'])test(`Ready to drop accepts ${field} first and defaults to Full on all twenty docks`,async({page})=>{
  test.setTimeout(60000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await readyDraft(page,field==='container'?'en':'ko');
  const before=await stored(page);
  for(let n=1;n<=20;n++){
    const dock=page.locator('#dock-'+n),input=dock.locator('[data-field="'+field+'"]');
    await expect(dock.locator('[data-field="codes"]')).toBeEnabled();
    await input.fill('DEMO-'+field+'-'+n);
    await expect(input).toBeFocused();
    await expect(dock.locator('[data-field="status"]')).toHaveValue('Full');
    await expect(dock.locator('[data-field="contents"]')).toBeEnabled();
    await input.press('Tab');
    await expect(dock.locator('[data-field="codes"]')).toBeEnabled();
  }
  const after=await stored(page);
  expect(after.records).toEqual(before.records);expect(after.draft.baseline).toEqual(before.draft.baseline);
  expect(after.draft.rows.every(row=>row.status==='Full')).toBe(true);
  if(field==='codes')expect(after.draft.rows.every(row=>row.container==='')).toBe(true);
  await page.reload();await expect(page.locator('#dock-20 [data-field="status"]')).toHaveValue('Full');
  await page.locator('[data-action="save"]').click();
  const saved=await stored(page);expect(saved.records[1].rows).toEqual(after.draft.rows);expect(saved.records[0]).toEqual(before.records[0]);
  expect(errors).toEqual([]);
});

test('code and automatic Full undo together after backup restore; late number entry preserves the code',async({page})=>{
  await readyDraft(page);
  const dock=page.locator('#dock-14'),code=dock.locator('[data-field="codes"]');
  await code.pressSequentially('DEMO-WHEEL');
  await expect(code).toBeFocused();await expect(code).toHaveValue('DEMO-WHEEL');
  await expect(dock.locator('[data-field="status"]')).toHaveValue('Full');
  const backup=await page.evaluate(()=>localStorage.getItem('dock-notes-v1'));
  await page.reload();await page.evaluate(raw=>window.receiveBackup(raw),backup);await page.locator('#confirm-action').click();
  await page.locator('[data-action="undo"]').click();
  await expect(code).toHaveValue('');await expect(code).toBeEnabled();
  await expect(dock.locator('[data-field="status"]')).toHaveValue('Ready to drop');
  await page.reload();await page.locator('[data-action="redo"]').click();
  await expect(code).toHaveValue('DEMO-WHEEL');await expect(dock.locator('[data-field="status"]')).toHaveValue('Full');
  await dock.locator('[data-field="container"]').pressSequentially('DEMO-LATE-NUMBER');
  await dock.locator('[data-field="container"]').press('Tab');
  await expect(code).toHaveValue('DEMO-WHEEL');
  await page.locator('[data-action="undo"]').click();
  await expect(dock.locator('[data-field="container"]')).toHaveValue('');
  await expect(code).toHaveValue('DEMO-WHEEL');await expect(dock.locator('[data-field="status"]')).toHaveValue('Full');
  await page.reload();await page.locator('[data-action="undo"]').click();
  await expect(code).toHaveValue('');await expect(dock.locator('[data-field="status"]')).toHaveValue('Ready to drop');
  await stored(page);
});

test('whitespace, notes and empty code slots do not imply arrival; clearing inputs and manual statuses stay unchanged',async({page})=>{
  await readyDraft(page);
  const dock=page.locator('#dock-1');
  await dock.locator('[data-field="container"]').fill('   ');await dock.locator('[data-field="container"]').press('Tab');
  await dock.locator('[data-field="codes"]').fill('   ');
  await dock.locator('[data-field="note"]').fill('DEMO note while vacant');
  await dock.locator('[data-action="add-code"]').click();await dock.locator('[data-action="add-code"]').click();
  await expect(dock.locator('[data-field="codes"]')).toHaveCount(3);
  await expect(dock.locator('[data-field="status"]')).toHaveValue('Ready to drop');
  const vacant=await stored(page);expect(vacant.draft.rows[0].codes).toEqual(['','','']);expect(vacant.draft.rows[0].container).toBe('');
  await page.reload();
  await dock.locator('[data-field="codes"]').nth(2).fill('DEMO-THIRD');
  await expect(dock.locator('[data-field="status"]')).toHaveValue('Full');
  await dock.locator('[data-field="codes"]').nth(2).fill('');
  await expect(dock.locator('[data-field="status"]')).toHaveValue('Full');
  for(const status of ['Empty','In process','']){
    await dock.locator('[data-field="status"]').selectOption(status);
    await dock.locator('[data-field="codes"]').first().fill('DEMO-MANUAL-'+status);
    await dock.locator('[data-field="container"]').fill('DEMO-NUMBER-'+status);
    await dock.locator('[data-field="container"]').press('Tab');
    await expect(dock.locator('[data-field="status"]')).toHaveValue(status);
  }
  await stored(page);
});
