package tv.lordfilm.app.catalog

import java.net.URI
import org.json.JSONArray
import org.json.JSONObject

object CatalogParser {
    private val idPattern = Regex("[0-9]{1,12}")
    private val slugPattern = Regex("[a-zA-Z0-9_-]{1,200}")

    fun text(value: Any?): String? = (value as? String)?.trim()?.takeIf { it.isNotEmpty() }

    fun number(value: Any?, min: Double, max: Double): Double? =
        when (value) {
            is Number -> value.toDouble()
            is String -> value.trim().toDoubleOrNull()
            else -> null
        }?.takeIf { it.isFinite() && it in min..max }

    private fun image(value: Any?, origin: String): String? =
        try {
            text(value)
                ?.let { URI(origin).resolve(it) }
                ?.takeIf {
                    it.scheme == "https" && !it.host.isNullOrBlank() && it.rawUserInfo == null
                }
                ?.toString()
        } catch (_: Exception) {
            null
        }

    private fun kind(item: JSONObject): String {
        val field = item.optJSONObject("xfields")?.optString("lf_media_kind")
        val categories = item.optJSONArray("categoryIds")
        return if (
            field in listOf("tv", "series") ||
                (0 until (categories?.length() ?: 0)).any { categories?.opt(it) == 10 }
        )
            "series"
        else "movie"
    }

    private fun preview(row: JSONObject, origin: String, group: String? = null): JSONObject? {
        val popular = group == "popular"
        val id = text(row.opt(if (popular) "newsId" else "id")) ?: return null
        val slug = text(row.opt("slug")) ?: return null
        val title = text(row.opt("title")) ?: return null
        if (!idPattern.matches(id) || !slugPattern.matches(slug)) return null
        val year = number(row.opt("year"), 1888.0, 2200.0)?.takeIf { it % 1 == 0.0 }?.toInt()
        val fields = row.optJSONObject("xfields") ?: JSONObject()
        return JSONObject()
            .put("id", id)
            .put("slug", slug)
            .put("title", title.take(300))
            .put("year", year ?: JSONObject.NULL)
            .put(
                "poster",
                if (popular) "https://appassets.androidplatform.net/artwork/$id/$slug"
                else
                    (image(fields.opt("poster"), origin)
                        ?: image(row.opt("poster"), origin)
                        ?: JSONObject.NULL),
            )
            .put(
                "rating",
                number(if (popular) row.opt("kp") else fields.opt("rating"), 0.0, 10.0)
                    ?: JSONObject.NULL,
            )
            .put(
                "kind",
                if (group == "series") "series" else if (group != null) "movie" else kind(row),
            )
            .put("sourceUrl", "$origin/movie/$id/$slug")
    }

    fun pool(html: String, group: String, origin: String, releaseYear: Int? = null): JSONArray {
        var rows: JSONArray? = null
        for (doc in Flight.documents(html)) {
            val found =
                Flight.find(doc) { value ->
                    if (group == "popular")
                        value
                            .optJSONArray("rows")
                            ?.optJSONObject(0)
                            ?.optString("anchorId")
                            ?.startsWith("films-rank-") == true
                    else value.optJSONObject("initialList")?.optJSONArray("items") != null
                }
            if (found != null) {
                rows =
                    if (group == "popular") found.getJSONArray("rows")
                    else found.getJSONObject("initialList").getJSONArray("items")
                break
            }
        }
        val result = JSONArray()
        val seen = mutableSetOf<String>()
        for (index in 0 until (rows?.length() ?: 0)) {
            val row = rows?.optJSONObject(index) ?: continue
            if (group == "popular" && row.opt("inCatalog") != true) continue
            val item = preview(row, origin, group) ?: continue
            if (releaseYear != null && item.optInt("year", -1) != releaseYear) continue
            if (!seen.add(item.getString("id"))) continue
            result.put(item)
            if (result.length() == 20) return result
        }
        throw SourceFailure()
    }

    fun item(html: String, id: String): JSONObject =
        Flight.documents(html).firstNotNullOfOrNull { doc ->
            Flight.find(doc) { it.opt("id") == id && it.optJSONObject("xfields") != null }
        } ?: throw SourceFailure()

    private fun names(value: Any?, limit: Int): JSONArray {
        val values =
            when (value) {
                is JSONArray -> (0 until value.length()).map { value.opt(it) }
                is String -> value.split(',')
                else -> emptyList()
            }
        return JSONArray(values.mapNotNull { text(it)?.take(200) }.take(limit))
    }

    fun detail(html: String, id: String, origin: String): JSONObject {
        val row = item(html, id)
        val result = preview(row, origin) ?: throw SourceFailure()
        val fields = row.getJSONObject("xfields")
        return result
            .put(
                "backdrop",
                (image(fields.opt("posterbg"), origin) ?: image(row.opt("backdrop"), origin))
                    ?.replace(
                        Regex("(https://image\\.tmdb\\.org/t/p/)(?:original|w[0-9]+)/"),
                        "$1w780/",
                    ) ?: JSONObject.NULL,
            )
            .put("description", (text(row.opt("description")) ?: "").take(12000))
            .put(
                "originalTitle",
                (text(fields.opt("lf_original_title")) ?: text(fields.opt("name")))?.take(300)
                    ?: JSONObject.NULL,
            )
            .put("duration", text(fields.opt("duration"))?.take(100) ?: JSONObject.NULL)
            .put("genres", names(row.opt("genres"), 12))
            .put("countries", names(fields.opt("countries"), 10))
            .put("directors", names(fields.opt("directors"), 10))
            .put("actors", names(fields.opt("actors"), 20))
    }

    fun artwork(html: String, id: String, origin: String): String {
        val row = item(html, id)
        return image(row.optJSONObject("xfields")?.opt("poster"), origin)
            ?: image(row.opt("poster"), origin)
            ?: throw SourceFailure(404)
    }

    fun search(html: String, query: String, origin: String): JSONObject {
        val docs = Flight.documents(html)
        val found = docs.firstNotNullOfOrNull { doc ->
            Flight.find(doc) {
                it.opt("listVersionKey") is String && it.optJSONArray("items") != null
            }
        }
        if (found == null) {
            if (
                docs.any { doc ->
                    Flight.find(doc) { it.opt("children") == "Ничего не найдено" } != null
                }
            )
                return JSONObject()
                    .put("query", query)
                    .put("items", JSONArray())
                    .put("limited", false)
            throw SourceFailure()
        }
        val rows = found.getJSONArray("items")
        val items = JSONArray()
        val seen = mutableSetOf<String>()
        for (index in 0 until minOf(rows.length(), 40)) {
            val row = rows.optJSONObject(index) ?: throw SourceFailure()
            val item = preview(row, origin) ?: throw SourceFailure()
            if (seen.add(item.getString("id"))) items.put(item)
        }
        return JSONObject()
            .put("query", query)
            .put("items", items)
            .put("limited", rows.length() >= 40)
    }
}
