package tv.lordfilm.app

import android.net.Uri
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.FutureTask
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject
import tv.lordfilm.app.catalog.NativeCatalog
import tv.lordfilm.app.catalog.RequestToken
import tv.lordfilm.app.catalog.SourceFailure

/** Origin-restricted async messages; no sockets, HTTP listener or synchronous JS networking. */
class AndroidHost(private val catalog: NativeCatalog, private val origin: String) :
    WebViewCompat.WebMessageListener, AutoCloseable {
    private data class Pending(val token: RequestToken, val task: FutureTask<Unit>)

    private val executor = ThreadPoolExecutor(2, 2, 30, TimeUnit.SECONDS, ArrayBlockingQueue(6))
    private val pending = ConcurrentHashMap<String, Pending>()
    private val closed = AtomicBoolean(false)

    override fun onPostMessage(
        view: WebView,
        message: WebMessageCompat,
        sourceOrigin: Uri,
        isMainFrame: Boolean,
        replyProxy: JavaScriptReplyProxy,
    ) {
        if (!isMainFrame || sourceOrigin.toString().trimEnd('/') != origin || closed.get()) return
        if (message.type != WebMessageCompat.TYPE_STRING) return
        val raw = message.data ?: return
        if (raw.length > 8192) return
        val request =
            try {
                JSONObject(raw)
            } catch (_: Exception) {
                return
            }
        val cancel = request.opt("cancel") as? String
        if (cancel != null) {
            cancel(cancel)
            return
        }
        val id = request.opt("id") as? String ?: return
        val path = request.opt("path") as? String ?: return
        if (!Regex("[a-zA-Z0-9-]{1,80}").matches(id) || pending.containsKey(id)) return
        val token = RequestToken()
        val task =
            FutureTask<Unit> {
                try {
                    val body = catalog.resolve(path, token)
                    if (body.toString().toByteArray(Charsets.UTF_8).size > 128 * 1024)
                        throw SourceFailure()
                    reply(view, replyProxy, id, token, 200, body)
                } catch (error: Exception) {
                    val status = (error as? SourceFailure)?.status ?: 502
                    if (BuildConfig.DEBUG && !token.cancelled.get())
                        android.util.Log.w(
                            "LordFilmNative",
                            "Native request failed: $status",
                            error,
                        )
                    reply(
                        view,
                        replyProxy,
                        id,
                        token,
                        status,
                        JSONObject().put("error", "Source unavailable"),
                    )
                } finally {
                    pending.remove(id)
                }
            }
        pending[id] = Pending(token, task)
        try {
            executor.execute(task)
        } catch (_: RejectedExecutionException) {
            pending.remove(id)
            reply(view, replyProxy, id, token, 503, JSONObject().put("error", "Busy"))
        }
    }

    private fun reply(
        view: WebView,
        proxy: JavaScriptReplyProxy,
        id: String,
        token: RequestToken,
        status: Int,
        body: JSONObject,
    ) {
        val response = JSONObject().put("id", id).put("status", status).put("body", body).toString()
        view.post {
            if (!closed.get() && !token.cancelled.get()) {
                try {
                    proxy.postMessage(response)
                } catch (_: IllegalStateException) {
                    /* Original page has gone away. */
                }
            }
        }
    }

    private fun cancel(id: String) {
        pending.remove(id)?.let {
            it.token.cancel()
            it.task.cancel(true)
            executor.remove(it.task)
        }
    }

    override fun close() {
        closed.set(true)
        pending.keys.toList().forEach(::cancel)
        executor.shutdownNow()
    }
}
