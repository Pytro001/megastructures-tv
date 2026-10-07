plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val megatvUrl: String = (project.findProperty("megatvUrl") as String?) ?: ""
val megatvApi: String = (project.findProperty("megatvApi") as String?) ?: "http://10.0.2.2:8302"

android {
    namespace = "tv.megastructures.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "tv.megastructures.app"
        // Fire OS 6 is Android 7.1 (API 25); Fire OS 7 is API 28; Fire OS 8 is API 30
        minSdk = 25
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "START_URL", "\"$megatvUrl\"")
        buildConfigField("String", "API_BASE", "\"$megatvApi\"")
    }

    buildFeatures { buildConfig = true }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.leanback:leanback:1.0.0")
}
