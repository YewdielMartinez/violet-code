using Microsoft.AspNetCore.Identity;
using VioletCode.Modules.Identity.Domain;
using VioletCode.SharedKernel.Security;

namespace VioletCode.Modules.Identity.Infrastructure;

/// <summary>
/// Cuentas de DEMOSTRACIÓN (datos sintéticos). Solo se siembran si Database:SeedSyntheticData = true.
/// La contraseña viene de configuración (Identity:DemoPassword), nunca del código en producción.
/// </summary>
internal static class SyntheticStaff
{
    public static IEnumerable<StaffUser> Create(IPasswordHasher<StaffUser> hasher, string password)
    {
        (string Email, string Name, string Role, string? Area)[] people =
        [
            ("admin@violetcode.demo", "Ana Demo", StaffRoles.Admin, null),
            ("coordinacion@violetcode.demo", "Carla Demo", StaffRoles.Coordination, null),
            ("psicologia@violetcode.demo", "Paula Demo", StaffRoles.Professional, "psicologia"),
            ("juridico@violetcode.demo", "Julia Demo", StaffRoles.Professional, "juridico"),
            ("recepcion@violetcode.demo", "Rosa Demo", StaffRoles.Reception, null),
        ];

        foreach (var p in people)
        {
            var user = StaffUser.Create(p.Email, p.Name, p.Role, p.Area);
            user.SetPasswordHash(hasher.HashPassword(user, password));
            yield return user;
        }
    }
}
