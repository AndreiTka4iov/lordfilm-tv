package tv.lordfilm.app

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import tv.lordfilm.app.catalog.*

class NativeCatalogTest {
    private val origin = "https://source.example"

    private fun flight(value: Any, prefix: String = ""): String {
        val payload = prefix + "1:" + value.toString() + "\n"
        return "<script>self.__next_f.push(${JSONArray().put(1).put(payload)})</script>"
    }

    private fun item(index: Int) =
        JSONObject()
            .put("id", "$index")
            .put("slug", "movie-$index")
            .put("title", "Фильм $index")
            .put("year", 2026)
            .put("poster", "https://image.tmdb.org/t/p/w500/a.jpg")
            .put("xfields", JSONObject().put("rating", "8.2").put("collaps_id", "42"))

    private fun catalog(fetcher: HtmlFetcher) = NativeCatalog(origin, fetcher)

    private fun failure(status: Int, action: () -> Unit) {
        try {
            action()
            fail("Expected source failure $status")
        } catch (error: SourceFailure) {
            assertEquals(status, error.status)
        }
    }

    @Test
    fun byteLengthFlightTextDoesNotCorruptCatalogParsing() {
        val text = "Текст\nс кириллицей"
        val prefix = "0:T${text.toByteArray().size.toString(16)},$text"
        val row =
            JSONObject()
                .put("initialList", JSONObject().put("items", JSONArray((1..20).map(::item))))
        assertEquals(20, CatalogParser.pool(flight(row, prefix), "new", origin).length())
        failure(502) { CatalogParser.pool(flight(JSONObject()), "new", origin) }
    }

    @Test
    fun poolsAreDistinctAndBoundedAndPopularSkipsUnavailable() {
        val rows = JSONArray()
        for (index in 1..23) rows.put(
            item(index)
                .put("newsId", "$index")
                .put("anchorId", "films-rank-$index")
                .put("posterUrl", "https://image.tmdb.org/t/p/w500/a.jpg")
                .put("kp", 9)
                .put("inCatalog", index > 2)
        )
        val result = CatalogParser.pool(flight(JSONObject().put("rows", rows)), "popular", origin)
        assertEquals(20, result.length())
        assertEquals("3", result.getJSONObject(0).getString("id"))
        assertEquals(9.0, result.getJSONObject(0).getDouble("rating"), 0.0)
        failure(502) {
            CatalogParser.pool(
                flight(
                    JSONObject()
                        .put(
                            "initialList",
                            JSONObject().put("items", JSONArray(listOf(item(1), item(1)))),
                        )
                ),
                "series",
                origin,
            )
        }
    }

    @Test
    fun detailClampsMetadataAndRejectsUnsafeArtwork() {
        val row =
            item(1)
                .put("description", "x".repeat(13000))
                .put("poster", "javascript:alert(1)")
                .put("backdrop", "https://image.tmdb.org/t/p/original/b.jpg")
        row.getJSONObject("xfields").put("lf_media_kind", "tv").put("actors", "Первый, Второй")
        val result = CatalogParser.detail(flight(row), "1", origin)
        assertEquals("series", result.getString("kind"))
        assertTrue(result.isNull("poster"))
        assertEquals(12000, result.getString("description").length)
        assertEquals("https://image.tmdb.org/t/p/w780/b.jpg", result.getString("backdrop"))
        assertEquals(2, result.getJSONArray("actors").length())
    }

    @Test
    fun storedArtworkIsPreferredOverTmdbWithoutChangingTheSourceData() {
        val row = item(1)
        row.getJSONObject("xfields")
            .put("poster", "/uploads/posts/2026-10/poster.webp")
            .put("posterbg", "/uploads/posts/2026-10/backdrop.webp")
        val html = flight(row)
        assertEquals(
            "$origin/uploads/posts/2026-10/poster.webp",
            CatalogParser.artwork(html, "1", origin),
        )
        val detail = CatalogParser.detail(html, "1", origin)
        assertEquals("$origin/uploads/posts/2026-10/poster.webp", detail.getString("poster"))
        assertEquals("$origin/uploads/posts/2026-10/backdrop.webp", detail.getString("backdrop"))
    }

