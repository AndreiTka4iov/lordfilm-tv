package tv.lordfilm.app.catalog

import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import org.json.JSONObject

fun interface HtmlFetcher {
    fun fetch(url: String, limit: Int, token: RequestToken): String
}

/** Same DTOs as the web API, resolved entirely in-process; no HTTP listener. */
class NativeCatalog(private val origin: String, private val fetcher: HtmlFetcher) {
    init {
        val uri = URI(origin)
        require(
            uri.scheme == "https" &&
                !uri.host.isNullOrBlank() &&
                uri.rawUserInfo == null &&
                uri.rawPath.orEmpty() in listOf("", "/") &&
                uri.rawQuery == null &&
                uri.rawFragment == null
        )
    }

    fun resolve(path: String, token: RequestToken): JSONObject {
        if (path.length > 4096 || !path.startsWith("/v1/") || path.contains('#'))
            throw SourceFailure(400)
        val parts = path.split('?', limit = 2)
        val parameters = linkedMapOf<String, String>()
        if (parts.size == 2) {
            for (pair in parts[1].split('&')) {
                val entry = pair.split('=', limit = 2)
                val key = decode(entry[0])
                if (parameters.containsKey(key)) throw SourceFailure(400)
                parameters[key] = decode(entry.getOrElse(1) { "" })
            }
        }
        Regex("/v1/catalog/pools/(popular|new|series)/?").matchEntire(parts[0])?.let {
            if (parameters.isNotEmpty()) throw SourceFailure(400)
            val group = it.groupValues[1]
            val source =
                mapOf("popular" to "/top-100", "new" to "/filmy", "series" to "/serialy")
                    .getValue(group)
            val items =
                CatalogParser.pool(
                    fetcher.fetch(origin + source, 4 * 1024 * 1024, token),
                    group,
                    origin,
                )
            return JSONObject()
                .put("group", group)
                .put("items", items)
                .put(
                    "generatedAt",
                    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT)
                        .apply { timeZone = TimeZone.getTimeZone("UTC") }
                        .format(Date()),
                )
        }
        if (parts[0] == "/v1/catalog/search") {
            if (parameters.keys != setOf("q")) throw SourceFailure(400)
            val raw = parameters.getValue("q")
            if (Regex("[\\u0000-\\u001f\\u007f]").containsMatchIn(raw)) throw SourceFailure(400)
            val query = raw.trim().replace(Regex("\\s+"), " ")
            if (query.length !in 2..200) throw SourceFailure(400)
            return CatalogParser.search(
                fetcher.fetch(
                    "$origin/search?q=${URLEncoder.encode(query, "UTF-8")}&search_text_mode=full",
                    4 * 1024 * 1024,
                    token,
                ),
                query,
                origin,
            )
        }
        val movie =
            Regex("/v1/movies/([0-9]{1,12})/([a-zA-Z0-9_-]{1,200})(/playback)?/?")
                .matchEntire(parts[0]) ?: throw SourceFailure(404)
        val id = movie.groupValues[1]
        val slug = movie.groupValues[2]
        val playback = movie.groupValues[3].isNotEmpty()
        if (!playback && parameters.isNotEmpty()) throw SourceFailure(400)
        val selection = parameters.mapValues { (key, value) ->
            if (key !in setOf("season", "episode") || !Regex("[1-9][0-9]{0,3}").matches(value))
                throw SourceFailure(400)
            value.toInt()
        }
        val html = fetcher.fetch("$origin/movie/$id/$slug", 4 * 1024 * 1024, token)
        if (!playback) return CatalogParser.detail(html, id, origin)
        val providerId =
            CatalogParser.text(
                CatalogParser.item(html, id).optJSONObject("xfields")?.opt("collaps_id")
            )
        if (providerId == null || !Regex("[0-9]{1,12}").matches(providerId))
            throw SourceFailure(422)
        val embed =
            fetcher.fetch("https://api.ortified.ws/embed/movie/$providerId", 2 * 1024 * 1024, token)
        return PlaybackParser.playback(embed, selection["season"], selection["episode"])
    }

    private fun decode(value: String): String =
        try {
            URLDecoder.decode(value, "UTF-8")
        } catch (_: Exception) {
            throw SourceFailure(400)
        }
}
