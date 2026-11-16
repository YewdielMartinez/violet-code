using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace VioletCode.SharedKernel;

public static class Persistence
{
    public const string ConnectionStringName = "VioletCode";

    /// <summary>
    /// Registra el DbContext de un módulo con su propio schema y su propia tabla de migraciones.
    /// </summary>
    public static IServiceCollection AddModuleDbContext<TContext>(
        this IServiceCollection services, IConfiguration configuration, string schema)
        where TContext : DbContext
    {
        var cs = configuration.GetConnectionString(ConnectionStringName)
                 ?? throw new InvalidOperationException($"Falta ConnectionStrings:{ConnectionStringName}");

        services.AddDbContext<TContext>(o => o.UseNpgsql(cs, npgsql =>
            npgsql.MigrationsHistoryTable("__ef_migrations", schema)));
        return services;
    }
}
