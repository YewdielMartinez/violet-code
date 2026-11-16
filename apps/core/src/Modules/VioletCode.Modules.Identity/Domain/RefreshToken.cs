using System.Security.Cryptography;
using System.Text;

namespace VioletCode.Modules.Identity.Domain;

/// <summary>
/// Token de renovación de sesión. En la base solo se guarda su hash (SHA-256):
/// si la base se filtra, los tokens no sirven. Se rota en cada uso.
/// </summary>
public sealed class RefreshToken
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(8); // una jornada laboral

    public Guid Id { get; private set; } = Guid.CreateVersion7();
    public Guid UserId { get; private set; }
    public string TokenHash { get; private set; } = default!;
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? RevokedAt { get; private set; }

    private RefreshToken() { } // EF Core

    /// <summary>Crea un token. Devuelve la entidad (con hash) y el valor en claro, que solo viaja en la cookie.</summary>
    public static (RefreshToken Token, string PlainValue) Issue(Guid userId, DateTimeOffset now)
    {
        var plain = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        return (new RefreshToken
        {
            UserId = userId,
            TokenHash = Hash(plain),
            CreatedAt = now,
            ExpiresAt = now + Lifetime,
        }, plain);
    }

    public static string Hash(string plain) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plain)));

    public bool IsActive(DateTimeOffset now) => RevokedAt is null && ExpiresAt > now;

    public void Revoke(DateTimeOffset now) => RevokedAt ??= now;
}
