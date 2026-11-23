namespace VioletCode.SharedKernel.Time;

/// <summary>
/// Hora local de Los Mochis (America/Mazatlan). Todo se guarda en UTC; esta clase convierte
/// para decidir qué es "hoy" o "esta semana" en los tableros.
/// </summary>
public static class LocalClock
{
    public static readonly TimeZoneInfo Zone = Resolve();

    private static TimeZoneInfo Resolve()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Mazatlan"); }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            // Sinaloa ya no usa horario de verano: UTC-7 fijo.
            return TimeZoneInfo.CreateCustomTimeZone("America/Mazatlan", TimeSpan.FromHours(-7), "Mazatlan", "Mazatlan");
        }
    }

    public static DateOnly ToLocalDate(DateTimeOffset instant) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(instant, Zone).DateTime);

    public static DateOnly Today(DateTimeOffset nowUtc) => ToLocalDate(nowUtc);

    /// <summary>Instante UTC en que empieza el día local indicado.</summary>
    public static DateTimeOffset StartOfDayUtc(DateOnly date) => AtLocal(date, TimeOnly.MinValue);

    /// <summary>Instante UTC de una fecha y hora locales.</summary>
    public static DateTimeOffset AtLocal(DateOnly date, TimeOnly time)
    {
        var local = date.ToDateTime(time, DateTimeKind.Unspecified);
        return new DateTimeOffset(local, Zone.GetUtcOffset(local)).ToUniversalTime();
    }
}
