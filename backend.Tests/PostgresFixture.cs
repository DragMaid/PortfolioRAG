using Backend.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Testcontainers.PostgreSql;

namespace Backend.Tests;

/// <summary>
/// This thing create test containers for postgres which can be
/// created at destroyed at ease for isolated testing
/// </summary>
public static class PostgresFixture
{
    private const string TemplateDatabase = "portfolio_template";

    // NOTE: semaphore to limit concurrency, making sure only one process create db and other use it
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static readonly string Suffix = Guid.NewGuid().ToString("N")[..8];

    private static PostgreSqlContainer? _container;
    private static int _databaseCount;

    /// <summary>
    /// Creates a fresh, fully migrated database and returns the connection string to it.
    /// </summary>
    public static async Task<string> CreateDatabaseAsync(CancellationToken cancellationToken = default)
    {
        var container = await StartAsync(cancellationToken);
        var name = $"test_{Suffix}_{Interlocked.Increment(ref _databaseCount)}";

        await using (var connection = new NpgsqlConnection(container.GetConnectionString()))
        {
            await connection.OpenAsync(cancellationToken);
            await using var command = connection.CreateCommand();
            // NOTE: create a new database from the template created below instead
            // of re-creating and migrating the db container every time
            command.CommandText = $"CREATE DATABASE \"{name}\" TEMPLATE \"{TemplateDatabase}\"";
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        return ConnectionStringFor(container, name);
    }

    /// <summary>
    /// Try to retrieve the db container if already existed if not try to create instead
    /// </summary>
    private static async Task<PostgreSqlContainer> StartAsync(CancellationToken cancellationToken)
    {
        if (_container is not null)
            return _container;

        await Gate.WaitAsync(cancellationToken);

        try
        {
            if (_container is not null)
                return _container;

            var container = new PostgreSqlBuilder("postgres:16-alpine")
                .WithDatabase("portfolio")
                .WithUsername("portfolio")
                .WithPassword("portfolio")
                .WithTmpfsMount("/var/lib/postgresql/data")
                .Build();

            await container.StartAsync(cancellationToken);
            await BuildTemplateAsync(container, cancellationToken);

            _container = container;
            return container;
        }
        finally
        {
            Gate.Release();
        }
    }

    /// <summary>Applies the migrations once, to the database every test database is copied from.</summary>
    private static async Task BuildTemplateAsync(
        PostgreSqlContainer container,
        CancellationToken cancellationToken)
    {
        await using (var connection = new NpgsqlConnection(container.GetConnectionString()))
        {
            await connection.OpenAsync(cancellationToken);
            await using var command = connection.CreateCommand();
            command.CommandText = $"CREATE DATABASE \"{TemplateDatabase}\"";
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        var options = new DbContextOptionsBuilder<BlogDbContext>()
            .UseNpgsql(ConnectionStringFor(container, TemplateDatabase))
            .Options;

        await using (var context = new BlogDbContext(options))
        {
            await context.Database.MigrateAsync(cancellationToken);
        }

        // NOTE: Postgres refuses to copy a template that still has a session attached, and a
        // disposed context leaves its connection in the pool rather than closing it.
        NpgsqlConnection.ClearAllPools();
    }

    private static string ConnectionStringFor(PostgreSqlContainer container, string database) =>
        new NpgsqlConnectionStringBuilder(container.GetConnectionString())
        {
            Database = database,
            // NOTE: one database per harness means dozens of pools; a small cap each keeps
            // the run well under the server's connection limit.
            MaxPoolSize = 5
        }.ConnectionString;
}
