package mx.violetcode.mobile.di

import mx.violetcode.mobile.core.domain.usecase.ObserveDirectoryUseCase
import mx.violetcode.mobile.core.domain.usecase.RefreshDirectoryUseCase
import mx.violetcode.mobile.feature.directorio.DirectorioViewModel
import org.koin.core.module.dsl.factoryOf
import org.koin.core.module.dsl.viewModelOf
import org.koin.dsl.module

/**
 * Casos de uso y ViewModels. Los casos de uso se registran aquí (y no en core:domain)
 * para que el dominio siga siendo Kotlin puro, sin depender de Koin.
 */
val appModule = module {
    factoryOf(::ObserveDirectoryUseCase)
    factoryOf(::RefreshDirectoryUseCase)

    viewModelOf(::DirectorioViewModel)
}
