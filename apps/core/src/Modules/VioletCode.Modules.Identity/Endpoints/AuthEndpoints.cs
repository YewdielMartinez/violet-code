using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using VioletCode.Modules.Identity.Domain;
using VioletCode.Modules.Identity.Infrastructure;
using VioletCode.SharedKernel.Auditing;
using VioletCode.SharedKernel.Security;

namespace VioletCode.Modules.Identity.Endpoints;

public sealed record LoginRequest(string Email, string Password);

public sealed record StaffUserDto(Guid Id, string Email, string DisplayName, string Role, string? Area);

public sealed record SessionResponse(string AccessToken, DateTimeOffset ExpiresAt, StaffUserDto User);

internal static class AuthEndpoints
{
    private const string RefreshCookie = "vc_refresh";
    private const string RefreshCookiePath = "/api/identity";

    // Mismo mensaje para "no existe", "contraseña incorrecta" y "bloqueada": no revela qué cuentas existen.
    private const string InvalidCredentials = "Correo o contraseña incorrectos.";

    public static void Map(IEndpointRouteBuilder api)
    {
        var g = api.MapGroup("").WithTags("Identidad");

        g.MapPost("/login", Login)
            .WithName("Login")
            .WithSummary("Inicia sesión del personal. Devuelve access token y deja el refresh token en una cookie httpOnly.")
            .RequireRateLimiting(RateLimitPolicies.Auth)
            .AllowAnonymous();

        g.MapPost("/refresh", Refresh)
            .WithName("RefreshSession")
            .WithSummary("Renueva la sesión con la cookie de refresh (rotación en cada uso).")
            .RequireRateLimiting(RateLimitPolicies.Auth)
            .AllowAnonymous();

        g.MapPost("/logout", Logout)
            .WithName("Logout")
            .AllowAnonymous();

        g.MapGet("/me", Me)
            .WithName("CurrentUser")
            .RequireAuthorization();
    }

    private static async Task<Results<Ok<SessionResponse>, ProblemHttpResult>> Login(
        LoginRequest request, HttpContext http, StaffIdentityDbContext db, IPasswordHasher<StaffUser> hasher,
        TokenService tokens, IAuditLog audit, TimeProvider clock, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var ip = http.Connection.RemoteIpAddress?.ToString();
        var email = StaffUser.NormalizeEmail(request.Email ?? string.Empty);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

        if (user is null)
        {
            // Mismo costo de tiempo que un usuario real: evita descubrir correos midiendo la respuesta.
            hasher.VerifyHashedPassword(DummyUser, DummyHash, request.Password ?? string.Empty);
            await audit.RecordAsync(new AuditEntry(AuditActions.LoginFailure, "session", IpAddress: ip, Details: "cuenta inexistente"), ct);
            return Unauthorized();
        }

        if (!user.CanSignIn(now))
        {
            await audit.RecordAsync(new AuditEntry(AuditActions.LoginFailure, "session", user.Id.ToString(), user.Id.ToString(), user.DisplayName, ip, "cuenta bloqueada o inactiva"), ct);
            return Unauthorized();
        }

        var verification = hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password ?? string.Empty);
        if (verification == PasswordVerificationResult.Failed)
        {
            var lockedNow = user.RegisterFailedLogin(now);
            await db.SaveChangesAsync(ct);
            await audit.RecordAsync(new AuditEntry(
                lockedNow ? AuditActions.LoginLocked : AuditActions.LoginFailure, "session",
                user.Id.ToString(), user.Id.ToString(), user.DisplayName, ip,
                lockedNow ? $"bloqueada {StaffUser.LockoutDuration.TotalMinutes} min" : "contraseña incorrecta"), ct);
            return Unauthorized();
        }

        if (verification == PasswordVerificationResult.SuccessRehashNeeded)
            user.SetPasswordHash(hasher.HashPassword(user, request.Password!));

