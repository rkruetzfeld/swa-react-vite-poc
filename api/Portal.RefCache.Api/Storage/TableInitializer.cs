using Azure;
using Azure.Data.Tables;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Portal.RefCache.Api.Storage;

public sealed class TableInitializer : IHostedService
{
    private readonly TableClient _table;
    private readonly ILogger<TableInitializer> _logger;

    public TableInitializer(TableClient table, ILogger<TableInitializer> logger)
    {
        _table = table;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _table.CreateIfNotExistsAsync(cancellationToken);
            _logger.LogInformation("Table ensured: {TableName}", _table.Name);
        }
        catch (RequestFailedException ex)
        {
            _logger.LogWarning(ex, "Table initialization failed (non-fatal). API will still start.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Unexpected error during table initialization (non-fatal).");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
