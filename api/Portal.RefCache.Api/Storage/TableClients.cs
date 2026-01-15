using Azure.Data.Tables;

namespace Portal.RefCache.Api.Storage;

public sealed class EstimatesTableClient
{
    public TableClient Client { get; }
    public EstimatesTableClient(TableClient client) => Client = client;
}

public sealed class ProjectsTableClient
{
    public TableClient Client { get; }
    public ProjectsTableClient(TableClient client) => Client = client;
}
