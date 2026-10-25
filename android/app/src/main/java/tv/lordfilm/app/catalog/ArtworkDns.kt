package tv.lordfilm.app.catalog

import java.net.InetAddress
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit
import okhttp3.Dns

/**
 * Small DNS-answer cache, not an image cache. Never connect artwork requests to local addresses.
 */
class ArtworkDns(private val resolvers: List<Dns>, private val now: () -> Long = System::nanoTime) :
    Dns {
    private var cached = emptyList<InetAddress>()
    private var expires = 0L

    @Synchronized
    override fun lookup(hostname: String): List<InetAddress> {
        if (hostname != "image.tmdb.org") throw UnknownHostException("Unsupported artwork host")
        if (now() < expires && cached.isNotEmpty()) return cached
        for (resolver in resolvers) {
            val addresses =
                try {
                    resolver.lookup(hostname)
                } catch (_: Exception) {
                    continue
                }
            val public =
                addresses
                    .filter {
                        it.address.size == 4 &&
                            !it.isAnyLocalAddress &&
                            !it.isLoopbackAddress &&
                            !it.isSiteLocalAddress &&
                            !it.isLinkLocalAddress &&
                            !it.isMulticastAddress
                    }
                    .take(16)
            if (public.isNotEmpty()) {
                cached = public
                expires = now() + TimeUnit.SECONDS.toNanos(30)
                return public
            }
        }
        throw UnknownHostException("No public artwork address")
    }
}
