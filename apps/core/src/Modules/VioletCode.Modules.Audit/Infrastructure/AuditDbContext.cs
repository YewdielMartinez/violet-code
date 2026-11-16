using Microsoft.EntityFrameworkCore;
using VioletCode.Modules.Audit.Domain;

namespace VioletCode.Modules.Audit.Infrastructure;

public sealed class AuditDbContext(DbContextOptions<AuditDbContext> options) : DbContext(options)
{
    public const string Schema = "audit";

    public DbSet<AuditEvent> Events => Set<AuditEvent>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema(Schema);
        b.Entity<AuditEvent>(e =>
        {
            e.ToTable("events");
            e.HasKey(x => x.Id);
            e.Property(x => x.Action).HasMaxLength(64).IsRequired();
            e.Property(x => x.Resource).HasMaxLength(64).IsRequired();
            e.Property(x => x.ResourceId).HasMaxLength(64);
            e.Property(x => x.ActorId).HasMaxLength(64);
            e.Property(x => x.ActorName).HasMaxLength(200);
            e.Property(x => x.IpAddress).HasMaxLength(64);
            e.Property(x => x.Details).HasMaxLength(500);
            e.HasIndex(x => x.OccurredAt);
            e.HasIndex(x => new { x.Action, x.OccurredAt });
        });
    }
}
