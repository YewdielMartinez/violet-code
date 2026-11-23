namespace VioletCode.Modules.Scheduling.Domain;

/// <summary>
/// Cita de la agenda. Referencia el expediente solo por su folio (texto): este módulo no depende del módulo Cases.
/// </summary>
public sealed class Appointment
{
    public Guid Id { get; private set; } = Guid.CreateVersion7();
    public string CaseFolio { get; private set; } = default!;
    public DateTimeOffset StartsAt { get; private set; }
    public int DurationMinutes { get; private set; }
    public AppointmentKind Kind { get; private set; }
    public string ProfessionalName { get; private set; } = default!;
    public AppointmentStatus Status { get; private set; }

    private Appointment() { } // EF Core

    public static Appointment Create(
        string caseFolio, DateTimeOffset startsAt, int durationMinutes, AppointmentKind kind,
        string professionalName, AppointmentStatus status)
    {
        if (string.IsNullOrWhiteSpace(caseFolio)) throw new ArgumentException("El folio del expediente es obligatorio.", nameof(caseFolio));
        if (string.IsNullOrWhiteSpace(professionalName)) throw new ArgumentException("Falta la persona que atiende.", nameof(professionalName));
        if (durationMinutes is < 5 or > 480) throw new ArgumentOutOfRangeException(nameof(durationMinutes), "Duración fuera de rango.");

        return new Appointment
        {
            CaseFolio = caseFolio.Trim(),
            StartsAt = startsAt.ToUniversalTime(),
            DurationMinutes = durationMinutes,
            Kind = kind,
            ProfessionalName = professionalName.Trim(),
            Status = status,
        };
    }

    public bool IsAssignedTo(string? staffName) =>
        !string.IsNullOrWhiteSpace(staffName)
        && string.Equals(ProfessionalName, staffName.Trim(), StringComparison.Ordinal);
}

public enum AppointmentKind { Psicologica = 1, Juridica = 2, Seguimiento = 3, Visita = 4 }

public enum AppointmentStatus { Scheduled = 1, Done = 2, Cancelled = 3 }
