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

fun configValue(name: String, fallback: String, vararg aliases: String): String {
    val raw = (listOf(name, *aliases).firstNotNullOfOrNull { key ->
        (localProps.getProperty(key) ?: System.getenv(key))?.trim()?.ifEmpty { null }
    } ?: fallback).trim()
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
            // Emulador Android → Supabase local en la PC (10.0.2.2:55321, ver supabase/config.toml). En Cloud, definir
            // `supabase.url` y `supabase.publishableKey` en apps/mobile/local.properties (ignorado por git). Nunca service_role.
            buildConfigField("String", "SUPABASE_URL", "\"${configValue("supabase.url", "http://10.0.2.2:55321", "SUPABASE_URL")}\"")
            buildConfigField("String", "SUPABASE_ANON_KEY", "\"${configValue("supabase.publishableKey", "", "SUPABASE_ANON_KEY")}\"")
        }
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            buildConfigField("String", "SUPABASE_URL", "\"${configValue("supabase.url", "https://placeholder.supabase.co", "SUPABASE_URL")}\"")
            buildConfigField("String", "SUPABASE_ANON_KEY", "\"${configValue("supabase.publishableKey", "", "SUPABASE_ANON_KEY")}\"")
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

    // Fija androidx.browser (transitiva de supabase auth-kt) a una versión compatible con compileSdk 35.
    constraints {
        implementation(libs.androidx.browser) { version { strictly(libs.versions.browser.get()) } }
    }

    implementation(platform(libs.koin.bom))
    implementation(libs.koin.android)
    implementation(libs.koin.androidx.compose)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.core.splashscreen)
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
