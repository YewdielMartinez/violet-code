package mx.violetcode.mobile.di

import mx.violetcode.mobile.core.domain.usecase.ObserveDirectoryUseCase
import mx.violetcode.mobile.core.domain.usecase.ObserveMyProfileUseCase
import mx.violetcode.mobile.core.domain.usecase.ObserveSessionUseCase
import mx.violetcode.mobile.core.domain.usecase.ObserveSupportHotlineUseCase
import mx.violetcode.mobile.core.domain.usecase.RefreshDirectoryUseCase
import mx.violetcode.mobile.core.domain.usecase.SendHelpAlertUseCase
import mx.violetcode.mobile.core.domain.usecase.SignInUseCase
import mx.violetcode.mobile.core.domain.usecase.SignOutUseCase
import mx.violetcode.mobile.core.domain.usecase.SignUpUseCase
import mx.violetcode.mobile.feature.auxilio.AyudaViewModel
import mx.violetcode.mobile.feature.cuenta.LoginViewModel
import mx.violetcode.mobile.feature.cuenta.RegistroViewModel
import mx.violetcode.mobile.disguise.DisguiseController
import mx.violetcode.mobile.disguise.DisguiseStore
import mx.violetcode.mobile.core.domain.disguise.PinGate
import mx.violetcode.mobile.feature.directorio.DirectorioViewModel
import mx.violetcode.mobile.feature.inicio.InicioViewModel
import mx.violetcode.mobile.feature.perfil.PerfilViewModel
import mx.violetcode.mobile.feature.orientacion.OrientacionViewModel
import mx.violetcode.mobile.preferences.ThemePreferences
import org.koin.android.ext.koin.androidContext
import org.koin.core.module.dsl.factoryOf
import org.koin.core.module.dsl.viewModelOf
import org.koin.dsl.module

/**
 * Casos de uso y ViewModels. Los casos de uso se registran aquí (y no en core:domain)
 * para que el dominio siga siendo Kotlin puro, sin depender de Koin.
 */
val appModule = module {
    single { ThemePreferences(androidContext()) }

    factoryOf(::ObserveDirectoryUseCase)
    factoryOf(::RefreshDirectoryUseCase)

    viewModelOf(::DirectorioViewModel)

    // Cuenta y botón de ayuda (Supabase Auth + RPC).
    factoryOf(::SignUpUseCase)
    factoryOf(::SignInUseCase)
    factoryOf(::SignOutUseCase)
    factoryOf(::ObserveSessionUseCase)
    factoryOf(::ObserveMyProfileUseCase)
    factoryOf(::SendHelpAlertUseCase)

    viewModelOf(::RegistroViewModel)
    viewModelOf(::LoginViewModel)
    viewModelOf(::AyudaViewModel)
    viewModelOf(::PerfilViewModel)
    viewModelOf(::InicioViewModel)

    // Violentómetro (solo en memoria) y línea de apoyo del directorio.
    factoryOf(::ObserveSupportHotlineUseCase)
    viewModelOf(::OrientacionViewModel)

    // Modo discreto: PIN con hash + sal cifrado con Keystore; el controlador es único para toda la app.
    single { DisguiseStore(androidContext()) }
    single { PinGate(store = get<DisguiseStore>()) }
    single { DisguiseController(androidContext(), get(), get()) }
}
