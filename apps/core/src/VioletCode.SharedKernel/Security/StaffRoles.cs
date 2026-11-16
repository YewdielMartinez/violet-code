using System.Security.Claims;

namespace VioletCode.SharedKernel.Security;

/// <summary>
/// Roles del personal. PRELIMINARES: se ajustan con la matriz de permisos que confirme SEMUJERES (Q-20, Q-23, D-03).
/// </summary>
public static class StaffRoles
{
    public const string Admin = "admin";
    public const string Coordination = "coordinacion";
    public const string Professional = "profesional";
    public const string Reception = "recepcion";

    public static readonly string[] All = [Admin, Coordination, Professional, Reception];

    /// <summary>Pueden ver la auditoría y la actividad del equipo.</summary>
    public static readonly string[] Supervisors = [Admin, Coordination];
}

/// <summary>Nombres de claims del JWT (sin el mapeo heredado de Microsoft).</summary>
public static class StaffClaims
{
    public const string Subject = "sub";
    public const string Name = "name";
    public const string Email = "email";
    public const string Role = "role";

    public static string? Id(this ClaimsPrincipal user) => user.FindFirstValue(Subject);
    public static string? DisplayName(this ClaimsPrincipal user) => user.FindFirstValue(Name);
}

public static class RateLimitPolicies
{
    /// <summary>Login y refresh: limita fuerza bruta por IP.</summary>
    public const string Auth = "auth";
}
