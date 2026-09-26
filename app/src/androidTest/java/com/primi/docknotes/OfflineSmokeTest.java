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
    @Test public void offlineBridgePersistsAndSurvivesActivityRecreation() throws Exception {
        assertEquals(PackageManager.PERMISSION_DENIED, InstrumentationRegistry.getInstrumentation().getTargetContext().checkCallingOrSelfPermission("android.permission.INTERNET"));
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitForPage(scenario);
            String script="(function(){let s=DockCore.initial();let r=DockCore.newRecord(s,'2026-09-25','07:30');r.rows[0].container='DEMO-ANDROID';r.rows[0].status='Full';s.draft=r;return DockNative.save(JSON.stringify(s));})()";
            assertEquals("true",evaluate(scenario,script));
            scenario.recreate();waitForPage(scenario);
            assertEquals("true",evaluate(scenario,"document.body.innerText.includes('DEMO-ANDROID') && document.querySelectorAll('.dock').length===20"));
            assertEquals("true",evaluate(scenario,"DockCore.parseBackup(DockNative.load()).draft.rows[0].status==='Full'"));
        }
    }
}
