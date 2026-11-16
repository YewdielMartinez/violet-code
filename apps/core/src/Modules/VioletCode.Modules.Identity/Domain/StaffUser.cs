namespace VioletCode.Modules.Identity.Domain;

/// <summary>Persona del equipo de SEMUJERES con acceso al panel. Las usuarias NO son StaffUser.</summary>
public sealed class StaffUser
{
    public const int MaxFailedAttempts = 5;
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    public Guid Id { get; private set; } = Guid.CreateVersion7();
    public string Email { get; private set; } = default!;
    public string DisplayName { get; private set; } = default!;
    public string Role { get; private set; } = default!;
    public string? Area { get; private set; }
    public string PasswordHash { get; private set; } = default!;
    public bool IsActive { get; private set; } = true;
    public int FailedLoginCount { get; private set; }
    public DateTimeOffset? LockoutEndsAt { get; private set; }
    public DateTimeOffset? LastLoginAt { get; private set; }

    private StaffUser() { } // EF Core

    public static StaffUser Create(string email, string displayName, string role, string? area)
    {
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            throw new ArgumentException("Correo inválido.", nameof(email));
        if (string.IsNullOrWhiteSpace(displayName))
            throw new ArgumentException("El nombre es obligatorio.", nameof(displayName));

        return new StaffUser
        {
            Email = NormalizeEmail(email),
            DisplayName = displayName.Trim(),
            Role = role,
            Area = area,
        };
    }

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    public void SetPasswordHash(string hash) => PasswordHash = hash;

    public bool IsLockedOut(DateTimeOffset now) => LockoutEndsAt is { } end && end > now;

    public bool CanSignIn(DateTimeOffset now) => IsActive && !IsLockedOut(now);

    /// <summary>Registra un intento fallido. Devuelve true si con este intento la cuenta queda bloqueada.</summary>
    public bool RegisterFailedLogin(DateTimeOffset now)
    {
        FailedLoginCount++;
        if (FailedLoginCount < MaxFailedAttempts) return false;

        LockoutEndsAt = now + LockoutDuration;
        FailedLoginCount = 0;
        return true;
    }

    public void RegisterSuccessfulLogin(DateTimeOffset now)
    {
        FailedLoginCount = 0;
        LockoutEndsAt = null;
        LastLoginAt = now;
    }
}
