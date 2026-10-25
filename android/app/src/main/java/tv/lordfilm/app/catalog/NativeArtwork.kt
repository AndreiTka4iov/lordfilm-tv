package tv.lordfilm.app.catalog

import android.net.Uri
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** Lazily resolve source-owned artwork for Top 100 rows that only contain TMDB artwork. */
class NativeArtwork(private val origin: String, private val http: NativeHttp) : AutoCloseable {
    private data class Address(val url: String, val expires: Long)

    private val addresses = LinkedHashMap<String, Address>()
    private val permits = Semaphore(2)
    private val requests = ConcurrentHashMap.newKeySet<RequestToken>()
    private val closed = AtomicBoolean(false)

    fun intercept(uri: Uri): WebResourceResponse? {
        if (
            uri.scheme != "https" ||
                uri.host != "appassets.androidplatform.net" ||
                !uri.path.orEmpty().startsWith("/artwork/")
        )
            return null
        val match =
            Regex("/artwork/([0-9]{1,12})/([a-zA-Z0-9_-]{1,200})").matchEntire(uri.path.orEmpty())
        if (match == null || uri.query != null || uri.fragment != null || closed.get())
            return failure()
        val key = uri.path.orEmpty()
        try {
            val known =
                synchronized(addresses) {
                    addresses[key]?.takeIf { it.expires > System.nanoTime() }?.url
                }
            val url =
                known
                    ?: run {
                        if (!permits.tryAcquire(10, TimeUnit.SECONDS)) return failure()
                        val token = RequestToken()
                        requests.add(token)
                        try {
                            if (closed.get()) return failure()
                            val html =
                                http.fetch(
                                    "$origin/movie/${match.groupValues[1]}/${match.groupValues[2]}",
                                    4 * 1024 * 1024,
                                    token,
                                )
                            val result = CatalogParser.artwork(html, match.groupValues[1], origin)
                            synchronized(addresses) {
                                addresses[key] =
                                    Address(result, System.nanoTime() + TimeUnit.MINUTES.toNanos(5))
                                while (addresses.size > 64) addresses.remove(addresses.keys.first())
                            }
                            result
                        } finally {
                            requests.remove(token)
                            permits.release()
                        }
                    }
            return http.image(url) ?: failure()
        } catch (error: Exception) {
            if (tv.lordfilm.app.BuildConfig.DEBUG && !closed.get())
                android.util.Log.w("LordFilmArtwork", "Artwork lookup failed", error)
            return failure()
        }
    }

    private fun failure() =
        WebResourceResponse(
            "text/plain",
            "UTF-8",
            502,
            "Unavailable",
            emptyMap(),
            ByteArrayInputStream(byteArrayOf()),
        )

    override fun close() {
        closed.set(true)
        requests.forEach { it.cancel() }
        synchronized(addresses) { addresses.clear() }
    }
}
