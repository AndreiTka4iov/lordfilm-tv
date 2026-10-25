package tv.lordfilm.app

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.graphics.Color
import android.os.Bundle
import android.view.KeyEvent
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import tv.lordfilm.app.catalog.NativeArtwork
import tv.lordfilm.app.catalog.NativeCatalog
import tv.lordfilm.app.catalog.NativeHttp

class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private lateinit var assets: ExportAssets
    private lateinit var transport: NativeHttp
    private lateinit var host: AndroidHost
    private lateinit var artwork: NativeArtwork
    private var paused = false
    private var backPending = false
    private var rendererGone = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        assets = ExportAssets(this)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        web =
            WebView(this).apply {
                setBackgroundColor(Color.rgb(20, 20, 20))
                isFocusableInTouchMode = true
                setOnKeyListener { _, _, event -> handleRemoteKey(event) }
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    allowFileAccess = false
                    allowContentAccess = false
                    mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                    mediaPlaybackRequiresUserGesture = true
                    setSupportMultipleWindows(false)
                }
                webChromeClient = WebChromeClient()
                webViewClient =
                    object : WebViewClient() {
                        override fun shouldInterceptRequest(
                            view: WebView,
                            request: WebResourceRequest,
                        ) =
                            artwork.intercept(request.url)
                                ?: assets.intercept(request.url)
                                ?: transport.image(request.url.toString())

                        override fun shouldOverrideUrlLoading(
                            view: WebView,
                            request: WebResourceRequest,
                        ): Boolean = !assets.isLocal(request.url)

                        override fun onPageFinished(view: WebView, url: String) {
                            view.evaluateJavascript(
                                "if(document.activeElement === document.body) document.getElementById('main-content')?.focus({preventScroll:true})",
                                null,
                            )
                        }

                        override fun onRenderProcessGone(
                            view: WebView,
                            detail: RenderProcessGoneDetail,
                        ): Boolean {
                            rendererGone = true
                            host.close()
                            artwork.close()
                            transport.close()
                            (view.parent as? ViewGroup)?.removeView(view)
                            view.destroy()
                            if (!isFinishing)
                                AlertDialog.Builder(this@MainActivity)
                                    .setMessage(R.string.web_error)
                                    .setPositiveButton(R.string.retry) { _, _ -> recreate() }
                                    .setNegativeButton(R.string.exit) { _, _ -> finish() }
                                    .show()
                            return true
                        }

                        override fun onReceivedError(
                            view: WebView,
                            request: WebResourceRequest,
                            error: WebResourceError,
                        ) {
                            if (request.isForMainFrame && !isFinishing) {
                                AlertDialog.Builder(this@MainActivity)
                                    .setMessage(R.string.web_error)
                                    .setPositiveButton(R.string.retry) { _, _ -> loadHome() }
                                    .show()
                            }
                        }
                    }
            }
        transport = NativeHttp(web.settings.userAgentString)
        artwork = NativeArtwork(BuildConfig.SOURCE_ORIGIN, transport)
        host = AndroidHost(NativeCatalog(BuildConfig.SOURCE_ORIGIN, transport), assets.origin)
        val webViewMajor =
            WebViewCompat.getCurrentWebViewPackage(this)
                ?.versionName
                ?.substringBefore('.')
                ?.toIntOrNull() ?: 0
        if (
            webViewMajor < 111 ||
                !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
        ) {
            AlertDialog.Builder(this)
                .setMessage(R.string.webview_update)
                .setOnCancelListener { finish() }
                .setPositiveButton(R.string.exit) { _, _ -> finish() }
                .show()
            return
        }
        WebViewCompat.addWebMessageListener(web, "LordFilmAndroid", setOf(assets.origin), host)
        setContentView(
            web,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )
        // Acquire native focus before loading DOM; TV otherwise selects the first link on the first
        // D-pad press.
        web.requestFocus()
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() = back()
            },
        )
        getSharedPreferences("connection", MODE_PRIVATE).edit().clear().apply()
        loadHome()
    }

    private fun loadHome() {
        web.loadUrl("${assets.origin}/")
    }

    private fun back() {
        if (backPending) return
        backPending = true
        web.evaluateJavascript(
            """
            (() => {
              const target = document.activeElement || document.body;
              if (target.matches('input,textarea') && document.querySelector('[data-player-screen]') === null) {
                target.blur(); document.getElementById('main-content')?.focus(); return true;
              }
              if (target === document.getElementById('main-content')) return false;
              return !target.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true}));
            })()
            """
                .trimIndent()
        ) { consumed ->
            backPending = false
            if (isFinishing || consumed == "true") return@evaluateJavascript
            if (web.canGoBack()) web.goBack()
            else
                AlertDialog.Builder(this)
                    .setTitle(R.string.exit_title)
                    .setPositiveButton(R.string.exit) { _, _ -> finish() }
                    .setNegativeButton(R.string.stay, null)
                    .show()
        }
    }

    private fun handleRemoteKey(event: KeyEvent): Boolean {
        val key =
            when (event.keyCode) {
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> "MediaPlayPause"
                KeyEvent.KEYCODE_MEDIA_PLAY -> "MediaPlay"
                KeyEvent.KEYCODE_MEDIA_PAUSE -> "MediaPause"
                else -> null
            }
        if (key != null) {
            if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0)
                web.evaluateJavascript(
                    "document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'$key',bubbles:true,cancelable:true}))",
                    null,
                )
            return true
        }
        return false
    }

    override fun onPause() {
        paused = true
        if (!rendererGone) {
            web.evaluateJavascript("window.dispatchEvent(new Event('lordfilm:pause'))", null)
            web.onPause()
        }
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        if (::web.isInitialized && !rendererGone) {
            web.onResume()
            if (paused)
                web.evaluateJavascript("window.dispatchEvent(new Event('lordfilm:pause'))", null)
            paused = false
        }
    }

    override fun onDestroy() {
        if (::artwork.isInitialized) artwork.close()
        if (::host.isInitialized) host.close()
        if (::transport.isInitialized) transport.close()
        (web.parent as? ViewGroup)?.removeView(web)
        if (!rendererGone) {
            if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))
                WebViewCompat.removeWebMessageListener(web, "LordFilmAndroid")
            web.stopLoading()
            web.destroy()
        }
        super.onDestroy()
    }
}
