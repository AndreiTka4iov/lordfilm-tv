package tv.lordfilm.app.catalog

class SourceFailure(val status: Int = 502, reason: String = "Source unavailable") :
    Exception(reason)
