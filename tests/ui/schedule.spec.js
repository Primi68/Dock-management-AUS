const {test,expect}=require('@playwright/test');

test.use({timezoneId:'Australia/Sydney'});

test('07:40 starts the upcoming 09:30 check and resumes its draft after the time passes',async({page})=>{
  await page.clock.install({time:new Date('2026-11-06T07:40:00+11:00')});
  await page.goto('/');
  await page.getByRole('button',{name:'첫 점검 만들기'}).click();
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
