using Microsoft.EntityFrameworkCore;
using VioletCode.Modules.Catalogs.Domain;

namespace VioletCode.Modules.Catalogs.Infrastructure;

public sealed class CatalogsDbContext(DbContextOptions<CatalogsDbContext> options) : DbContext(options)
{
    public const string Schema = "catalogs";

    public DbSet<DirectoryEntry> DirectoryEntries => Set<DirectoryEntry>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema(Schema);

        b.Entity<DirectoryEntry>(e =>
        {
            e.ToTable("directory_entries");
            e.HasKey(x => x.Id);
            e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(32);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Description).HasMaxLength(1000);
            e.Property(x => x.Phone).HasMaxLength(32);
            e.Property(x => x.Address).HasMaxLength(300);
            e.Property(x => x.Schedule).HasMaxLength(200);
            e.HasIndex(x => new { x.Kind, x.IsActive });
        });
    }
}
