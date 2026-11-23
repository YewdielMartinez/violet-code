using VioletCode.Modules.Alerts.Domain;
using VioletCode.Modules.Cases.Domain;
using VioletCode.Modules.Scheduling.Domain;
using VioletCode.SharedKernel.Time;

namespace VioletCode.UnitTests.Dashboard;

public class AlertSummaryCalculatorTests
{
    // 16-nov-2026 12:00 hora local (UTC-7) = 19:00 UTC.
    private static readonly DateTimeOffset Now = new(2026, 11, 16, 19, 0, 0, TimeSpan.Zero);

    private static Alert NewAlert(DateTimeOffset createdAt, AlertStatus status = AlertStatus.New, DateTimeOffset? closedAt = null) =>
        Alert.Create("AL-2026-0001", createdAt, status, AlertPriority.Medium, AlertChannel.App, "Centro", null, closedAt);

    [Fact]
    public void ByDay_rellena_con_ceros_los_siete_dias_incluido_hoy()
    {
        var s = AlertSummaryCalculator.Compute([NewAlert(Now.AddHours(-1)), NewAlert(Now.AddDays(-2))], Now);

        Assert.Equal(7, s.ByDay.Count);
        Assert.Equal(new DateOnly(2026, 11, 10), s.ByDay[0].Date);
        Assert.Equal(new DateOnly(2026, 11, 16), s.ByDay[^1].Date);
        Assert.Equal(1, s.ByDay[^1].Count);
        Assert.Equal(1, s.ByDay[4].Count); // anteayer
        Assert.Equal(5, s.ByDay.Count(d => d.Count == 0));
    }

    [Fact]
    public void Cuenta_activas_en_atencion_y_cerradas_de_la_semana()
    {
        var alerts = new[]
        {
            NewAlert(Now.AddHours(-2)),
            NewAlert(Now.AddHours(-30), AlertStatus.InProgress),
            NewAlert(Now.AddDays(-3), AlertStatus.Closed, Now.AddDays(-3).AddHours(1)),
            NewAlert(Now.AddDays(-12), AlertStatus.Closed, Now.AddDays(-12).AddHours(1)), // fuera de la semana
        };

        var s = AlertSummaryCalculator.Compute(alerts, Now);

        Assert.Equal(2, s.Active);
        Assert.Equal(1, s.NewToday);
        Assert.Equal(1, s.InProgress);
        Assert.Equal(1, s.ClosedThisWeek);
    }

    [Fact]
    public void El_dia_se_calcula_en_hora_local_no_en_utc()
    {
        // 02:00 UTC del 17 = 19:00 local del 16.
        var late = new DateTimeOffset(2026, 11, 17, 2, 0, 0, TimeSpan.Zero);
        var s = AlertSummaryCalculator.Compute([NewAlert(late.AddMinutes(-30))], late);

        Assert.Equal(new DateOnly(2026, 11, 16), s.ByDay[^1].Date);
        Assert.Equal(1, s.NewToday);
    }

    [Fact]
    public void Una_alerta_cerrada_exige_fecha_de_cierre()
    {
        Assert.Throws<ArgumentException>(() => NewAlert(Now, AlertStatus.Closed));
    }
}

public class CaseSummaryCalculatorTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 16, 19, 0, 0, TimeSpan.Zero);

    private static CaseFile Case(string assignedTo, CaseStatus status = CaseStatus.InAttention,
        RiskLevel risk = RiskLevel.Medium, bool needsReview = false) =>
        CaseFile.Create("EX-2026-0001", "Usuaria 0001", status, CaseArea.Psicologia, risk, assignedTo, Now.AddDays(-5), Now.AddDays(-1), needsReview);

    [Fact]
    public void Resume_abiertos_revision_riesgo_alto_y_propios()
    {
        var cases = new[]
        {
            Case("Paula Demo", risk: RiskLevel.High, needsReview: true),
            Case("Paula Demo"),
            Case("Julia Demo", risk: RiskLevel.High),
            Case("Paula Demo", CaseStatus.Closed, RiskLevel.High, needsReview: true), // cerrado: no cuenta
        };

        var s = CaseSummaryCalculator.Compute(cases, "Paula Demo");

        Assert.Equal(3, s.Open);
        Assert.Equal(1, s.NeedsReview);
        Assert.Equal(2, s.HighRisk);
        Assert.Equal(2, s.Mine);
    }

    [Theory]
    [InlineData("Paula Demo", true)]
    [InlineData("  Paula Demo ", true)]
    [InlineData("Julia Demo", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void Filtro_mis_expedientes(string? caller, bool expected)
    {
        Assert.Equal(expected, Case("Paula Demo").IsAssignedTo(caller));
    }

    [Fact]
    public void Sin_nombre_de_quien_consulta_mine_es_cero()
    {
        Assert.Equal(0, CaseSummaryCalculator.Compute([Case("Paula Demo")], null).Mine);
    }
}

public class AgendaCalculatorTests
{
    // 16-nov-2026 12:00 local = 19:00 UTC.
    private static readonly DateTimeOffset Now = new(2026, 11, 16, 19, 0, 0, TimeSpan.Zero);

    private static Appointment Appt(DateOnly day, int hour, AppointmentStatus status = AppointmentStatus.Scheduled, string folio = "EX-2026-0001") =>
        Appointment.Create(folio, LocalClock.AtLocal(day, new TimeOnly(hour, 0)), 45, AppointmentKind.Psicologica, "Paula Demo", status);

    [Fact]
    public void Rango_por_defecto_es_hoy_en_hora_local()
    {
        var r = AgendaCalculator.ResolveRange(null, null, Now);

        Assert.Equal(new DateTimeOffset(2026, 11, 16, 7, 0, 0, TimeSpan.Zero), r.FromUtc);
        Assert.Equal(TimeSpan.FromDays(1), r.ToUtc - r.FromUtc);
    }

    [Fact]
    public void Rango_to_es_inclusivo_y_se_corrige_si_es_anterior_a_from()
    {
        var multi = AgendaCalculator.ResolveRange(new DateOnly(2026, 11, 16), new DateOnly(2026, 11, 18), Now);
        Assert.Equal(TimeSpan.FromDays(3), multi.ToUtc - multi.FromUtc);

        var inverted = AgendaCalculator.ResolveRange(new DateOnly(2026, 11, 16), new DateOnly(2026, 11, 1), Now);
        Assert.Equal(TimeSpan.FromDays(1), inverted.ToUtc - inverted.FromUtc);
    }

    [Fact]
    public void Resumen_cuenta_hoy_siguiente_cita_y_fechas_del_mes_sin_canceladas()
    {
        var today = new DateOnly(2026, 11, 16);
        var appts = new[]
        {
            Appt(today, 9, AppointmentStatus.Done, "EX-2026-0001"),
            Appt(today, 13, folio: "EX-2026-0002"),            // siguiente: hoy 13:00
            Appt(today, 14, folio: "EX-2026-0003"),
            Appt(today, 15, AppointmentStatus.Cancelled),       // no cuenta
            Appt(new DateOnly(2026, 11, 20), 10),
            Appt(new DateOnly(2026, 12, 2), 10),                // otro mes: fuera de byDate
        };

        var s = AgendaCalculator.Summarize(appts, Now);

        Assert.Equal(3, s.Today);
        Assert.Equal("EX-2026-0002", s.NextCaseFolio);
        Assert.Equal(LocalClock.AtLocal(today, new TimeOnly(13, 0)), s.NextAt);
        Assert.Equal([new DateOnly(2026, 11, 16), new DateOnly(2026, 11, 20)], s.ByDate.Select(d => d.Date));
        Assert.Equal(3, s.ByDate[0].Count);
    }

    [Fact]
    public void Sin_citas_futuras_no_hay_siguiente()
    {
        var s = AgendaCalculator.Summarize([Appt(new DateOnly(2026, 11, 3), 9, AppointmentStatus.Done)], Now);

        Assert.Null(s.NextAt);
        Assert.Null(s.NextCaseFolio);
    }
}
