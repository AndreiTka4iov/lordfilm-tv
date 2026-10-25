import java.util.zip.ZipFile

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val webExport = rootProject.layout.projectDirectory.dir("../.next-export")
val webAssets = layout.buildDirectory.dir("generated/webAssets")
val syncWebAssets by
    tasks.registering(Sync::class) {
        from(webExport) { exclude("**/.*") }
        into(webAssets)
        doFirst {
            check(webExport.file("index.html").asFile.isFile) {
                "Missing web export. Run npm run android:prepare from the repository root."
            }
        }
    }

android {
    namespace = "tv.lordfilm.app"
    compileSdk = 36
    defaultConfig {
        applicationId = "tv.lordfilm.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 2
        versionName = "0.2.0"
        val sourceOrigin =
            providers.gradleProperty("lordfilmOrigin").getOrElse("https://lordfilmx13.ink")
        require(Regex("https://[a-zA-Z0-9.-]+(?::[0-9]+)?").matches(sourceOrigin))
        buildConfigField("String", "SOURCE_ORIGIN", "\"$sourceOrigin\"")
    }
    // AAPT's default asset filter excludes _* directories, including Next.js _next.
    androidResources { ignoreAssetsPattern = "!.svn:!.git:!.DS_Store:.*:!CVS:!thumbs.db:!*~" }
    buildFeatures { buildConfig = true }
    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
    sourceSets["main"].assets.srcDir(webAssets)
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

tasks.named("preBuild") { dependsOn(syncWebAssets) }

dependencies {
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.webkit:webkit:1.17.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:okhttp-dnsoverhttps:4.12.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}

// Validate the APK itself: successful Kotlin compilation does not guarantee web assets were
// packaged.
tasks.register("verifyDebugWebAssets") {
    dependsOn("assembleDebug")
    doLast {
        ZipFile(layout.buildDirectory.file("outputs/apk/debug/app-debug.apk").get().asFile).use {
            apk ->
            fileTree(webAssets)
                .files
                .filter { it.isFile }
                .forEach { file ->
                    val relative = file.relativeTo(webAssets.get().asFile).invariantSeparatorsPath
                    check(apk.getEntry("assets/$relative") != null) {
                        "Missing packaged web asset: $relative"
                    }
                }
        }
    }
}
