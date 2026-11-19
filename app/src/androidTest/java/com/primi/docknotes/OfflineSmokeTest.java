package com.primi.docknotes;

import android.content.pm.PackageManager;
import android.view.ViewGroup;
import android.view.MotionEvent;
import android.os.SystemClock;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONArray;
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
    private void tapFirstContainer(ActivityScenario<MainActivity> scenario) throws Exception {
        JSONArray point = new JSONArray(evaluate(scenario,"(function(){let e=document.querySelector('#dock-1 [data-field=container]');e.scrollIntoView({block:'center',behavior:'instant'});let r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,innerWidth];})()"));
        float cssX=(float)point.getDouble(0),cssY=(float)point.getDouble(1),cssWidth=(float)point.getDouble(2);
        scenario.onActivity(activity -> {
            WebView web=(WebView)((ViewGroup)activity.findViewById(android.R.id.content)).getChildAt(0);
            // DOM coordinates start inside the WebView's system-inset padding.
            float scale=(web.getWidth()-web.getPaddingLeft()-web.getPaddingRight())/cssWidth;
            float x=web.getPaddingLeft()+cssX*scale,y=web.getPaddingTop()+cssY*scale;
            long time=SystemClock.uptimeMillis();
            MotionEvent down=MotionEvent.obtain(time,time,MotionEvent.ACTION_DOWN,x,y,0);
            MotionEvent up=MotionEvent.obtain(time,time+1,MotionEvent.ACTION_UP,x,y,0);
            web.dispatchTouchEvent(down);web.dispatchTouchEvent(up);down.recycle();up.recycle();
        });
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
    }
    @Test public void firstTouchSelectsAllAndSecondTouchAllowsPartialEditingWithoutChangingData() throws Exception {
        try (ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"(function(){let s=DockCore.initial();s.draft=DockCore.newRecord(s,'2026-11-19','09:30');s.draft.rows[0].container='DEMO-NUMBER';return DockNative.save(JSON.stringify(s));})()"));
            scenario.recreate();waitForPage(scenario);tapFirstContainer(scenario);
            for(int i=0;i<30;i++){
                if("true".equals(evaluate(scenario,"(function(){let e=document.querySelector('#dock-1 [data-field=container]');return document.activeElement===e&&e.selectionStart===0&&e.selectionEnd===e.value.length;})()")))break;
                Thread.sleep(100);
            }
            assertEquals("true",evaluate(scenario,"(function(){let e=document.querySelector('#dock-1 [data-field=container]');return e.selectionStart===0&&e.selectionEnd===e.value.length;})()"));
            Thread.sleep(600);tapFirstContainer(scenario);
            String selection=evaluate(scenario,"(function(){let e=document.querySelector('#dock-1 [data-field=container]');return {start:e.selectionStart,end:e.selectionEnd,focused:document.activeElement===e};})()");
            assertEquals("Second tap selection: "+selection,"true",evaluate(scenario,"(function(){let e=document.querySelector('#dock-1 [data-field=container]'),s=DockCore.parseBackup(DockNative.load());return document.activeElement===e&&e.selectionStart===e.selectionEnd&&s.draft.rows[0].container==='DEMO-NUMBER'&&!s.draft.undoHistory?.length;})()"));
        }
    }
    @Test public void clearEntireCheckPersistsAndUndoesAfterRecreation() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"(function(){let s=DockCore.initial(),r=DockCore.newRecord(s,'2026-11-17','07:30');r.rows.forEach(row=>Object.assign(row,{container:'DEMO-'+row.dock,codes:['DEMO-CODE'],contents:'DEMO-CARGO',status:'Full',note:'DEMO-NOTE'}));r.savedAt=new Date().toISOString();s.records.push(r);s.draft=DockCore.newRecord(s,'2026-11-17','09:30');return DockNative.save(JSON.stringify(s));})()"));
            scenario.recreate();waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"(function(){document.querySelector('[data-action=clear-check]').click();return document.querySelector('#dialog').open && document.querySelector('#dock-20 [data-field=container]').value==='DEMO-20';})()"));
            assertEquals("true",evaluate(scenario,"(function(){document.querySelector('#confirm-action').click();let s=DockCore.parseBackup(DockNative.load());return s.draft.rows.every(r=>!r.container&&!r.status&&!r.note&&!r.contents&&r.codes[0]==='') && s.records[0].rows[19].container==='DEMO-20' && s.draft.baseline[19].container==='DEMO-20';})()"));
            scenario.recreate();waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"(function(){document.querySelector('[data-action=undo]').click();return DockCore.parseBackup(DockNative.load()).draft.rows.every(r=>r.container==='DEMO-'+r.dock && r.codes[0]==='DEMO-CODE' && r.status==='Full');})()"));
            scenario.recreate();waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"(function(){document.querySelector('[data-action=redo]').click();return DockCore.parseBackup(DockNative.load()).draft.rows.every(r=>!r.container&&!r.status);})()"));
        }
    }
    @Test public void newChecksSkipPastScheduledTimesInTheOfflineWebView() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"(function(){let s=DockCore.defaults();return DockCore.suggest(new Date(2026,10,6,7,40),s,[]).time==='09:30' && DockCore.suggest(new Date(2026,10,6,11,40),s,[]).time==='13:30' && DockCore.suggest(new Date(2026,10,6,7,30),s,[]).time==='07:30';})()"));
        }
    }
    @Test public void launchOpensTheUpcomingCheckPageWithoutAnExtraTap() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"(function(){let s=DockCore.initial(),next=new Date(Date.now()+10*60000);s.settings.days=[0,1,2,3,4,5,6];s.settings.times=[String(next.getHours()).padStart(2,'0')+':'+String(next.getMinutes()).padStart(2,'0')];return DockNative.save(JSON.stringify(s));})()"));
            scenario.recreate();waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"(function(){let s=DockCore.parseBackup(DockNative.load());return !!s.draft && s.draft.time===s.settings.times[0] && document.querySelector('.check-intro h1').textContent===s.draft.time && document.querySelectorAll('.dock').length===20;})()"));
        }
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
