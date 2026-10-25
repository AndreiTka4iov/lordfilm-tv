package tv.lordfilm.app.catalog

import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.InterruptedIOException
import java.net.InetAddress
import java.net.SocketTimeoutException
import java.net.URI
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import okhttp3.Call
import okhttp3.Dns
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.dnsoverhttps.DnsOverHttps

class NativeHttp(
    private val userAgent: String,
    private val sourceOrigin: String = tv.lordfilm.app.BuildConfig.SOURCE_ORIGIN,
) : HtmlFetcher, AutoCloseable {
    private val bootstrap = OkHttpClient.Builder().callTimeout(3, TimeUnit.SECONDS).build()
    private val cloudflare =
        DnsOverHttps.Builder()
            .client(bootstrap)
            .url("https://cloudflare-dns.com/dns-query".toHttpUrl())
            .bootstrapDnsHosts(InetAddress.getByName("1.1.1.1"), InetAddress.getByName("1.0.0.1"))
            .includeIPv6(false)
            .build()
    private val google =
        DnsOverHttps.Builder()
            .client(bootstrap)
            .url("https://dns.google/dns-query".toHttpUrl())
            .bootstrapDnsHosts(InetAddress.getByName("8.8.8.8"), InetAddress.getByName("8.8.4.4"))
            .includeIPv6(false)
            .build()
    private val imageDns = ArtworkDns(listOf(cloudflare, google))
    private val client =
        OkHttpClient.Builder()
            .callTimeout(10, TimeUnit.SECONDS)
            .connectTimeout(6, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .followRedirects(false)
            .followSslRedirects(false)
            .dns(
                object : Dns {
                    override fun lookup(hostname: String): List<InetAddress> =
                        if (hostname == "image.tmdb.org") imageDns.lookup(hostname)
                        else Dns.SYSTEM.lookup(hostname)
                }
            )
            .build()
    private val images = Semaphore(4)
    private val closed = AtomicBoolean(false)
    private val imageCalls = ConcurrentHashMap.newKeySet<Call>()
    private val imageStreams = ConcurrentHashMap.newKeySet<InputStream>()

    override fun fetch(url: String, limit: Int, token: RequestToken): String {
        if (closed.get()) throw SourceFailure()
        val call =
            client.newCall(
                Request.Builder()
                    .url(url)
                    .header("Accept", "text/html")
                    .header("User-Agent", userAgent)
                    .build()
            )
        token.attach(call)
        try {
            call.execute().use { response ->
                if (response.code == 404 && URI(url).path.startsWith("/movie/"))
                    throw SourceFailure(404)
                if (URI(url).host == "api.ortified.ws" && response.code in listOf(403, 404, 451))
                    throw SourceFailure(422)
                val body = response.body
                if (
                    !response.isSuccessful ||
                        body == null ||
                        body.contentType()?.toString()?.contains("text/html") != true ||
                        body.contentLength() > limit
                )
                    throw SourceFailure(
                        502,
                        "Source response HTTP ${response.code} from ${URI(url).host}",
                    )
                body.byteStream().use { input ->
                    val output = ByteArrayOutputStream()
                    val buffer = ByteArray(8192)
                    var size = 0
                    while (true) {
                        if (token.cancelled.get()) throw IOException("Cancelled")
                        val count = input.read(buffer)
                        if (count < 0) break
                        size += count
                        if (size > limit) throw SourceFailure()
                        output.write(buffer, 0, count)
                    }
                    return output.toString("UTF-8")
                }
            }
        } catch (_: SocketTimeoutException) {
            throw SourceFailure(504)
        } catch (error: InterruptedIOException) {
            if (!token.cancelled.get()) throw SourceFailure(504) else throw error
        } finally {
            token.detach(call)
        }
    }

    /** Only source-owned uploads and TMDB artwork, streamed with a byte cap. */
    fun image(url: String): WebResourceResponse? {
        val uri =
            try {
                URI(url)
            } catch (_: Exception) {
                return null
            }
        val source = URI(sourceOrigin)
        val sourceImage =
            uri.host == source.host &&
                uri.port == source.port &&
                uri.path.startsWith("/uploads/posts/") &&
                Regex("/uploads/posts/[0-9]{4}-[0-9]{2}/[a-zA-Z0-9_.-]+\\.(?:jpg|jpeg|png|webp)")
                    .matches(uri.path)
        if (uri.host != "image.tmdb.org" && !sourceImage) return null
        val tmdbImage =
            uri.host == "image.tmdb.org" &&
                Regex("/t/p/(?:w[0-9]{2,4}|original)/[a-zA-Z0-9_-]+\\.(?:jpg|jpeg|png|webp)")
                    .matches(uri.path)
        val valid =
            uri.scheme == "https" &&
                uri.rawUserInfo == null &&
                uri.port in listOf(-1, 443) &&
                uri.rawQuery == null &&
                uri.rawFragment == null &&
                (sourceImage || tmdbImage)
        if (!valid || closed.get()) return imageFailure()
        try {
            if (!images.tryAcquire(10, TimeUnit.SECONDS)) return imageFailure()
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
            return imageFailure()
        }
        var imageCall: Call? = null
        try {
            val call =
                client.newCall(Request.Builder().url(url).header("User-Agent", userAgent).build())
            imageCall = call
            imageCalls.add(call)
            if (closed.get()) call.cancel()
            val response = call.execute()
            val body = response.body
            val mime = body?.contentType()?.let { "${it.type}/${it.subtype}" }
            if (
                !response.isSuccessful ||
                    body == null ||
                    mime !in setOf("image/jpeg", "image/png", "image/webp") ||
                    body.contentLength() > 4 * 1024 * 1024
            ) {
                if (tv.lordfilm.app.BuildConfig.DEBUG)
                    android.util.Log.w(
                        "LordFilmImages",
                        "Artwork response status=${response.code}, type=$mime",
                    )
                response.close()
                imageCalls.remove(call)
                images.release()
                return imageFailure()
            }
            lateinit var stream: BoundedStream
            stream =
                BoundedStream(body.byteStream(), 4 * 1024 * 1024) {
                    try {
                        response.close()
                    } finally {
                        imageCalls.remove(call)
                        imageStreams.remove(stream)
                        images.release()
                    }
                }
            imageStreams.add(stream)
            if (closed.get()) stream.close()
            return WebResourceResponse(
                mime,
                null,
                200,
                "OK",
                mapOf("Cache-Control" to "no-store"),
                stream,
            )
        } catch (error: Exception) {
            if (tv.lordfilm.app.BuildConfig.DEBUG && !closed.get())
                android.util.Log.w("LordFilmImages", "Artwork request failed", error)
            imageCall?.let {
                imageCalls.remove(it)
                it.cancel()
            }
            images.release()
            return imageFailure()
        }
    }

    private fun imageFailure() =
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
        imageCalls.forEach { it.cancel() }
        imageStreams.toList().forEach {
            try {
                it.close()
            } catch (_: IOException) {}
        }
        client.dispatcher.cancelAll()
        client.connectionPool.evictAll()
        bootstrap.dispatcher.cancelAll()
        bootstrap.connectionPool.evictAll()
    }
}
