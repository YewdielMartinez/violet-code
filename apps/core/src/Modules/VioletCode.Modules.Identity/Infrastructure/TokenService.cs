using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using VioletCode.Modules.Identity.Domain;
using VioletCode.SharedKernel.Security;

namespace VioletCode.Modules.Identity.Infrastructure;

/// <summary>Emite el access token (JWT). Usa la misma sección "Jwt" con la que el API valida los tokens.</summary>
internal sealed class TokenService(IConfiguration configuration, TimeProvider clock)
{
    /// <summary>Vida corta: si se filtra, sirve poco tiempo. La sesión continúa con el refresh token.</summary>
    public static readonly TimeSpan AccessTokenLifetime = TimeSpan.FromMinutes(15);

    public (string Token, DateTimeOffset ExpiresAt) CreateAccessToken(StaffUser user)
    {
        var jwt = configuration.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["SigningKey"]!));
        var now = clock.GetUtcNow();
        var expires = now + AccessTokenLifetime;

        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"],
            audience: jwt["Audience"],
            claims:
            [
                new Claim(StaffClaims.Subject, user.Id.ToString()),
                new Claim(StaffClaims.Email, user.Email),
                new Claim(StaffClaims.Name, user.DisplayName),
                new Claim(StaffClaims.Role, user.Role),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            ],
            notBefore: now.UtcDateTime,
            expires: expires.UtcDateTime,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
