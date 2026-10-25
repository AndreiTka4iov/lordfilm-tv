package tv.lordfilm.app

import java.net.InetAddress
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit
import okhttp3.Dns
import org.junit.Assert.*
import org.junit.Test
import tv.lordfilm.app.catalog.ArtworkDns

class ArtworkDnsTest {
    private fun resolver(vararg ips: String): Dns =
        object : Dns {
            override fun lookup(hostname: String) = ips.map(InetAddress::getByName)
        }

    @Test
    fun refusesLocalAnswersAndUsesPublicFallback() {
        val dns =
            ArtworkDns(
                listOf(resolver("127.0.0.1", "10.0.0.1", "0.0.0.0"), resolver("169.150.247.40"))
            )
        assertEquals("169.150.247.40", dns.lookup("image.tmdb.org").single().hostAddress)
        try {
            ArtworkDns(listOf(resolver("127.0.0.1"))).lookup("image.tmdb.org")
            fail()
        } catch (_: UnknownHostException) {}
        try {
            dns.lookup("localhost")
            fail()
        } catch (_: UnknownHostException) {}
    }

    @Test
    fun coalescesRepeatedLookupsWithoutCachingImagesOrFailures() {
        var calls = 0
        var now = 0L
        val source =
            object : Dns {
                override fun lookup(hostname: String): List<InetAddress> {
                    calls++
                    return listOf(InetAddress.getByName("169.150.247.40"))
                }
            }
        val dns = ArtworkDns(listOf(source)) { now }
        repeat(4) { dns.lookup("image.tmdb.org") }
        assertEquals(1, calls)
        now += TimeUnit.SECONDS.toNanos(31)
        dns.lookup("image.tmdb.org")
        assertEquals(2, calls)
    }
}
