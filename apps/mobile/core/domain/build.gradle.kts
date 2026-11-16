import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Kotlin PURO: sin Android, sin Room, sin Retrofit, sin Koin.
// Si necesitas importar algo de android.* aquí, va en core:data o en app.
plugins {
    alias(libs.plugins.kotlin.jvm)
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

dependencies {
    api(libs.kotlinx.coroutines.core) // Flow forma parte de la API pública del dominio

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}
