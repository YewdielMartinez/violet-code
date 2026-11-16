namespace VioletCode.Modules.Catalogs.Domain;

/// <summary>
/// Lugar o instancia a la que una usuaria puede acudir: instancias de atención y Puntos Violeta.
/// Los refugios NO se modelan aquí: su ubicación no debe ser pública.
/// </summary>
public sealed class DirectoryEntry
{
    public Guid Id { get; private set; } = Guid.CreateVersion7();
    public EntryKind Kind { get; private set; }
    public string Name { get; private set; } = default!;
    public string? Description { get; private set; }
    public string? Phone { get; private set; }
    public string? Address { get; private set; }
    public string? Schedule { get; private set; }
    public double? Latitude { get; private set; }
    public double? Longitude { get; private set; }
    public bool IsEmergency { get; private set; }
    public bool IsActive { get; private set; } = true;
    public DateTimeOffset UpdatedAt { get; private set; } = DateTimeOffset.UtcNow;

    private DirectoryEntry() { } // EF Core

    public static DirectoryEntry Create(
        EntryKind kind, string name, string? description, string? phone, string? address,
        string? schedule, double? latitude, double? longitude, bool isEmergency)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("El nombre es obligatorio.", nameof(name));
        if (latitude is < -90 or > 90) throw new ArgumentOutOfRangeException(nameof(latitude), "Latitud fuera de rango.");
        if (longitude is < -180 or > 180) throw new ArgumentOutOfRangeException(nameof(longitude), "Longitud fuera de rango.");

        return new DirectoryEntry
        {
            Kind = kind,
            Name = name.Trim(),
            Description = description,
            Phone = phone,
            Address = address,
            Schedule = schedule,
            Latitude = latitude,
            Longitude = longitude,
            IsEmergency = isEmergency,
        };
    }
}

public enum EntryKind
{
    /// <summary>Instancia de atención (SEMUJERES, Fiscalía, salud, 911…).</summary>
    Institution = 1,

    /// <summary>Punto Violeta: espacio seguro para pedir ayuda.</summary>
    VioletPoint = 2,
}
