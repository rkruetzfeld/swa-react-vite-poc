using Azure.Data.Tables;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Portal.RefCache.Api.Repositories;
using Portal.RefCache.Api.Storage;

static string RequireEnv(string name)
{
    var v = Environment.GetEnvironmentVariable(name);
    if (string.IsNullOrWhiteSpace(v))
        throw new InvalidOperationException($"Required environment variable '{name}' is not set.");
    return v.Trim();
}

// Prefer explicit app settings for data tables.
// DO NOT use AzureWebJobsStorage for your app data in SWA managed Functions.
static string GetTablesConnectionString()
{
    // 1) Primary: TABLES_CONNECTION (what you already added in SWA)
    var cs = Environment.GetEnvironmentVariable("TABLES_CONNECTION");
    if (!string.IsNullOrWhiteSpace(cs))
        return cs.Trim();

    // 2) Local fallback: Use Azurite when running locally
    // (This makes local dev easy without duplicating env vars.)
    var local = Environment.GetEnvironmentVariable("AzureWebJobsStorage");
    if (!string.IsNullOrWhiteSpace(local))
        return local.Trim();

    throw new InvalidOperationException(
        "No Table Storage connection string found. Set TABLES_CONNECTION (preferred) or AzureWebJobsStorage (local fallback).");
}

// Optional overrides (lets you change names in SWA without code changes)
static string GetTableName(string envVar, string defaultName)
{
    var v = Environment.GetEnvironmentVariable(envVar);
    return string.IsNullOrWhiteSpace(v) ? defaultName : v.Trim();
}

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices(services =>
    {
        var tablesConnectionString = GetTablesConnectionString();

        // Table names: default to your constants but allow overrides from env vars
        var estimatesTableName = GetTableName("TABLES_ESTIMATES_TABLE", TableNames.Estimates);
        var projectsTableName  = GetTableName("TABLES_PROJECTS_TABLE",  TableNames.Projects);

        // Factory so we can explicitly create table clients by name (no DI ambiguity)
        services.AddSingleton<Func<string, TableClient>>(_ =>
            (tableName) => new TableClient(tablesConnectionString, tableName));

        // Create both tables once at startup (non-fatal)
        services.AddHostedService(sp =>
        {
            var log = sp.GetRequiredService<ILogger<TableInitializer>>();
            var factory = sp.GetRequiredService<Func<string, TableClient>>();

            return new MultiTableInitializer(
                new[] { factory(estimatesTableName), factory(projectsTableName) },
                log);
        });

        // Repositories (explicitly pass the right table client)
        services.AddSingleton<IEstimatesRepository>(sp =>
        {
            var factory = sp.GetRequiredService<Func<string, TableClient>>();

            return new TableEstimatesRepository(
                factory(estimatesTableName),
                factory(projectsTableName));
        });

        services.AddSingleton<IProjectsRepository>(sp =>
        {
            var factory = sp.GetRequiredService<Func<string, TableClient>>();
            return new TableProjectsRepository(factory(projectsTableName));
        });
    })
    .Build();

host.Run();
