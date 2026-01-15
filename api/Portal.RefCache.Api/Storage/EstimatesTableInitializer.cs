using Azure.Data.Tables;

namespace Portal.RefCache.Api.Storage;

public sealed class EstimatesTableInitializer
{
    private readonly TableClient _table;

    public EstimatesTableInitializer(TableClient table)
    {
        _table = table;
    }

    public Task EnsureCreatedAsync()
        => _table.CreateIfNotExistsAsync();
}