    @Test
    fun searchDistinguishesEmptyFromDamagedSourceAndCapsAt40() {
        val rows = JSONArray((1..45).map(::item))
        val result =
            CatalogParser.search(
                flight(JSONObject().put("listVersionKey", "test").put("items", rows)),
                "Test",
                origin,
            )
        assertEquals(40, result.getJSONArray("items").length())
        assertTrue(result.getBoolean("limited"))
        val empty =
            CatalogParser.search(
                flight(JSONObject().put("children", "Ничего не найдено")),
                "No",
                origin,
            )
        assertEquals(0, empty.getJSONArray("items").length())
        failure(502) { CatalogParser.search("<html>broken</html>", "No", origin) }
    }

    @Test
    fun requestRouterRejectsForeignUrlsUnknownPathsAndDuplicateParametersBeforeNetwork() {
        var calls = 0
        val source = catalog { _, _, _ ->
            calls++
            ""
        }
        listOf(
                "http://localhost:3001/v1/catalog/pools/popular",
                "/v1/catalog/search?q=A",
                "/v1/catalog/search?q=Test&q=Again",
                "/v1/catalog/search?q=Test&other=x",
                "/v1/movies/1/test/playback?season=0",
            )
            .forEach { path -> failure(400) { source.resolve(path, RequestToken()) } }
        failure(404) { source.resolve("/v1/unknown", RequestToken()) }
        assertEquals(0, calls)
    }

    @Test
    fun fullRequestFlowResolvesMovieAndSeriesWithoutAnyBackendUrl() {
        val media = "https://media.interkh.com/movie/master.m3u8"
        val series =
            "playlist: {seasons:" +
                JSONArray()
                    .put(
                        JSONObject()
                            .put("season", 1)
                            .put(
                                "episodes",
                                JSONArray()
                                    .put(
                                        JSONObject()
                                            .put("episode", "2")
                                            .put("hls", media)
                                            .put("title", "Вторая")
                                    ),
                            )
                    ) +
                "}"
        val calls = mutableListOf<String>()
        val source = catalog { url, _, _ ->
            calls.add(url)
            if (url.contains("/embed/")) series else flight(item(1))
        }
        val detail = source.resolve("/v1/movies/1/movie-1", RequestToken())
        assertEquals("Фильм 1", detail.getString("title"))
        val playback =
            source.resolve("/v1/movies/1/movie-1/playback?season=1&episode=2", RequestToken())
        assertEquals(2, playback.getInt("episode"))
        assertEquals(
            "Вторая",
            playback.getJSONArray("episodes").getJSONObject(0).getString("title"),
        )
        assertEquals(
            listOf(
                "$origin/movie/1/movie-1",
                "$origin/movie/1/movie-1",
                "https://api.ortified.ws/embed/movie/42",
            ),
            calls,
        )
    }

    @Test
    fun providerParserReadsOnlyJsonAndValidatesMediaAndSelections() {
        val media = "https://media.interkh.com/movie/master.m3u8"
        val parsed =
            PlaybackParser.playback(
                "unixTime=1780000000;\nvar lok=42, tag=\"abcdef123456\";\nsource:{hls:\"$media\",audio:{\"names\":[\"Русский\"]}}"
            )
        assertEquals("$media?abcdef123456", parsed.getString("src"))
        assertEquals(1780000000L, parsed.getLong("cdnTime"))
        assertEquals("Русский", parsed.getJSONArray("audioNames").getString(0))
        failure(422) { PlaybackParser.playback("source:{hls:window.execute()}") }
        failure(422) {
            PlaybackParser.playback("source:{hls:\"https://evil.example/master.m3u8\"}")
        }
        failure(422) { PlaybackParser.playback("source:{hls:\"$media\"}", 1) }
    }
}
