using Azure.Data.Tables;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Portal.RefCache.Api.Repositories;
using Portal.RefCache.Api.Cosmos;
using Portal.RefCache.Api.Domain.Repositories;
using Portal.RefCache.Api.Storage;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices(services =>
    {
        // Prefer SWA env var name you already set (TABLES_CONNECTION),
        // fall back to local AzureWebJobsStorage for local emulator use.
        var connectionString =
            Environment.GetEnvironmentVariable("TABLES_CONNECTION");

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

        // Cosmos (core domain)
        var cosmosConnection = Environment.GetEnvironmentVariable("COSMOS_CONNECTION");
        if (!string.IsNullOrWhiteSpace(cosmosConnection))
        {
            var cosmosDb = Environment.GetEnvironmentVariable("COSMOS_DATABASE") ?? "Ledger";
            var cosmosContainer = Environment.GetEnvironmentVariable("COSMOS_CONTAINER") ?? "Estimates";
            var ensureCreated = string.Equals(Environment.GetEnvironmentVariable("COSMOS_ENSURE_CREATED"), "true", StringComparison.OrdinalIgnoreCase);

            var cosmosOptions = new CosmosOptions
            {
                ConnectionString = cosmosConnection,
                Database = cosmosDb,
                Container = cosmosContainer,
                EnsureCreated = ensureCreated
            };
            services.AddSingleton(cosmosOptions);

            services.AddSingleton(sp => new CosmosClient(
                cosmosOptions.ConnectionString,
                new CosmosClientOptions
                {
                    SerializerOptions = new CosmosSerializationOptions
                    {
                        PropertyNamingPolicy = CosmosPropertyNamingPolicy.CamelCase
                    }
                }));

            services.AddHostedService<CosmosInitializer>();
            services.AddSingleton<ICoreEstimatesRepository, CosmosCoreEstimatesRepository>();
        }
        else
        {
            // Allow app to start without Cosmos configured.
            services.AddSingleton<ICoreEstimatesRepository, NullCoreEstimatesRepository>();
        }
    })
    .Build();

host.Run();
