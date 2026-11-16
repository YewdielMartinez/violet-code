using VioletCode.Modules.Identity.Domain;
using VioletCode.SharedKernel.Security;

namespace VioletCode.UnitTests.Identity;

public class StaffUserLockoutTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 23, 9, 0, 0, TimeSpan.Zero);

    private static StaffUser NewUser() => StaffUser.Create("  Persona@Demo.MX ", "Persona Demo", StaffRoles.Professional, "psicologia");

    [Fact]
    public void El_correo_se_normaliza()
    {
        Assert.Equal("persona@demo.mx", NewUser().Email);
    }

    [Fact]
    public void Se_bloquea_al_quinto_intento_fallido()
    {
        var user = NewUser();
        for (var i = 1; i < StaffUser.MaxFailedAttempts; i++)
            Assert.False(user.RegisterFailedLogin(Now));

        Assert.True(user.RegisterFailedLogin(Now));
        Assert.False(user.CanSignIn(Now));
    }

    [Fact]
    public void El_bloqueo_expira()
    {
        var user = NewUser();
        for (var i = 0; i < StaffUser.MaxFailedAttempts; i++) user.RegisterFailedLogin(Now);

        Assert.True(user.CanSignIn(Now + StaffUser.LockoutDuration + TimeSpan.FromSeconds(1)));
    }

    [Fact]
    public void Un_login_correcto_reinicia_el_contador()
    {
        var user = NewUser();
        for (var i = 1; i < StaffUser.MaxFailedAttempts; i++) user.RegisterFailedLogin(Now);
        user.RegisterSuccessfulLogin(Now);

        Assert.False(user.RegisterFailedLogin(Now));
    }
}

public class RefreshTokenTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 23, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Solo_se_guarda_el_hash_del_token()
    {
        var (token, plain) = RefreshToken.Issue(Guid.NewGuid(), Now);

        Assert.NotEqual(plain, token.TokenHash);
        Assert.Equal(RefreshToken.Hash(plain), token.TokenHash);
    }

    [Fact]
    public void Un_token_revocado_o_vencido_no_esta_activo()
    {
        var (token, _) = RefreshToken.Issue(Guid.NewGuid(), Now);
        Assert.True(token.IsActive(Now));
        Assert.False(token.IsActive(Now + RefreshToken.Lifetime));

        token.Revoke(Now);
        Assert.False(token.IsActive(Now));
    }
}
