const {test,expect}=require('@playwright/test');
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
  await expect(page.locator('#dock-1')).toHaveClass(/whole/);await expect(page.locator('#dock-1 [data-field="codes"]')).toHaveValue('');await expect(page.locator('#dock-1 [data-field="status"]')).toHaveValue('');
  await page.locator('#dock-1 [data-field="codes"]').fill('DEMO-ITEM-B');await page.locator('#dock-1 [data-field="status"]').selectOption('Full');await page.getByRole('button',{name:'저장 · 점검 보기'}).click();
  await page.screenshot({path:'test-results/03-container-change.png',fullPage:false});
  await next(page,'13:30');await page.locator('#dock-1 [data-field="status"]').selectOption('Ready to drop');await page.locator('#confirm-action').click();
  await expect(page.locator('#dock-1')).toHaveClass(/whole/);await expect(page.locator('#dock-1 [data-field="codes"]')).toBeDisabled();
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();await expect(page.locator('#dock-1 .read-main')).toHaveText('—');
  expect(errors).toEqual([]);
});
test('editable settings, header isolation, backups and history',async({page})=>{
  await start(page);await container(page,'DEMO-TRAILER-A');
  await page.locator('#dock-1 [data-action="add-code"]').click();await page.locator('#dock-1 [data-action="add-code"]').click();await expect(page.locator('#dock-1 [data-field="codes"]')).toHaveCount(3);
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();
  const backup=await page.evaluate(()=>localStorage.getItem('dock-notes-v1'));
  await page.locator('#menu').click();await page.getByRole('button',{name:'점검 시간 · 구역 설정'}).click();
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
  await container(page,'DEMO-NUMBER-CORRECTED');await page.locator('#dock-1 [data-action="number-correction"]').click();
  await expect(page.locator('#dock-1')).not.toHaveClass(/whole/);await expect(page.locator('#dock-1 [data-field="codes"]')).toHaveValue('DEMO-LATE-CODE');
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
