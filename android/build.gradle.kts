import org.gradle.api.attributes.Bundling

plugins {
    id("com.android.application") version "8.13.0" apply false
    id("org.jetbrains.kotlin.android") version "2.1.20" apply false
}

// Formatting is a development tool; it is not packaged in the APK.
val kotlinFormatter by configurations.creating {
    attributes.attribute(Bundling.BUNDLING_ATTRIBUTE, objects.named(Bundling.SHADOWED))
}

dependencies {
    add(kotlinFormatter.name, "com.facebook:ktfmt:0.64")
}

fun JavaExec.kotlinSources(checkOnly: Boolean) {
    classpath = kotlinFormatter
    mainClass.set("com.facebook.ktfmt.cli.Main")
    args("--kotlinlang-style")
    if (checkOnly) args("--dry-run", "--set-exit-if-changed")
    args(
        fileTree(rootDir) {
                include("**/*.kt", "**/*.kts")
                exclude("**/build/**", ".gradle/**", ".kotlin/**")
            }
            .files
            .sortedBy { it.path }
            .map { it.absolutePath }
    )
}

tasks.register<JavaExec>("formatKotlin") {
    group = "formatting"
    description = "Format Kotlin source and Gradle scripts."
    kotlinSources(false)
}

tasks.register<JavaExec>("checkKotlinFormat") {
    group = "verification"
    description = "Check Kotlin formatting without changing files."
    kotlinSources(true)
}
