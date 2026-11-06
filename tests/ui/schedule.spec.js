const {test,expect}=require('@playwright/test');

test.use({timezoneId:'Australia/Sydney'});

test('an automatically opened page with no input advances on the next launch',async({page})=>{
  await page.clock.install({time:new Date('2026-11-06T07:20:00+11:00')});
  await page.goto('/');await expect(page.locator('.check-intro h1')).toHaveText('07:30');
  await page.clock.setFixedTime(new Date('2026-11-06T07:40:00+11:00'));
  await page.reload();await expect(page.locator('.check-intro h1')).toHaveText('09:30');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')).records)).toHaveLength(0);
});

test('07:40 starts the upcoming 09:30 check and resumes its draft after the time passes',async({page})=>{
  await page.clock.install({time:new Date('2026-11-06T07:40:00+11:00')});
  await page.goto('/');
  await expect(page.locator('.check-intro h1')).toHaveText('09:30');
  await page.locator('#dock-1 [data-field="note"]').fill('DEMO-DRAFT');
  await page.clock.setFixedTime(new Date('2026-11-06T09:40:00+11:00'));
  await page.reload();
  await expect(page.locator('.check-intro h1')).toHaveText('09:30');
  await expect(page.locator('#dock-1 [data-field="note"]')).toHaveValue('DEMO-DRAFT');
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();
  await page.getByRole('button',{name:'다음 점검 →',exact:true}).click();
  await expect(page.locator('.check-intro h1')).toHaveText('11:30');
});

test('launch opens the next page from a saved previous check without pressing Next',async({page})=>{
  await page.clock.install({time:new Date('2026-11-06T07:40:00+11:00')});
  await page.goto('/');
  await page.evaluate(()=>{
    const s=DockCore.initial(),r=DockCore.newRecord(s,'2026-11-06','07:30');
    r.rows[0].note='DEMO-SAVED';r.savedAt=new Date().toISOString();s.records.push(r);
    localStorage.setItem('dock-notes-v1',JSON.stringify(s));
  });
  await page.reload();
  await expect(page.locator('.check-intro h1')).toHaveText('09:30');
  await expect(page.locator('#dock-1 [data-field="note"]')).toHaveValue('DEMO-SAVED');
  const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')));
  expect(s.records).toHaveLength(1);expect(s.records[0].time).toBe('07:30');
  expect(s.draft.time).toBe('09:30');expect(s.draft.baseline[0].note).toBe('DEMO-SAVED');
});

test('an already saved upcoming check opens for reading and foregrounding advances only without a draft',async({page})=>{
  await page.clock.install({time:new Date('2026-11-06T07:40:00+11:00')});
  await page.goto('/');
  await page.evaluate(()=>{
    const s=DockCore.initial(),r=DockCore.newRecord(s,'2026-11-06','09:30');
    r.rows[0].note='DEMO-EARLY';r.savedAt=new Date().toISOString();s.records.push(r);
    localStorage.setItem('dock-notes-v1',JSON.stringify(s));
  });
  await page.reload();
  await expect(page.locator('.check-intro h1')).toHaveText('09:30');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-notes-v1')).draft)).toBeNull();
  await page.clock.setFixedTime(new Date('2026-11-06T09:40:00+11:00'));
  await page.evaluate(()=>window.openScheduledPage());
  await expect(page.locator('.check-intro h1')).toHaveText('11:30');
  await page.locator('#dock-1 [data-field="note"]').fill('DEMO-IN-PROGRESS');
  await page.clock.setFixedTime(new Date('2026-11-06T13:40:00+11:00'));
  await page.evaluate(()=>window.openScheduledPage());
  await expect(page.locator('.check-intro h1')).toHaveText('11:30');
  await expect(page.locator('#dock-1 [data-field="note"]')).toHaveValue('DEMO-IN-PROGRESS');
});
