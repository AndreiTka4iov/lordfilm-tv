package tv.lordfilm.app.catalog

import java.io.FilterInputStream
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.atomic.AtomicBoolean

/** Release at EOF/cancel, while repeated EOF reads remain safe for WebView's decoder. */
class BoundedStream(input: InputStream, private val limit: Int, private val release: () -> Unit) :
    FilterInputStream(input) {
    private val closed = AtomicBoolean(false)
    private var count = 0

    private fun track(amount: Int): Int {
        if (amount > 0) count += amount
        if (count > limit) {
            close()
            throw IOException("Artwork too large")
        }
        if (amount < 0) close()
        return amount
    }

    override fun read(): Int {
        if (closed.get()) return -1
        val byte = `in`.read()
        track(if (byte < 0) -1 else 1)
        return byte
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (length == 0) return 0
        if (closed.get()) return -1
        return track(`in`.read(buffer, offset, length))
    }

    override fun close() {
        if (closed.compareAndSet(false, true))
            try {
                super.close()
            } finally {
                release()
            }
    }
}
