package tv.lordfilm.app.catalog

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

/** Parse serialized JSON only; never execute page or provider scripts. */
object Flight {
    fun documents(html: String): List<Any> {
        val payload = StringBuilder()
        Regex("self\\.__next_f\\.push\\((\\[[\\s\\S]*?\\])\\)</script>").findAll(html).forEach {
            try {
                val chunk = JSONArray(it.groupValues[1])
                if (chunk.optInt(0) == 1 && chunk.opt(1) is String)
                    payload.append(chunk.getString(1))
            } catch (_: Exception) {
                /* Other Flight chunks are not data records. */
            }
        }
        val bytes = payload.toString().toByteArray(Charsets.UTF_8)
        val result = mutableListOf<Any>()
        var offset = 0
        while (offset < bytes.size) {
            val colon = bytes.indexOf(':'.code.toByte(), offset)
            if (colon < 0) break
            val start = colon + 1
            if (start < bytes.size && bytes[start] == 'T'.code.toByte()) {
                val comma = bytes.indexOf(','.code.toByte(), start)
                if (comma < 0) break
                val length =
                    bytes.copyOfRange(start + 1, comma).toString(Charsets.UTF_8).toIntOrNull(16)
                        ?: break
                if (length < 0 || length > bytes.size - comma - 1) break
                offset = comma + 1 + length
                continue
            }
            val end = bytes.indexOf('\n'.code.toByte(), start)
            if (end < 0) break
            try {
                val value =
                    JSONTokener(bytes.copyOfRange(start, end).toString(Charsets.UTF_8)).nextValue()
                if (value is JSONObject || value is JSONArray) result.add(value)
            } catch (_: Exception) {
                /* Module references are not JSON records. */
            }
            offset = end + 1
        }
        return result
    }

    private fun ByteArray.indexOf(value: Byte, from: Int): Int {
        for (index in from until size) if (this[index] == value) return index
        return -1
    }

    fun find(value: Any?, depth: Int = 0, predicate: (JSONObject) -> Boolean): JSONObject? {
        if (depth > 64) throw SourceFailure()
        if (value is JSONObject) {
            if (predicate(value)) return value
            for (key in value.keys()) find(value.opt(key), depth + 1, predicate)?.let {
                return it
            }
        } else if (value is JSONArray) {
            for (index in 0 until value.length()) find(value.opt(index), depth + 1, predicate)
                ?.let {
                    return it
                }
        }
        return null
    }
}
