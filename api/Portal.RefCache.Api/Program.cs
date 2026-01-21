// File: api/Portal.RefCache.Api/Program.cs
// Purpose: Host + DI wiring for Azure Functions (.NET 8 isolated).

using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

static string? Env(string key) => Environment.GetEnvironmentVariable(key);

static string GetRequired(string key)
    => Env(key) ?? throw new InvalidOperationException($"Missing required environment variable: {key}");

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices(services =>
    {
        // Used by diag endpoints and project sync source.
        services.AddHttpClient();

        // Cosmos client for Projects (and future data).
        services.AddSingleton(sp =>
        {
            // Support both our preferred names and legacy names.
            var conn = Env("PEG_COSMOS_CONNECTION")
                       ?? Env("COSMOS_CONNECTION_STRING")
                       ?? Env("COSMOS_CONNECTION")
                       ?? Env("COSMOS_CONNECTION");

            if (string.IsNullOrWhiteSpace(conn))
                throw new InvalidOperationException(
                    "Cosmos connection string missing. Set PEG_COSMOS_CONNECTION (preferred) or COSMOS_CONNECTION_STRING.");

            return new CosmosClient(conn, new CosmosClientOptions
            {
                SerializerOptions = new CosmosSerializationOptions
                {
                    PropertyNamingPolicy = CosmosPropertyNamingPolicy.CamelCase
                }
            });
        });
    })
    .Build();

host.Run();
