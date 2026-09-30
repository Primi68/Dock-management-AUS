package com.primi.docknotes;

import android.content.Context;
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
import static org.junit.Assume.assumeTrue;

@RunWith(AndroidJUnit4.class)
public class SignedUpdateTest {
    private String readStoredData() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            for (int attempt=0; attempt<60; attempt++) {
                CountDownLatch ready = new CountDownLatch(1);
                AtomicReference<String> result = new AtomicReference<>();
                scenario.onActivity(activity -> {
                    WebView web = (WebView)((ViewGroup)activity.findViewById(android.R.id.content)).getChildAt(0);
                    web.evaluateJavascript("typeof state !== 'undefined' && state.draft && document.querySelectorAll('.dock').length===20 ? DockNative.load() : null", value -> { result.set(value); ready.countDown(); });
                });
                assertTrue("JavaScript callback", ready.await(15, TimeUnit.SECONDS));
                if (result.get()!=null && !"null".equals(result.get())) return result.get();
                Thread.sleep(250);
            }
            throw new AssertionError("Persisted draft was not displayed after install");
        }
    }
    @Test public void checkpointBeforeUpdate() throws Exception {
        assumeTrue("before".equals(InstrumentationRegistry.getArguments().getString("upgradePhase")));
        String data = readStoredData();
        assertTrue("Seeded data present", data.contains("DEMO-ANDROID"));
        // Test-package storage survives replacement of the separate target APK.
        assertTrue(InstrumentationRegistry.getInstrumentation().getContext().getSharedPreferences("signed-update",Context.MODE_PRIVATE).edit().putString("snapshot",data).commit());
    }
    @Test public void installedUpdatePreservesData() throws Exception {
        assumeTrue("after".equals(InstrumentationRegistry.getArguments().getString("upgradePhase")));
        String before = InstrumentationRegistry.getInstrumentation().getContext().getSharedPreferences("signed-update",Context.MODE_PRIVATE).getString("snapshot",null);
        assertNotNull("Pre-update checkpoint exists",before);
        assertEquals("Updating the signed APK preserves all saved settings and records",before,readStoredData());
    }
}
