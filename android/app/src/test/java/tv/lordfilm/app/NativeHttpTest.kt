package tv.lordfilm.app

import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.junit.Assert.*
import org.junit.Test
import tv.lordfilm.app.catalog.*

class NativeHttpTest {
    @Test
    fun readsBoundedHtmlAndRejectsWrongContentAndRedirects() {
        MockWebServer().use { server ->
            NativeHttp("Test Agent").use { http ->
                server.enqueue(
                    MockResponse().setHeader("Content-Type", "text/html").setBody("<html>OK</html>")
                )
                assertEquals(
                    "<html>OK</html>",
                    http.fetch(server.url("/").toString(), 100, RequestToken()),
                )
                assertEquals("Test Agent", server.takeRequest().getHeader("User-Agent"))
                for (response in
                    listOf(
                        MockResponse().setHeader("Content-Type", "application/json").setBody("{}"),
                        MockResponse()
                            .setResponseCode(302)
                            .setHeader("Location", "http://localhost/secret"),
                        MockResponse()
                            .setHeader("Content-Type", "text/html")
                            .setBody("x".repeat(200)),
                    )) {
                    server.enqueue(response)
                    try {
                        http.fetch(server.url("/").toString(), 100, RequestToken())
                        fail()
                    } catch (error: SourceFailure) {
                        assertEquals(502, error.status)
                    }
                }
            }
        }
    }

    @Test
    fun cancellationStopsTheActualHttpCall() {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE))
            NativeHttp("Test Agent").use { http ->
                val executor = Executors.newSingleThreadExecutor()
                try {
                    val token = RequestToken()
                    val future =
                        executor.submit<Boolean> {
                            try {
                                http.fetch(server.url("/").toString(), 100, token)
                                false
                            } catch (_: Exception) {
                                true
                            }
                        }
                    assertNotNull(server.takeRequest(2, TimeUnit.SECONDS))
                    token.cancel()
                    assertTrue(future.get(2, TimeUnit.SECONDS))
                } finally {
                    executor.shutdownNow()
                }
            }
        }
    }
}
