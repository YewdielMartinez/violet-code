using Microsoft.EntityFrameworkCore;
using VioletCode.Modules.Alerts.Domain;

namespace VioletCode.Modules.Alerts.Infrastructure;

public sealed class AlertsDbContext(DbContextOptions<AlertsDbContext> options) : DbContext(options)
{
    public const string Schema = "alerts";

    public DbSet<Alert> Alerts => Set<Alert>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema(Schema);

        b.Entity<Alert>(e =>
        {
            e.ToTable("alerts");
            e.HasKey(x => x.Id);
            e.Property(x => x.Folio).HasMaxLength(32).IsRequired();
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
            e.Property(x => x.Priority).HasConversion<string>().HasMaxLength(32);
            e.Property(x => x.Channel).HasConversion<string>().HasMaxLength(32);
            e.Property(x => x.Colonia).HasMaxLength(120).IsRequired();
            e.Property(x => x.AssignedToName).HasMaxLength(120);
            e.Ignore(x => x.IsActive);
            e.HasIndex(x => x.Folio).IsUnique();
            e.HasIndex(x => new { x.Status, x.CreatedAt });
        });
    }
}
