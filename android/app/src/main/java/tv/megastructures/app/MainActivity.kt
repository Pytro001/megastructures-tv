package tv.megastructures.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import org.json.JSONObject
import java.util.Locale

/**
 * Megastructures TV for Fire OS: one full screen WebView running the Three.js TV app.
 *
 * Remote keys:
 *  - D-pad and Select reach the page as normal DOM key events (keyCodes 37 to 40 and 13),
 *    which is how Amazon documents Fire TV web apps.
 *  - Back, Menu, Play/Pause, Rewind and Fast forward are forwarded to the page through
 *    window.MegaTV.key(name). Back exits the app when the page does not use it (home row).
 *  - The microphone button on a Fire TV voice remote is a system button reserved for Alexa
 *    and cannot be intercepted, so Menu is the Ask button. KEYCODE_SEARCH (game controllers,
 *    some remotes) asks too.
 * Voice: the page calls MegaTVNative.startListening(); results come back through
 * window.MegaTV.onVoice / onVoicePartial / onVoiceError. Answers are spoken with TextToSpeech.
 *
 * Status: written for the hackathon and not yet compiled or run on a device or emulator.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var pendingListen = false

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemUi()

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        web = WebView(this)
        web.setBackgroundColor(0xFF050608.toInt())
        web.isFocusable = true
        web.isFocusableInTouchMode = true
        setContentView(web)

        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            // the films start without a tap: there is no tap on a TV
            mediaPlaybackRequiresUserGesture = false
            // the bundled app is https://appassets.androidplatform.net; a development API may be http
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
        }
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        web.webChromeClient = WebChromeClient()
        web.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                // tell the page it runs on a TV host before its own scripts look
                view.evaluateJavascript(hostScript(), null)
            }
        }
        web.addJavascriptInterface(NativeBridge(), "MegaTVNative")

        tts = TextToSpeech(this) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) tts?.language = Locale.US
        }

        if (savedInstanceState == null) web.loadUrl(startUrl()) else web.restoreState(savedInstanceState)
        web.requestFocus()
    }

    /** where the TV UI comes from: the bundled build, or a dev server set with -PmegatvUrl */
    private fun startUrl(): String {
        val base = BuildConfig.START_URL.ifBlank { "https://appassets.androidplatform.net/assets/www/index.html" }
        return Uri.parse(base).buildUpon()
            .appendQueryParameter("tv", "1")
            .appendQueryParameter("api", BuildConfig.API_BASE)
            .build().toString()
    }

    private fun hostScript(): String {
        val host = JSONObject()
            .put("tv", true)
            .put("api", BuildConfig.API_BASE)
            .put("platform", "fire-os")
            .put("version", BuildConfig.VERSION_NAME)
        return "window.MegaTVHost = $host;"
    }

    private fun hideSystemUi() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_STABLE)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemUi()
    }

    /* ---------------- remote keys ---------------- */

    private fun keyName(code: Int): String? = when (code) {
        KeyEvent.KEYCODE_BACK -> "back"
        KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_SEARCH -> "menu"
        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_MEDIA_PLAY, KeyEvent.KEYCODE_MEDIA_PAUSE -> "playpause"
        KeyEvent.KEYCODE_MEDIA_REWIND -> "rewind"
        KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "forward"
        else -> null // D-pad and Select go to the page as DOM key events
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val name = keyName(event.keyCode) ?: return super.dispatchKeyEvent(event)
        // act on the press, swallow the release, so one press is one action
        if (event.action != KeyEvent.ACTION_DOWN) return true
        if (event.repeatCount > 0 && name != "rewind" && name != "forward") return true
        web.evaluateJavascript("(window.MegaTV && window.MegaTV.key('$name')) === true") { result ->
            if (name == "back" && result != "true") finish()
        }
        return true
    }

    /* ---------------- voice in ---------------- */

    private fun js(fn: String, arg: String) {
        val quoted = JSONObject.quote(arg)
        runOnUiThread { web.evaluateJavascript("window.MegaTV && window.MegaTV.$fn($quoted)", null) }
    }

    private fun startListening() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            // Fire OS does not always ship a recogniser to third party apps; the page then offers typed questions
            js("onVoiceError", "unavailable")
            return
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingListen = true
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), REQ_AUDIO)
            return
        }
        recognizer?.destroy()
        val r = SpeechRecognizer.createSpeechRecognizer(this)
        recognizer = r
        r.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
            override fun onError(error: Int) { js("onVoiceError", "error-$error") }
            override fun onPartialResults(partial: Bundle?) {
                partial?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let { js("onVoicePartial", it) }
            }
            override fun onResults(results: Bundle?) {
                val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                if (text.isNullOrBlank()) js("onVoiceError", "no-match") else js("onVoice", text)
            }
        })
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        r.startListening(intent)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQ_AUDIO) return
        val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
        if (granted && pendingListen) startListening() else js("onVoiceError", "not-allowed")
        pendingListen = false
    }

    /** what the page can call: window.MegaTVNative.startListening() and friends (called on a binder thread) */
    inner class NativeBridge {
        @JavascriptInterface fun startListening() = runOnUiThread { this@MainActivity.startListening() }
        @JavascriptInterface fun stopListening() = runOnUiThread { recognizer?.cancel() }
        @JavascriptInterface fun speak(text: String) = runOnUiThread {
            if (ttsReady) tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "answer")
        }
        @JavascriptInterface fun exit() = runOnUiThread { finish() }
    }

    /* ---------------- lifecycle ---------------- */

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onPause() { web.onPause(); recognizer?.cancel(); tts?.stop(); super.onPause() }
    override fun onResume() { super.onResume(); web.onResume(); hideSystemUi() }

    override fun onDestroy() {
        recognizer?.destroy()
        tts?.shutdown()
        web.destroy()
        super.onDestroy()
    }

    companion object { private const val REQ_AUDIO = 42 }
}
