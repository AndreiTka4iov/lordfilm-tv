package tv.lordfilm.app

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream

class ExportAssets(context: Context) {
    val origin = "https://appassets.androidplatform.net"
    private val assets = WebViewAssetLoader.AssetsPathHandler(context)
    private val loader =
        WebViewAssetLoader.Builder()
            .addPathHandler("/") { path ->
                val file = if (path.isEmpty() || path.endsWith('/')) "${path}index.html" else path
                assets.handle(file) ?: missing()
            }
            .build()

    fun isLocal(uri: Uri): Boolean =
        uri.scheme == Uri.parse(origin).scheme &&
            uri.host == "appassets.androidplatform.net" &&
            uri.port == -1

    fun intercept(uri: Uri): WebResourceResponse? {
        if (uri.host != "appassets.androidplatform.net") return null
        if (!isLocal(uri)) return missing()
        return (loader.shouldInterceptRequest(uri) ?: missing()).also { response ->
            val connections = "https:"
            response.responseHeaders =
                mapOf(
                    "Cache-Control" to "no-store",
                    "X-Content-Type-Options" to "nosniff",
                    "Content-Security-Policy" to
                        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src https: data:; font-src 'self'; connect-src 'self' $connections; media-src https: blob:; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'",
                )
        }
    }

    private fun missing() =
        WebResourceResponse(
            "text/plain",
            "UTF-8",
            404,
            "Not Found",
            emptyMap(),
            ByteArrayInputStream(byteArrayOf()),
        )
}
