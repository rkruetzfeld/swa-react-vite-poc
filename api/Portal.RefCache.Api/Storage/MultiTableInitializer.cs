using Azure;
using Azure.Data.Tables;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Portal.RefCache.Api.Storage;

public sealed class MultiTableInitializer : IHostedService
{
    private readonly IReadOnlyList<TableClient> _tables;
    private readonly ILogger _logger;

    public MultiTableInitializer(IReadOnlyList<TableClient> tables, ILogger logger)
    {
        _tables = tables;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        foreach (var table in _tables)
        {
            try
            {
                await table.CreateIfNotExistsAsync(cancellationToken);
                _logger.LogInformation("Table ensured: {TableName}", table.Name);
            }
            catch (RequestFailedException ex)
            {
                _logger.LogWarning(ex, "Table init failed for {TableName} (non-fatal).", table.Name);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Unexpected table init failure for {TableName} (non-fatal).", table.Name);
            }
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
