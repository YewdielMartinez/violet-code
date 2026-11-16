using Microsoft.EntityFrameworkCore;
using VioletCode.Modules.Identity.Domain;

namespace VioletCode.Modules.Identity.Infrastructure;

/// <summary>Nombre distinto de Microsoft.AspNetCore.Identity.EntityFrameworkCore.IdentityDbContext a propósito.</summary>
public sealed class StaffIdentityDbContext(DbContextOptions<StaffIdentityDbContext> options) : DbContext(options)
{
    public const string Schema = "identity";

    public DbSet<StaffUser> Users => Set<StaffUser>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema(Schema);

        b.Entity<StaffUser>(e =>
        {
            e.ToTable("staff_users");
            e.HasKey(x => x.Id);
            e.Property(x => x.Email).HasMaxLength(254).IsRequired();
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.DisplayName).HasMaxLength(200).IsRequired();
            e.Property(x => x.Role).HasMaxLength(32).IsRequired();
            e.Property(x => x.Area).HasMaxLength(64);
            e.Property(x => x.PasswordHash).HasMaxLength(512).IsRequired();
        });

        b.Entity<RefreshToken>(e =>
        {
            e.ToTable("refresh_tokens");
            e.HasKey(x => x.Id);
            e.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasIndex(x => x.UserId);
            e.HasOne<StaffUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
