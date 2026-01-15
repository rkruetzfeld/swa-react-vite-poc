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
        // In SWA-managed Functions you cannot set AzureWebJobsStorage via SWA env vars.
        // Use TABLES_CONNECTION for Azure Tables. Fall back to AzureWebJobsStorage for local dev.
        var tablesConnection =
            Environment.GetEnvironmentVariable("TABLES_CONNECTION")
            ?? Environment.GetEnvironmentVariable("AzureWebJobsStorage");

        if (string.IsNullOrWhiteSpace(tablesConnection))
        {
            // IMPORTANT: do NOT throw here; SWA-managed runtime may still start and we want clear errors per endpoint.
            // We will log and let repositories fail gracefully when invoked.
            services.AddSingleton(new StorageBootstrapState(
                IsConfigured: false,
                ConnectionString: string.Empty,
                Reason: "Neither TABLES_CONNECTION nor AzureWebJobsStorage is set."
            ));
        }
        else
        {
            services.AddSingleton(new StorageBootstrapState(
                IsConfigured: true,
                ConnectionString: tablesConnection,
                Reason: string.Empty
            ));
        }

        // Factory so we can explicitly create table clients by name (no DI ambiguity)
        services.AddSingleton<Func<string, TableClient>>(sp =>
        {
            var state = sp.GetRequiredService<StorageBootstrapState>();

            return (tableName) =>
            {
                if (!state.IsConfigured)
                    throw new InvalidOperationException("Table Storage is not configured. " + state.Reason);

                return new TableClient(state.ConnectionString, tableName);
            };
        });

        // Create both tables once at startup (non-fatal)
services.AddHostedService<IHostedService>(sp =>
{
    var log = sp.GetRequiredService<ILogger<MultiTableInitializer>>();
    var state = sp.GetRequiredService<StorageBootstrapState>();

    if (!state.IsConfigured)
    {
        log.LogWarning("Skipping table initialization: {Reason}", state.Reason);
        return new NoopHostedService();
    }

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

internal sealed record StorageBootstrapState(bool IsConfigured, string ConnectionString, string Reason);

internal sealed class NoopHostedService : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
