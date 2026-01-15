using Azure.Data.Tables;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Portal.RefCache.Api.Repositories;
using Portal.RefCache.Api.Storage;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices(services =>
    {
        // SWA-managed Functions: do NOT depend on AzureWebJobsStorage for your app data connection.
        // Use an explicit app setting so we control it everywhere (local + Azure).
        var tablesConnection = Environment.GetEnvironmentVariable("TABLES_CONNECTION");
        if (string.IsNullOrWhiteSpace(tablesConnection))
            throw new InvalidOperationException("TABLES_CONNECTION is not set.");

        var estimatesTableName = Environment.GetEnvironmentVariable("TABLES_ESTIMATES_TABLE") ?? TableNames.Estimates;
        var projectsTableName  = Environment.GetEnvironmentVariable("TABLES_PROJECTS_TABLE")  ?? TableNames.Projects;

        // Factory so we can explicitly create table clients by name (no DI ambiguity)
        services.AddSingleton<Func<string, TableClient>>(_ =>
            (tableName) => new TableClient(tablesConnection, tableName));

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
