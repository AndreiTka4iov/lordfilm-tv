package tv.lordfilm.app.catalog

import java.io.InterruptedIOException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import okhttp3.Call

class RequestToken {
    val cancelled = AtomicBoolean(false)
    private val current = AtomicReference<Call?>()

    fun attach(call: Call) {
        current.set(call)
        if (cancelled.get()) {
            call.cancel()
            throw InterruptedIOException("Cancelled")
        }
    }

    fun detach(call: Call) {
        current.compareAndSet(call, null)
    }

    fun cancel() {
        cancelled.set(true)
        current.getAndSet(null)?.cancel()
    }
}