        user.RegisterSuccessfulLogin(now);
        var session = await StartSession(user, http, db, tokens, now, ct);
        await audit.RecordAsync(new AuditEntry(AuditActions.LoginSuccess, "session", user.Id.ToString(), user.Id.ToString(), user.DisplayName, ip), ct);
        return TypedResults.Ok(session);
    }

    private static async Task<Results<Ok<SessionResponse>, ProblemHttpResult>> Refresh(
        HttpContext http, StaffIdentityDbContext db, TokenService tokens, TimeProvider clock, CancellationToken ct)
    {
        if (!http.Request.Cookies.TryGetValue(RefreshCookie, out var plain) || string.IsNullOrEmpty(plain))
            return SessionExpired();

        var now = clock.GetUtcNow();
        var hash = RefreshToken.Hash(plain);
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

        if (stored is null) return SessionExpired(http);

        if (!stored.IsActive(now))
        {
            // Un token ya usado vuelve a aparecer: posible robo. Se cierran todas las sesiones de esa persona.
            if (stored.RevokedAt is not null)
            {
                await db.RefreshTokens.Where(t => t.UserId == stored.UserId && t.RevokedAt == null)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
            }
            return SessionExpired(http);
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == stored.UserId, ct);
        if (user is null || !user.CanSignIn(now)) return SessionExpired(http);

        stored.Revoke(now); // rotación: cada refresh token sirve una sola vez
        return TypedResults.Ok(await StartSession(user, http, db, tokens, now, ct));
    }

    private static async Task<NoContent> Logout(
        HttpContext http, StaffIdentityDbContext db, IAuditLog audit, TimeProvider clock, CancellationToken ct)
    {
        if (http.Request.Cookies.TryGetValue(RefreshCookie, out var plain) && !string.IsNullOrEmpty(plain))
        {
            var hash = RefreshToken.Hash(plain);
            var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
            if (stored is not null)
            {
                stored.Revoke(clock.GetUtcNow());
                await db.SaveChangesAsync(ct);
                var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == stored.UserId, ct);
                await audit.RecordAsync(new AuditEntry(AuditActions.Logout, "session", stored.UserId.ToString(),
                    stored.UserId.ToString(), user?.DisplayName, http.Connection.RemoteIpAddress?.ToString()), ct);
            }
        }

        http.Response.Cookies.Delete(RefreshCookie, CookieOptions(DateTimeOffset.UnixEpoch));
        return TypedResults.NoContent();
    }

    private static async Task<Results<Ok<StaffUserDto>, UnauthorizedHttpResult>> Me(
        ClaimsPrincipal principal, StaffIdentityDbContext db, CancellationToken ct)
    {
        if (!Guid.TryParse(principal.Id(), out var id)) return TypedResults.Unauthorized();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id && u.IsActive, ct);
        return user is null ? TypedResults.Unauthorized() : TypedResults.Ok(ToDto(user));
    }

    private static async Task<SessionResponse> StartSession(
        StaffUser user, HttpContext http, StaffIdentityDbContext db, TokenService tokens, DateTimeOffset now, CancellationToken ct)
    {
        var (refresh, plain) = RefreshToken.Issue(user.Id, now);
        db.RefreshTokens.Add(refresh);
        await db.SaveChangesAsync(ct);

        http.Response.Cookies.Append(RefreshCookie, plain, CookieOptions(refresh.ExpiresAt));
        var (access, expiresAt) = tokens.CreateAccessToken(user);
        return new SessionResponse(access, expiresAt, ToDto(user));
    }

    /// <summary>
    /// httpOnly: JavaScript no puede leerla (protege ante XSS). SameSite=Strict: no viaja desde otros sitios (CSRF).
    /// Path limitado: solo se envía a /api/identity.
    /// </summary>
    private static CookieOptions CookieOptions(DateTimeOffset expires) => new()
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Strict,
        Path = RefreshCookiePath,
        Expires = expires,
        IsEssential = true,
    };

    private static StaffUserDto ToDto(StaffUser u) => new(u.Id, u.Email, u.DisplayName, u.Role, u.Area);

    private static ProblemHttpResult Unauthorized() =>
        TypedResults.Problem(title: InvalidCredentials, statusCode: StatusCodes.Status401Unauthorized);

    private static ProblemHttpResult SessionExpired(HttpContext? http = null)
    {
        http?.Response.Cookies.Delete(RefreshCookie, CookieOptions(DateTimeOffset.UnixEpoch));
        return TypedResults.Problem(title: "La sesión expiró. Inicia sesión de nuevo.", statusCode: StatusCodes.Status401Unauthorized);
    }

    private static readonly StaffUser DummyUser = StaffUser.Create("nadie@violetcode.invalid", "-", StaffRoles.Reception, null);
    private static readonly string DummyHash = new PasswordHasher<StaffUser>().HashPassword(DummyUser, Guid.NewGuid().ToString());
}
