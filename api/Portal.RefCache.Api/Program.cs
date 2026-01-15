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
        var connectionString = Environment.GetEnvironmentVariable("AzureWebJobsStorage");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("AzureWebJobsStorage is not set.");

        // Factory so we can explicitly create table clients by name (no DI ambiguity)
        services.AddSingleton<Func<string, TableClient>>(_ =>
            (tableName) => new TableClient(connectionString, tableName));

        // Create both tables once at startup (non-fatal)
        services.AddHostedService(sp =>
        {
            var log = sp.GetRequiredService<ILogger<TableInitializer>>();
            var factory = sp.GetRequiredService<Func<string, TableClient>>();
            return new MultiTableInitializer(
                new[] { factory(TableNames.Estimates), factory(TableNames.Projects) },
                log);
        });

        // Repositories (explicitly pass the right table client)
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
