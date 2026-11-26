// Capa de presentación + punto de entrada: pantallas, ViewModels, navegación y cableado de DI.
// No accede a Retrofit ni a Room directamente: solo a casos de uso del dominio.
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

val localProps = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use(::load)
}

fun configValue(name: String, fallback: String): String {
    val raw = (localProps.getProperty(name) ?: System.getenv(name) ?: fallback).trim()
    return raw.ifEmpty { fallback }.replace("\\", "\\\\").replace("\"", "\\\"")
}

android {
    namespace = "mx.violetcode.mobile"
    compileSdk = 35

    defaultConfig {
        applicationId = "mx.violetcode.mobile"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        debug {
            // Emulador Android → Supabase local en la PC (:54321). En Cloud, definir en local.properties.
            buildConfigField("String", "SUPABASE_URL", "\"${configValue("SUPABASE_URL", "http://10.0.2.2:54321/")}\"")
            buildConfigField("String", "SUPABASE_ANON_KEY", "\"${configValue("SUPABASE_ANON_KEY", "")}\"")
        }
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            buildConfigField("String", "SUPABASE_URL", "\"${configValue("SUPABASE_URL", "https://placeholder.supabase.co/")}\"")
            buildConfigField("String", "SUPABASE_ANON_KEY", "\"${configValue("SUPABASE_ANON_KEY", "")}\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(project(":core:domain"))
    implementation(project(":core:data"))        // solo para registrar su módulo de Koin
    implementation(project(":core:designsystem"))

    implementation(platform(libs.koin.bom))
    implementation(libs.koin.android)
    implementation(libs.koin.androidx.compose)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    debugImplementation(libs.androidx.ui.tooling)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}
