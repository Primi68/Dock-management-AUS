const {test,expect}=require('@playwright/test');

for(const touch of [false,true])test.describe(touch?'touch entry':'mouse entry',()=>{
  test.use({hasTouch:touch,isMobile:touch});
  test('first tap selects all, next tap places a caret, replacement and partial edits undo independently',async({page})=>{
    await page.goto('/');
    await page.evaluate(()=>{
      const s=DockCore.initial();s.draft=DockCore.newRecord(s,'2026-11-19','09:30');
      s.draft.rows.forEach(r=>Object.assign(r,{container:'DEMO-NUMBER',codes:['DEMO-CODE','DEMO-SECOND','DEMO-THIRD'],contents:'DEMO-CARGO',note:'DEMO-NOTE'}));
      localStorage.setItem('dock-notes-v1',JSON.stringify(s));
    });
    await page.reload();
    const tap=async el=>touch?el.tap():el.click();
    const selection=el=>el.evaluate(e=>({start:e.selectionStart,end:e.selectionEnd,length:e.value.length}));
    const before=await page.evaluate(()=>localStorage.getItem('dock-notes-v1'));
    for(const selector of ['#dock-1 [data-field="container"]','#dock-1 [data-field="codes"][data-index="2"]','#dock-1 [data-field="contents"]','#dock-1 [data-field="note"]','#dock-20 [data-field="container"]']){
      const input=page.locator(selector);await tap(input);
      let s=await selection(input);expect(s.start).toBe(0);expect(s.end).toBe(s.length);
      // A deliberate second tap; rapid double-tap keeps the browser's word-selection gesture.
      if(touch)await page.waitForTimeout(600);
      await tap(input);s=await selection(input);expect(s.start).toBe(s.end);
    }
    expect(await page.evaluate(()=>localStorage.getItem('dock-notes-v1'))).toBe(before);
    const number=page.locator('#dock-1 [data-field="container"]');await tap(number);
    await page.keyboard.insertText('DEMO-REPLACED');await expect(number).toHaveValue('DEMO-REPLACED');
    // Revisiting selects the entire replacement, while another tap permits a precise edit.
    await tap(page.locator('#dock-1 [data-field="note"]'));await tap(number);
    expect((await selection(number)).start).toBe(0);
    await tap(number);await page.keyboard.press('End');await page.keyboard.insertText('-X');
    await expect(number).toHaveValue('DEMO-REPLACED-X');
    await page.locator('[data-action="undo"]').click();await expect(page.locator('#dock-1 [data-field="container"]')).toHaveValue('DEMO-REPLACED');
    await page.locator('[data-action="undo"]').click();await expect(page.locator('#dock-1 [data-field="container"]')).toHaveValue('DEMO-NUMBER');
    await page.locator('[data-action="redo"]').click();await expect(page.locator('#dock-1 [data-field="container"]')).toHaveValue('DEMO-REPLACED');
  });
});

test('keyboard entry selects all and settings inputs retain their native selection behavior',async({page})=>{
  await page.goto('/');
  const first=page.locator('#dock-1 [data-field="container"]'),code=page.locator('#dock-1 [data-field="codes"]');
  await first.fill('DEMO-ONE');await code.fill('DEMO-TWO');
  await first.focus();await page.keyboard.press('Tab');
  // Use the actual tab order rather than depending on intervening action buttons.
  for(let i=0;i<5&&!(await code.evaluate(e=>e===document.activeElement));i++)await page.keyboard.press('Tab');
  expect(await code.evaluate(e=>e===document.activeElement&&e.selectionStart===0&&e.selectionEnd===e.value.length)).toBe(true);
  await page.locator('#menu').click();await page.locator('[data-action="settings"]').click();await page.locator('[data-action="check-settings"]').click();
  const settings=page.locator('[data-key="name"]').first();await settings.click();
  expect(await settings.evaluate(e=>e.selectionStart===e.selectionEnd)).toBe(true);
});

test.describe('touch scrolling',()=>{
  test.use({hasTouch:true,isMobile:true});
  test('swiping from an input scrolls without selecting or changing its value',async({page})=>{
    await page.goto('/');const input=page.locator('#dock-1 [data-field="container"]');
    await input.fill('DEMO-SCROLL');await input.blur();
    const before=await page.evaluate(()=>localStorage.getItem('dock-notes-v1'));
    const box=await input.boundingBox(),start=await page.evaluate(()=>scrollY);
    const cdp=await page.context().newCDPSession(page);
    const x=box.x+box.width/2,y=box.y+box.height/2;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*15}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(start);
    expect(await input.evaluate(e=>e!==document.activeElement)).toBe(true);
    expect(await page.evaluate(()=>localStorage.getItem('dock-notes-v1'))).toBe(before);
  });
});
