using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Portal.RefCache.Api.Cosmos;

public sealed class CosmosInitializer : IHostedService
{
    private readonly CosmosClient _client;
    private readonly CosmosOptions _options;
    private readonly ILogger<CosmosInitializer> _log;

    public CosmosInitializer(CosmosClient client, CosmosOptions options, ILogger<CosmosInitializer> log)
    {
        _client = client;
        _options = options;
        _log = log;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!_options.EnsureCreated)
        {
            _log.LogInformation("Cosmos EnsureCreated disabled.");
            return;
        }

        _log.LogInformation("Ensuring Cosmos DB database/container exist: {db}/{container}", _options.Database, _options.Container);

        var db = await _client.CreateDatabaseIfNotExistsAsync(_options.Database, cancellationToken: cancellationToken);
        await db.Database.CreateContainerIfNotExistsAsync(new ContainerProperties
        {
            Id = _options.Container,
            PartitionKeyPath = "/pk"
        }, cancellationToken: cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
