package com.primi.docknotes;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.util.AtomicFile;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView web;
    private AtomicFile storage;
    private String pendingExport;
    private static final int EXPORT = 10, IMPORT = 11;
    private static final int MAX_BYTES = 20 * 1024 * 1024;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        storage = new AtomicFile(new File(getFilesDir(), "dock-state.json"));
        if (state != null) pendingExport = state.getString("export");
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(246, 247, 243));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setDomStorageEnabled(false);
        web.addJavascriptInterface(new Bridge(), "DockNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                String prefix = "https://app.docknotes.local/";
                if (url.startsWith(prefix)) {
                    String path = url.substring(prefix.length());
                    if (path.isEmpty()) path = "index.html";
                    if (path.matches("[a-zA-Z0-9._-]+")) try {
                        String mime = path.endsWith(".js") ? "application/javascript" : path.endsWith(".css") ? "text/css" : "text/html";
                        return new WebResourceResponse(mime, "UTF-8", getAssets().open(path));
                    } catch (IOException ignored) { }
                }
                return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
            }
        });
        setContentView(web);
        web.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        web.loadUrl("https://app.docknotes.local/index.html");
    }

    private String read(InputStream stream) throws IOException {
        try (InputStream input = stream; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int count;
            while ((count = input.read(buffer)) != -1) {
                if (out.size() + count > MAX_BYTES) throw new IOException("File too large");
                out.write(buffer, 0, count);
            }
            return out.toString("UTF-8");
        }
    }

    private void message(String text) { runOnUiThread(() -> Toast.makeText(this, text, Toast.LENGTH_LONG).show()); }

    public class Bridge {
        @JavascriptInterface public synchronized String load() {
            try { return read(storage.openRead()); }
            catch (FileNotFoundException e) { return ""; }
            catch (IOException e) { return "__READ_ERROR__"; }
        }
        @JavascriptInterface public synchronized boolean save(String json) {
            FileOutputStream out = null;
            try {
                byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
                if (bytes.length > MAX_BYTES) return false;
                new JSONObject(json);
                out = storage.startWrite(); out.write(bytes); storage.finishWrite(out); return true;
            } catch (Exception e) { if (out != null) storage.failWrite(out); return false; }
        }
        @JavascriptInterface public void copy(String text) {
            runOnUiThread(() -> {
                ((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Dock check", text));
                message("점검 기록을 복사했습니다");
            });
        }
        @JavascriptInterface public void exportFile(String name, String mime, String text) {
            runOnUiThread(() -> {
                try {
                    try (FileOutputStream out = openFileOutput("pending-export.txt", MODE_PRIVATE)) { out.write(text.getBytes(StandardCharsets.UTF_8)); }
                    pendingExport = text;
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE, name);
                    startActivityForResult(intent, EXPORT);
                } catch (Exception e) { message("내보내기를 시작하지 못했습니다."); }
            });
        }
        @JavascriptInterface public void importFile() {
            runOnUiThread(() -> startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*"), IMPORT));
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (result != RESULT_OK || data == null || data.getData() == null) { pendingExport = null; deleteFile("pending-export.txt"); return; }
        try {
            if (request == EXPORT) {
                if (pendingExport == null) pendingExport = read(openFileInput("pending-export.txt"));
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out == null) throw new IOException();
                    out.write(pendingExport.getBytes(StandardCharsets.UTF_8));
                }
                pendingExport = null; deleteFile("pending-export.txt"); message("파일을 저장했습니다");
            } else if (request == IMPORT) {
                String json = read(getContentResolver().openInputStream(data.getData()));
                web.evaluateJavascript("window.receiveBackup(" + JSONObject.quote(json) + ")", null);
            }
        } catch (Exception e) { pendingExport = null; message("파일을 처리하지 못했습니다. 저장 공간과 파일을 확인해 주세요."); }
    }
    @Override public void onBackPressed() { web.evaluateJavascript("window.handleBack()", null); }
    @Override protected void onDestroy() { web.removeJavascriptInterface("DockNative"); web.destroy(); super.onDestroy(); }
}
