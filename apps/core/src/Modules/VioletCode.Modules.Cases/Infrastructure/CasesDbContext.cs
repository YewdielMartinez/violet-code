using Microsoft.EntityFrameworkCore;
using VioletCode.Modules.Cases.Domain;

namespace VioletCode.Modules.Cases.Infrastructure;

public sealed class CasesDbContext(DbContextOptions<CasesDbContext> options) : DbContext(options)
{
    public const string Schema = "cases";

    public DbSet<CaseFile> CaseFiles => Set<CaseFile>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema(Schema);

        b.Entity<CaseFile>(e =>
        {
            e.ToTable("case_files");
            e.HasKey(x => x.Id);
            e.Property(x => x.Folio).HasMaxLength(32).IsRequired();
            e.Property(x => x.Alias).HasMaxLength(64).IsRequired();
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
            e.Property(x => x.Area).HasConversion<string>().HasMaxLength(32);
            e.Property(x => x.RiskLevel).HasConversion<string>().HasMaxLength(32);
            e.Property(x => x.AssignedToName).HasMaxLength(120).IsRequired();
            e.Ignore(x => x.IsOpen);
            e.HasIndex(x => x.Folio).IsUnique();
            e.HasIndex(x => new { x.Status, x.AssignedToName });
        });
    }
}
