pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "VioletCodeMobile"

// Clean Architecture (ver README):
//   app → core:data, core:domain, core:designsystem
//   core:data → core:domain
//   core:domain → (nada: Kotlin puro)
include(":app")
include(":core:domain")
include(":core:data")
include(":core:designsystem")
