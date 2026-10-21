package com.ihesab.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * WebView wrapper around iHesab v2 (آی‌حساب) — professional shop accounting, offline.
 * JS bridge (window.Android):
 *   - printHtml(html): invoice/report -> system print dialog (Save as PDF)
 *   - saveHtml(name, html, mime): saves a file into Downloads/iHesab, returns content URI
 *   - shareText(text): shares plain text via the system chooser
 * File chooser, JS confirm/alert overrides, and smart back-button are included.
 */
public class MainActivity extends Activity {

    private static final String APP_URL = "file:///android_asset/index.html";
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int CAMERA_PERMISSION_REQUEST = 1002;
    private static final int EXPORT_TREE_REQUEST = 1003;
    /* نسخه ۶٫۰: اتصال کافه‌بازار، پرداخت درون‌برنامه‌ای و سیستم نسخه طلایی به‌طور کامل حذف شده است */

    private WebView webView;
    private JsBridge bridge;
    private android.speech.SpeechRecognizer recognizer;
    private boolean voicePending = false;

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 44 && bridge != null) {
            boolean granted = grantResults.length > 0 && grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED;
            if (granted && voicePending) {
                voicePending = false;
                bridge.startRecognizer();
            } else {
                voicePending = false;
                bridge.voiceResult("", false);
            }
        }
        if (requestCode == 45 && bridge != null) {
            boolean granted = grantResults.length > 0 && grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED;
            if (!granted) bridge.btResult("مجوز بلوتوث داده نشد");
        }
    }
    private ValueCallback<Uri[]> filePathCallback;

    private String pendingSharedText = null;

    private void captureShareIntent(Intent intent) {
        try {
            if (intent != null && Intent.ACTION_SEND.equals(intent.getAction())
                    && "text/plain".equals(intent.getType())) {
                CharSequence t = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
                if (t != null) pendingSharedText = t.toString();
            }
        } catch (Exception ignored) { }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        captureShareIntent(getIntent());
        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        // Required so local @font-face fonts (assets/fonts/*.woff2) can load in the WebView.
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        // Assets ship inside the APK; never serve stale cached copies after an update.
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setMediaPlaybackRequiresUserGesture(false);
        bridge = new JsBridge();
        webView.addJavascriptInterface(bridge, "Android");

        // One-time cache purge when the installed version changes (does not touch localStorage data).
        try {
            int vc = getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
            android.content.SharedPreferences prefs = getPreferences(Context.MODE_PRIVATE);
            if (prefs.getInt("seenVersionCode", -1) != vc) {
                webView.clearCache(true);
                prefs.edit().putInt("seenVersionCode", vc).apply();
            }
        } catch (Exception ignored) { }

        webView.setWebViewClient(new WebViewClient());

        // Camera access for in-page barcode scanning via getUserMedia.
        if (checkSelfPermission(android.Manifest.permission.CAMERA) !=
                android.content.pm.PackageManager.PERMISSION_GRANTED) {
            try {
                requestPermissions(new String[]{android.Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
            } catch (Exception ignored) { }
        }

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final android.webkit.PermissionRequest request) {
                runOnUiThread(() -> {
                    for (String res : request.getResources()) {
                        if (res.equals(android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                            if (checkSelfPermission(android.Manifest.permission.CAMERA) ==
                                    android.content.pm.PackageManager.PERMISSION_GRANTED) {
                                request.grant(new String[]{res});
                            } else {
                                request.deny();
                            }
                            return;
                        }
                    }
                    request.deny();
                });
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message,
                                       final android.webkit.JsResult result) {
                new android.app.AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton("بله", (d, w) -> result.confirm())
                        .setNegativeButton("خیر", (d, w) -> result.cancel())
                        .setOnCancelListener(d -> result.cancel())
                        .show();
                return true;
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message,
                                     final android.webkit.JsResult result) {
                new android.app.AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton("باشه", (d, w) -> result.confirm())
                        .setOnCancelListener(d -> result.confirm())
                        .show();
                return true;
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(APP_URL);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureShareIntent(intent);
    }

    private class JsBridge {

        @JavascriptInterface
        public void setTextZoom(final int pct) {
            runOnUiThread(() -> {
                try { webView.getSettings().setTextZoom(pct); } catch (Exception ignored) { }
            });
        }

        @JavascriptInterface
        public void printHtml(final String html) {
            runOnUiThread(() -> {
                try {
                    WebView pv = new WebView(MainActivity.this);
                    pv.getSettings().setJavaScriptEnabled(true);
                    pv.setWebViewClient(new WebViewClient() {
                        @Override
                        public void onPageFinished(WebView view, String url) {
                            try {
                                PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                                PrintDocumentAdapter adapter = view.createPrintDocumentAdapter("ihesab-doc");
                                pm.print("آی‌حساب", adapter, new PrintAttributes.Builder().build());
                            } catch (Exception e) {
                                toast("چاپ ممکن نشد");
                            }
                            view.postDelayed(view::destroy, 5000);
                        }
                    });
                    pv.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
                } catch (Exception e) {
                    toast("چاپ ممکن نشد");
                }
            });
        }

        /* نوشتن فایل خروجی: اول پوشه انتخابی کاربر (SAF)، وگرنه Downloads/iHesab */
        private String writeExportFile(final String name, final byte[] bytes, final String mime) {
            try {
                String tree = getSharedPreferences("ihesab", Context.MODE_PRIVATE).getString("exportTree", null);
                if (tree != null) {
                    Uri treeUri = Uri.parse(tree);
                    String docId = android.provider.DocumentsContract.getTreeDocumentId(treeUri);
                    Uri parent = android.provider.DocumentsContract.buildDocumentUriUsingTree(treeUri, docId);
                    Uri created = android.provider.DocumentsContract.createDocument(getContentResolver(), parent, mime, name);
                    if (created != null) {
                        try (OutputStream os = getContentResolver().openOutputStream(created)) {
                            os.write(bytes);
                        }
                        return created.toString();
                    }
                }
            } catch (Exception ignored) {}
            try {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, mime);
                v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/iHesab");
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) return "";
                try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                    os.write(bytes);
                }
                return uri.toString();
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public String saveHtml(final String name, final String html, final String mime) {
            String m = mime == null || mime.isEmpty() ? "text/plain" : mime;
            return writeExportFile(name, html.getBytes(StandardCharsets.UTF_8), m);
        }

        @JavascriptInterface
        public String saveBase64(final String name, final String base64, final String mime) {
            try {
                byte[] bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
                String m = mime == null || mime.isEmpty() ? "application/octet-stream" : mime;
                return writeExportFile(name, bytes, m);
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void pickExportFolder() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                    startActivityForResult(intent, EXPORT_TREE_REQUEST);
                } catch (Exception e) {
                    toast("انتخاب پوشه ممکن نشد");
                }
            });
        }

        @JavascriptInterface
        public String getExportFolderLabel() {
            return getSharedPreferences("ihesab", Context.MODE_PRIVATE).getString("exportTreeLabel", "");
        }

        @JavascriptInterface
        public void clearExportFolder() {
            getSharedPreferences("ihesab", Context.MODE_PRIVATE).edit()
                .remove("exportTree").remove("exportTreeLabel").apply();
        }

        @JavascriptInterface
        public String autoBackupSave(final String json, final String dateStr) {
            try {
                java.io.File dir = new java.io.File(getExternalFilesDir(null), "iHesab-backups");
                if (!dir.exists()) dir.mkdirs();
                String safeDate = dateStr == null ? "unknown" : dateStr.replaceAll("[^0-9-]", "");
                java.io.File dated = new java.io.File(dir, "ihesab-autobackup-" + safeDate + ".json");
                java.io.File latest = new java.io.File(dir, "ihesab-autobackup-latest.json");
                for (java.io.File f : new java.io.File[]{dated, latest}) {
                    try (java.io.FileOutputStream os = new java.io.FileOutputStream(f)) {
                        os.write(json.getBytes(StandardCharsets.UTF_8));
                    }
                }
                // فقط ۷ نسخه آخر نگه داشته شود
                java.io.File[] files = dir.listFiles((d, n) -> n.startsWith("ihesab-autobackup-2") && n.endsWith(".json"));
                if (files != null && files.length > 7) {
                    java.util.Arrays.sort(files, (a, b) -> a.getName().compareTo(b.getName()));
                    for (int i = 0; i < files.length - 7; i++) files[i].delete();
                }
                return dated.getAbsolutePath();
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public boolean isFingerprintAvailable() {
            try {
                if (android.os.Build.VERSION.SDK_INT >= 29) {
                    android.hardware.biometrics.BiometricManager bm =
                            getSystemService(android.hardware.biometrics.BiometricManager.class);
                    return bm != null && bm.canAuthenticate() == android.hardware.biometrics.BiometricManager.BIOMETRIC_SUCCESS;
                }
                return false;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void authenticateFingerprint() {
            runOnUiThread(() -> {
                try {
                    if (android.os.Build.VERSION.SDK_INT < 28) { fpResult(false); return; }
                    java.util.concurrent.Executor exec = getMainExecutor();
                    android.hardware.biometrics.BiometricPrompt prompt =
                            new android.hardware.biometrics.BiometricPrompt.Builder(MainActivity.this)
                                    .setTitle("ورود به آی‌حساب")
                                    .setSubtitle("برای ورود، اثر انگشت خود را لمس کنید")
                                    .setNegativeButton("استفاده از رمز", exec, (d, w) -> fpResult(false))
                                    .build();
                    prompt.authenticate(new android.os.CancellationSignal(), exec,
                            new android.hardware.biometrics.BiometricPrompt.AuthenticationCallback() {
                                @Override
                                public void onAuthenticationSucceeded(android.hardware.biometrics.BiometricPrompt.AuthenticationResult r) {
                                    fpResult(true);
                                }
                                @Override
                                public void onAuthenticationError(int code, CharSequence msg) {
                                    fpResult(false);
                                }
                                @Override
                                public void onAuthenticationFailed() { /* تلاش ناموفق؛ پرامپت باز می‌ماند */ }
                            });
                } catch (Exception e) {
                    fpResult(false);
                }
            });
        }

        private void fpResult(final boolean ok) {
            runOnUiThread(() -> {
                try {
                    webView.evaluateJavascript("window.__fpResult && window.__fpResult(" + (ok ? "true" : "false") + ")", null);
                } catch (Exception ignored) { }
            });
        }

        @JavascriptInterface
        public boolean isVoiceAvailable() {
            try {
                return android.speech.SpeechRecognizer.isRecognitionAvailable(MainActivity.this);
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void startVoiceInput() {
            runOnUiThread(() -> {
                try {
                    if (android.os.Build.VERSION.SDK_INT >= 23
                            && checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        voicePending = true;
                        requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO}, 44);
                        return;
                    }
                    startRecognizer();
                } catch (Exception e) {
                    voiceResult("", false);
                }
            });
        }

        private void startRecognizer() {
            try {
                if (recognizer != null) { try { recognizer.destroy(); } catch (Exception ignored) { } }
                recognizer = android.speech.SpeechRecognizer.createSpeechRecognizer(MainActivity.this);
                recognizer.setRecognitionListener(new android.speech.RecognitionListener() {
                    public void onReadyForSpeech(Bundle b) { }
                    public void onBeginningOfSpeech() { }
                    public void onRmsChanged(float v) { }
                    public void onBufferReceived(byte[] b) { }
                    public void onEndOfSpeech() { }
                    public void onPartialResults(Bundle b) { }
                    public void onEvent(int i, Bundle b) { }
                    public void onError(int error) { voiceResult("", false); }
                    public void onResults(Bundle results) {
                        try {
                            java.util.ArrayList<String> r = results.getStringArrayList(android.speech.SpeechRecognizer.RESULTS_RECOGNITION);
                            voiceResult(r != null && !r.isEmpty() ? r.get(0) : "", r != null && !r.isEmpty());
                        } catch (Exception e) { voiceResult("", false); }
                    }
                });
                Intent it = new Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                it.putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                it.putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, "fa-IR");
                it.putExtra(android.speech.RecognizerIntent.EXTRA_PROMPT, "بگویید: سه تا نوشابه، دو تا چیپس…");
                recognizer.startListening(it);
            } catch (Exception e) {
                voiceResult("", false);
            }
        }

        private void voiceResult(final String text, final boolean ok) {
            /* آزادسازی فوری تشخیص‌دهنده صدا برای کاهش مصرف حافظه */
            if (recognizer != null) {
                try { recognizer.destroy(); } catch (Exception ignored) { }
                recognizer = null;
            }
            runOnUiThread(() -> {
                try {
                    webView.evaluateJavascript("window.__voiceResult && window.__voiceResult(" + org.json.JSONObject.quote(text == null ? "" : text) + "," + (ok ? "true" : "false") + ")", null);
                } catch (Exception ignored) { }
            });
        }

        @JavascriptInterface
        public String btList() {
            try {
                if (android.os.Build.VERSION.SDK_INT >= 31
                        && checkSelfPermission("android.permission.BLUETOOTH_CONNECT") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    runOnUiThread(() -> requestPermissions(new String[]{"android.permission.BLUETOOTH_CONNECT"}, 45));
                    return "[]";
                }
                android.bluetooth.BluetoothAdapter ad = android.bluetooth.BluetoothAdapter.getDefaultAdapter();
                if (ad == null) return "[]";
                org.json.JSONArray arr = new org.json.JSONArray();
                for (android.bluetooth.BluetoothDevice d : ad.getBondedDevices()) {
                    org.json.JSONObject o = new org.json.JSONObject();
                    o.put("name", d.getName() == null ? "" : d.getName());
                    o.put("address", d.getAddress());
                    arr.put(o);
                }
                return arr.toString();
            } catch (Exception e) {
                return "[]";
            }
        }

        @JavascriptInterface
        public void btPrint(final String address, final String base64) {
            new Thread(() -> {
                android.bluetooth.BluetoothSocket sock = null;
                try {
                    android.bluetooth.BluetoothAdapter ad = android.bluetooth.BluetoothAdapter.getDefaultAdapter();
                    if (ad == null || !ad.isEnabled()) { btResult("بلوتوث خاموش است"); return; }
                    android.bluetooth.BluetoothDevice dev = ad.getRemoteDevice(address);
                    sock = dev.createRfcommSocketToServiceRecord(java.util.UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"));
                    ad.cancelDiscovery();
                    sock.connect();
                    byte[] data = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
                    java.io.OutputStream out = sock.getOutputStream();
                    int off = 0;
                    while (off < data.length) {
                        int n = Math.min(4096, data.length - off);
                        out.write(data, off, n);
                        off += n;
                    }
                    out.flush();
                    Thread.sleep(400);
                    btResult("🖨 چاپ شد");
                } catch (Exception e) {
                    btResult("خطا در اتصال به چاپگر: " + (e.getMessage() == null ? "" : e.getMessage()));
                } finally {
                    if (sock != null) { try { sock.close(); } catch (Exception ignored) { } }
                }
            }).start();
        }

        void btResult(final String msg) {
            runOnUiThread(() -> {
                try {
                    webView.evaluateJavascript("window.__btResult && window.__btResult(" + org.json.JSONObject.quote(msg == null ? "" : msg) + ")", null);
                } catch (Exception ignored) { }
            });
        }

        @JavascriptInterface
        public String takeSharedText() {
            String s = pendingSharedText;
            pendingSharedText = null;
            return s == null ? "" : s;
        }

        @JavascriptInterface
        public void shareText(final String text) {
            runOnUiThread(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType("text/plain");
                    i.putExtra(Intent.EXTRA_TEXT, text);
                    startActivity(Intent.createChooser(i, "اشتراک‌گذاری"));
                } catch (Exception e) {
                    toast("اشتراک‌گذاری ممکن نشد");
                }
            });
        }

        private void toast(String msg) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show());
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == EXPORT_TREE_REQUEST) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri treeUri = data.getData();
                try {
                    int flags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    getContentResolver().takePersistableUriPermission(treeUri, flags);
                } catch (Exception ignored) {}
                String docId = android.provider.DocumentsContract.getTreeDocumentId(treeUri);
                String label = docId;
                int colon = docId.indexOf(':');
                if (colon >= 0) label = docId.substring(colon + 1);
                if (label.isEmpty()) label = docId;
                getSharedPreferences("ihesab", Context.MODE_PRIVATE).edit()
                    .putString("exportTree", treeUri.toString())
                    .putString("exportTreeLabel", label)
                    .apply();
                final String safeLabel = label.replace("'", " ");
                if (webView != null) {
                    webView.post(() -> webView.evaluateJavascript(
                        "window.__folderPicked && window.__folderPicked('" + safeLabel + "')", null));
                }
            }
            return;
        }
        if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript("window.handleBack ? (handleBack() ? 'exit' : 'stay') : 'exit'",
                v -> {
                    if (v != null && v.contains("exit")) {
                        MainActivity.super.onBackPressed();
                    }
                });
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
