using Microsoft.Azure.Cosmos;
using Portal.RefCache.Api.Models;
using Portal.RefCache.Api.Repositories;

namespace Portal.RefCache.Api.Cosmos;

internal sealed class CosmosProjectDoc
{
    public string Id { get; set; } = string.Empty;  // Cosmos 'id'
    public string Pk { get; set; } = string.Empty;  // partition key (/pk)
    public string DocType { get; set; } = "project";

    public string ProjectId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTimeOffset UpdatedUtc { get; set; }
}

public sealed class CosmosProjectsRepository : IProjectsRepository
{
    private readonly Container _container;
    private readonly string _tenantPk;

    // PoC: single-tenant. Keep a stable PK so queries are cheap.
    public CosmosProjectsRepository(CosmosClient client, CosmosOptions options)
    {
        _container = client.GetContainer(options.Database, options.Container);
        _tenantPk = "tenant:default";
    }

    public async Task<IReadOnlyList<ProjectDto>> ListAsync(CancellationToken ct)
    {
        var q = new QueryDefinition(
            "SELECT c.ProjectId, c.Name, c.UpdatedUtc FROM c WHERE c.Pk = @pk AND c.DocType = 'project' ORDER BY c.UpdatedUtc DESC")
            .WithParameter("@pk", _tenantPk);

        var items = new List<ProjectDto>();
        using var it = _container.GetItemQueryIterator<dynamic>(q, requestOptions: new QueryRequestOptions
        {
            PartitionKey = new PartitionKey(_tenantPk),
            MaxItemCount = 500
        });

        while (it.HasMoreResults)
        {
            var resp = await it.ReadNextAsync(ct);
            foreach (var row in resp)
            {
                items.Add(new ProjectDto
                {
                    ProjectId = (string)row.ProjectId,
                    Name = (string)row.Name,
                    UpdatedUtc = DateTimeOffset.Parse((string)row.UpdatedUtc)
                });
            }
        }

        return items;
    }

    public async Task UpsertAsync(ProjectDto project, CancellationToken ct)
    {
        var doc = new CosmosProjectDoc
        {
            Id = $"project:{project.ProjectId}",
            Pk = _tenantPk,
            ProjectId = project.ProjectId,
            Name = project.Name,
            UpdatedUtc = project.UpdatedUtc
        };

        await _container.UpsertItemAsync(doc, new PartitionKey(_tenantPk), cancellationToken: ct);
    }
}
