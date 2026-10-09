package com.primi.docknotes;

import android.content.pm.PackageManager;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class OfflineSmokeTest {
    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch ready = new CountDownLatch(1);
        AtomicReference<String> value = new AtomicReference<>();
        scenario.onActivity(activity -> {
            WebView web = (WebView)((ViewGroup)activity.findViewById(android.R.id.content)).getChildAt(0);
            web.evaluateJavascript(script, result -> { value.set(result); ready.countDown(); });
        });
        assertTrue("JavaScript callback", ready.await(15, TimeUnit.SECONDS));
        return value.get();
    }
    private void waitForPage(ActivityScenario<MainActivity> scenario) throws Exception {
        for (int i=0; i<60; i++) {
            if ("true".equals(evaluate(scenario,"typeof DockCore !== 'undefined' && typeof window.receiveBackup === 'function'"))) return;
            Thread.sleep(250);
        }
        fail("Offline page did not load");
    }
    @Test public void readyDockInputDefaultsToFullAndUndoesWithItsStatusAfterRecreation() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"(function(){let s=DockCore.initial();let previous=DockCore.newRecord(s,'2026-10-08','07:30');previous.rows.forEach(row=>row.status='Ready to drop');previous.savedAt=new Date().toISOString();s.records.push(previous);s.draft=DockCore.newRecord(s,'2026-10-08','09:30');return DockNative.save(JSON.stringify(s));})()"));
            scenario.recreate();waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"(function(){let input=document.querySelector('#dock-14 [data-field=codes]');if(input.disabled)return false;input.value='DEMO-WHEEL-FIRST';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('focusout',{bubbles:true}));let s=DockCore.parseBackup(DockNative.load());return s.draft.rows[13].status==='Full' && s.draft.rows[13].container==='' && s.records[0].rows[13].status==='Ready to drop';})()"));
            scenario.recreate();waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"document.querySelector('#dock-14 [data-field=codes]').value==='DEMO-WHEEL-FIRST' && document.querySelector('#dock-14 [data-field=status]').value==='Full'"));
            assertEquals("true",evaluate(scenario,"(function(){document.querySelector('[data-action=undo]').click();let s=DockCore.parseBackup(DockNative.load());return s.draft.rows[13].status==='Ready to drop' && s.draft.rows[13].codes[0]==='' && !document.querySelector('#dock-14 [data-field=codes]').disabled;})()"));
            scenario.recreate();waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"(function(){document.querySelector('[data-action=redo]').click();let row=DockCore.parseBackup(DockNative.load()).draft.rows[13];return row.status==='Full' && row.codes[0]==='DEMO-WHEEL-FIRST';})()"));
            assertEquals("true",evaluate(scenario,"(function(){let input=document.querySelector('#dock-1 [data-field=container]');input.value='DEMO-NUMBER-FIRST';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('focusout',{bubbles:true}));return DockCore.parseBackup(DockNative.load()).draft.rows[0].status==='Full';})()"));
            scenario.recreate();waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"(function(){document.querySelector('[data-action=undo]').click();let s=DockCore.parseBackup(DockNative.load());return s.draft.rows[0].status==='Ready to drop' && s.draft.rows[0].container==='' && s.draft.rows[13].status==='Full' && s.records[0].rows.every(row=>row.status==='Ready to drop') && s.draft.baseline.every(row=>row.status==='Ready to drop');})()"));
        }
    }
    @Test public void lateWheelNumberKeepsCodesAndResetCanBeUndoneAfterRecreation() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"(function(){let s=DockCore.initial();s.draft=DockCore.newRecord(s,'2026-09-25','07:30');Object.assign(s.draft.rows[13],{container:'DEMO-OLD',codes:['DEMO-WHEEL'],status:'Full',note:'demo note'});return DockNative.save(JSON.stringify(s));})()"));
            scenario.recreate();waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"(function(){let input=document.querySelector('#dock-14 [data-field=container]');input.value='DEMO-NEW';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('focusout',{bubbles:true}));let row=DockCore.parseBackup(DockNative.load()).draft.rows[13];return row.container==='DEMO-NEW' && row.codes[0]==='DEMO-WHEEL' && row.status==='Full' && row.note==='demo note';})()"));
            scenario.recreate();waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"document.querySelector('#dock-14 [data-field=codes]').value==='DEMO-WHEEL'"));
            assertEquals("true",evaluate(scenario,"(function(){document.querySelector('#dock-14 [data-action=clear-contents]').click();document.querySelector('#dialog [data-action=close]').click();return DockCore.parseBackup(DockNative.load()).draft.rows[13].codes[0]==='DEMO-WHEEL';})()"));
            assertEquals("true",evaluate(scenario,"(function(){document.querySelector('#dock-14 [data-action=clear-contents]').click();document.querySelector('#confirm-action').click();let row=DockCore.parseBackup(DockNative.load()).draft.rows[13];return row.container==='DEMO-NEW' && row.codes[0]==='' && row.status==='';})()"));
            scenario.recreate();waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"(function(){document.querySelector('[data-action=undo]').click();let row=DockCore.parseBackup(DockNative.load()).draft.rows[13];return row.container==='DEMO-NEW' && row.codes[0]==='DEMO-WHEEL' && row.status==='Full' && row.note==='demo note';})()"));
        }
    }
    @Test public void offlineBridgePersistsAndSurvivesActivityRecreation() throws Exception {
        assertEquals(PackageManager.PERMISSION_DENIED, InstrumentationRegistry.getInstrumentation().getTargetContext().checkCallingOrSelfPermission("android.permission.INTERNET"));
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitForPage(scenario);
            String script="(function(){let s=DockCore.initial();let r=DockCore.newRecord(s,'2026-09-25','07:30');r.rows[0].container='DEMO-ANDROID';r.rows[0].status='Full';s.draft=r;return DockNative.save(JSON.stringify(s));})()";
            assertEquals("true",evaluate(scenario,script));
            scenario.recreate();waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"document.querySelector('#dock-1 [data-field=container]').value==='DEMO-ANDROID' && document.querySelectorAll('.dock').length===20"));
            assertEquals("true",evaluate(scenario,"DockCore.parseBackup(DockNative.load()).draft.rows[0].status==='Full'"));
            assertEquals("true",evaluate(scenario,"(function(){document.querySelector('#menu').click();document.querySelector('[data-action=settings]').click();document.querySelector('[data-action=language-settings]').click();document.querySelector('#settings-language').value='en';document.querySelector('[data-action=save-settings]').click();return document.documentElement.lang==='en';})()"));
            scenario.recreate();waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"document.documentElement.lang==='en' && document.querySelector('[data-action=save]').textContent==='Save · View check' && document.querySelector('#dock-1 [data-field=container]').value==='DEMO-ANDROID'"));
            assertEquals("true",evaluate(scenario,"DockCore.parseBackup(DockNative.load()).settings.language==='en' && typeof DockNative.setLanguage==='function'"));
        }
    }
}
