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
        // Prefer SWA env var name you already set (TABLES_CONNECTION),
        // fall back to local AzureWebJobsStorage for local emulator use.
        var connectionString =
            Environment.GetEnvironmentVariable("TABLES_CONNECTION")
            ?? Environment.GetEnvironmentVariable("AzureWebJobsStorage");

        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("Neither TABLES_CONNECTION nor AzureWebJobsStorage is set.");

        // Table client factory (no ambiguity)
        services.AddSingleton<Func<string, TableClient>>(_ =>
            (tableName) => new TableClient(connectionString, tableName));

        // Register the initializer as a concrete type, not IHostedService
        services.AddSingleton<MultiTableInitializer>(sp =>
        {
            var log = sp.GetRequiredService<ILogger<MultiTableInitializer>>();
            var factory = sp.GetRequiredService<Func<string, TableClient>>();

            return new MultiTableInitializer(
                new[]
                {
                    factory(TableNames.Estimates),
                    factory(TableNames.Projects)
                },
                log);
        });

        // Add it as hosted service (framework will resolve the concrete type)
        services.AddHostedService(sp => sp.GetRequiredService<MultiTableInitializer>());

        // Repos
        services.AddSingleton<IEstimatesRepository>(sp =>
        {
            var factory = sp.GetRequiredService<Func<string, TableClient>>();
            return new TableEstimatesRepository(
                factory(TableNames.Estimates),
                factory(TableNames.Projects));
        });

        services.AddSingleton<IProjectsRepository>(sp =>
        {
            var factory = sp.GetRequiredService<Func<string, TableClient>>();
            return new TableProjectsRepository(factory(TableNames.Projects));
        });
    })
    .Build();

host.Run();
