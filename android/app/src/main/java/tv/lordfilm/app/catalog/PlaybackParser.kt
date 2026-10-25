package tv.lordfilm.app.catalog

import java.net.URI
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

object PlaybackParser {
    private fun literal(html: String, pattern: Regex): Any? {
        val start = pattern.find(html)?.range?.last?.plus(1) ?: return null
        val first = html.getOrNull(start) ?: return null
        if (first !in listOf('[', '{', '"')) return null
        var quoted = false
        var escaped = false
        var depth = 0
        for (index in start until html.length) {
            val char = html[index]
            if (quoted) {
                if (escaped) escaped = false
                else if (char == '\\') escaped = true
                else if (char == '"') {
                    quoted = false
                    if (first == '"') return parse(html.substring(start, index + 1))
                }
            } else
                when (char) {
                    '"' -> quoted = true
                    '[',
                    '{' -> depth++
                    ']',
                    '}' -> if (--depth == 0) return parse(html.substring(start, index + 1))
                }
        }
        return null
    }

    private fun parse(value: String): Any? =
        try {
            JSONTokener(value).nextValue()
        } catch (_: Exception) {
            null
        }

    private fun positive(value: Any?): Int? =
        CatalogParser.number(value, 1.0, 9999.0)?.takeIf { it % 1 == 0.0 }?.toInt()

    private fun records(value: JSONArray): List<JSONObject> =
        (0 until value.length()).mapNotNull { value.optJSONObject(it) }

    private fun audio(value: Any?): JSONArray =
        JSONArray(
            (value as? JSONObject)?.optJSONArray("names")?.let {
                (0 until minOf(it.length(), 32)).map { index ->
                    (it.opt(index) as? String)?.take(100) ?: ""
                }
            } ?: emptyList<String>()
        )

    private fun media(value: Any?, html: String): String {
        val text = value as? String ?: throw SourceFailure(422)
        if (text.length > 8192) throw SourceFailure(422)
        val uri =
            try {
                URI(text)
            } catch (_: Exception) {
                throw SourceFailure(422)
            }
        if (
            uri.scheme != "https" ||
                uri.host?.endsWith(".interkh.com") != true ||
                uri.rawUserInfo != null ||
                !uri.path.endsWith(".m3u8")
        )
            throw SourceFailure(422)
        val tag =
            Regex(
                    "^[\\t ]*var\\s+lok\\s*=\\s*\\d+\\s*,\\s*[a-zA-Z_$][\\w$]*\\s*=\\s*\"([0-9a-f]{8,64})\"\\s*;",
                    RegexOption.MULTILINE,
                )
                .find(html)
                ?.groupValues
                ?.get(1)
        return if (tag == null) text else text + (if (text.contains('?')) "&" else "?") + tag
    }

    fun playback(
        html: String,
        selectedSeason: Int? = null,
        selectedEpisode: Int? = null,
    ): JSONObject {
        val time =
            Regex("\\bunixTime\\s*=\\s*(\\d{9,11})\\b")
                .find(html)
                ?.groupValues
                ?.get(1)
                ?.toLongOrNull()
        val result = JSONObject().put("type", "hls").put("cdnTime", time ?: JSONObject.NULL)
        val seasonsValue = literal(html, Regex("\\bseasons\\s*:\\s*"))
        if (seasonsValue is JSONArray) {
            val seasons =
                records(seasonsValue)
                    .filter {
                        it.opt("blocked") != true &&
                            positive(it.opt("season")) != null &&
                            it.optJSONArray("episodes") != null
                    }
                    .sortedBy { positive(it.opt("season")) }
            if (seasons.size > 200) throw SourceFailure(422)
            val season =
                seasons.firstOrNull {
                    selectedSeason == null || positive(it.opt("season")) == selectedSeason
                } ?: throw SourceFailure(422)
            val episodes =
                records(season.getJSONArray("episodes"))
                    .filter {
                        it.opt("blocked") != true &&
                            positive(it.opt("episode")) != null &&
                            it.opt("hls") is String
                    }
                    .sortedBy { positive(it.opt("episode")) }
            if (episodes.size > 300) throw SourceFailure(422)
            val episode =
                episodes.firstOrNull {
                    selectedEpisode == null || positive(it.opt("episode")) == selectedEpisode
                } ?: throw SourceFailure(422)
            return result
                .put("kind", "series")
                .put("src", media(episode.opt("hls"), html))
                .put("audioNames", audio(episode.opt("audio")))
                .put("seasons", JSONArray(seasons.map { positive(it.opt("season")) }.distinct()))
                .put(
                    "episodes",
                    JSONArray(
                        episodes.map {
                            JSONObject()
                                .put("number", positive(it.opt("episode")))
                                .put(
                                    "title",
                                    (it.opt("title") as? String)?.take(120)
                                        ?: (positive(it.opt("episode")) ?: 0).toString(),
                                )
                        }
                    ),
                )
                .put("season", positive(season.opt("season")))
                .put("episode", positive(episode.opt("episode")))
        }
        if (selectedSeason != null || selectedEpisode != null) throw SourceFailure(422)
        return result
            .put("kind", "movie")
            .put("src", media(literal(html, Regex("\\bhls\\s*:\\s*")), html))
            .put("audioNames", audio(literal(html, Regex("\\baudio\\s*:\\s*"))))
            .put("seasons", JSONArray())
            .put("episodes", JSONArray())
            .put("season", JSONObject.NULL)
            .put("episode", JSONObject.NULL)
    }
}
