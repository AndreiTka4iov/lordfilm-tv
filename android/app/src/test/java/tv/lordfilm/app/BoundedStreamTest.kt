package tv.lordfilm.app

import java.io.ByteArrayInputStream
import java.io.IOException
import org.junit.Assert.*
import org.junit.Test
import tv.lordfilm.app.catalog.BoundedStream

class BoundedStreamTest {
    @Test
    fun repeatedEofReadsDoNotReadTheClosedNetworkBody() {
        var releases = 0
        val body =
            object : ByteArrayInputStream(byteArrayOf(1, 2)) {
                private var ended = false

                override fun read(): Int {
                    check(!ended)
                    return super.read()
                }

                override fun close() {
                    ended = true
                }
            }
        val stream = BoundedStream(body, 10) { releases++ }
        assertEquals(1, stream.read())
        assertEquals(2, stream.read())
        repeat(3) { assertEquals(-1, stream.read()) }
        stream.close()
        assertEquals(1, releases)
    }

    @Test
    fun unknownLengthBodiesStillHaveAByteCapAndReleaseOnFailure() {
        var releases = 0
        val stream = BoundedStream(ByteArrayInputStream(ByteArray(20)), 10) { releases++ }
        try {
            stream.read(ByteArray(20))
            fail()
        } catch (_: IOException) {}
        assertEquals(1, releases)
    }
}
