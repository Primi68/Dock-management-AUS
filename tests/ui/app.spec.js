const {test,expect}=require('@playwright/test');
async function start(page){
  await page.goto('/');await page.getByRole('button',{name:'첫 점검 만들기'}).click();
  await page.locator('#new-date').fill('2026-09-25');await page.locator('#new-time').selectOption('07:30');
  await page.getByRole('button',{name:'기록 불러오기'}).click();
}
async function container(page,value){
  await page.locator('#dock-1 [data-action="container"]').click();await page.locator('#container-value').fill(value);
  await page.locator('#replace-container').click();
}
async function next(page,time){
  await page.getByRole('button',{name:'다음 점검 →',exact:true}).click();await page.locator('#new-date').fill('2026-09-25');await page.locator('#new-time').selectOption(time);await page.getByRole('button',{name:'기록 불러오기'}).click();
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
  await page.getByRole('button',{name:'저장 · 점검 보기'}).click();await expect(page.locator('#dock-1 .read-main')).toContainText('컨테이너 없음');
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
  await page.locator('#dock-1 [data-action="container"]').click();await page.locator('#container-value').fill('DEMO-NUMBER-CORRECTED');await page.locator('#correct-container').click();
  await expect(page.locator('#dock-1')).not.toHaveClass(/whole/);await expect(page.locator('#dock-1 [data-field="codes"]')).toHaveValue('DEMO-LATE-CODE');
});
