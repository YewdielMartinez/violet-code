using Microsoft.EntityFrameworkCore;
using VioletCode.Modules.Scheduling.Domain;

namespace VioletCode.Modules.Scheduling.Infrastructure;

public sealed class SchedulingDbContext(DbContextOptions<SchedulingDbContext> options) : DbContext(options)
{
    public const string Schema = "scheduling";

    public DbSet<Appointment> Appointments => Set<Appointment>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema(Schema);

        b.Entity<Appointment>(e =>
        {
            e.ToTable("appointments");
            e.HasKey(x => x.Id);
            e.Property(x => x.CaseFolio).HasMaxLength(32).IsRequired();
            e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(32);
            e.Property(x => x.ProfessionalName).HasMaxLength(120).IsRequired();
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
            e.HasIndex(x => x.StartsAt);
            e.HasIndex(x => new { x.ProfessionalName, x.StartsAt });
        });
    }
}
