using Microsoft.Azure.Cosmos;
using Portal.RefCache.Api.Models;

namespace Portal.RefCache.Api.Cosmos;

public sealed class CosmosPmwebEstimatesRepository
{
    private readonly Container _container;

    public CosmosPmwebEstimatesRepository(CosmosClient client, IConfiguration config)
    {
        var dbName = config["PEG_COSMOS_DB"] ?? "Portal";
        var containerName = config["PEG_COSMOS_ESTIMATES_CONTAINER"] ?? "Portal";
        _container = client.GetContainer(dbName, containerName);
    }

    public async Task UpsertHeadersAsync(string tenantId, IEnumerable<PmwebEstimateHeaderDoc> docs, CancellationToken ct = default)
    {
        foreach (var doc in docs)
        {
            await _container.UpsertItemAsync(doc, new PartitionKey(tenantId), cancellationToken: ct);
        }
    }

    public async Task UpsertDetailsAsync(string tenantId, IEnumerable<PmwebEstimateDetailDoc> docs, CancellationToken ct = default)
    {
        foreach (var doc in docs)
        {
            await _container.UpsertItemAsync(doc, new PartitionKey(tenantId), cancellationToken: ct);
        }
    }

    public async Task<List<PmwebEstimateHeaderDoc>> ListHeadersAsync(string tenantId, string? projectId, int limit = 5000, CancellationToken ct = default)
    {
        var sql = "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.docType = 'pmwebEstimateHeader'";
        var qd = new QueryDefinition(sql).WithParameter("@tenantId", tenantId);
        if (!string.IsNullOrWhiteSpace(projectId))
        {
            sql += " AND c.projectId = @projectId";
            qd = new QueryDefinition(sql)
                .WithParameter("@tenantId", tenantId)
                .WithParameter("@projectId", projectId);
        }

        var results = new List<PmwebEstimateHeaderDoc>();
        using var it = _container.GetItemQueryIterator<PmwebEstimateHeaderDoc>(qd, requestOptions: new QueryRequestOptions
        {
            PartitionKey = new PartitionKey(tenantId),
            MaxItemCount = 200
        });
        while (it.HasMoreResults && results.Count < limit)
        {
            var page = await it.ReadNextAsync(ct);
            results.AddRange(page);
        }
        return results;
    }

    public async Task<PmwebEstimateHeaderDoc?> GetHeaderAsync(string tenantId, string estimateId, CancellationToken ct = default)
    {
        try
        {
            var id = PmwebIds.HeaderDocId(estimateId);
            var resp = await _container.ReadItemAsync<PmwebEstimateHeaderDoc>(id, new PartitionKey(tenantId), cancellationToken: ct);
            return resp.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<List<PmwebEstimateDetailDoc>> ListDetailsAsync(string tenantId, string estimateId, int limit = 20000, CancellationToken ct = default)
    {
        var qd = new QueryDefinition(
                "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.docType = 'pmwebEstimateDetail' AND c.estimateId = @estimateId")
            .WithParameter("@tenantId", tenantId)
            .WithParameter("@estimateId", estimateId);

        var results = new List<PmwebEstimateDetailDoc>();
        using var it = _container.GetItemQueryIterator<PmwebEstimateDetailDoc>(qd, requestOptions: new QueryRequestOptions
        {
            PartitionKey = new PartitionKey(tenantId),
            MaxItemCount = 500
        });
        while (it.HasMoreResults && results.Count < limit)
        {
            var page = await it.ReadNextAsync(ct);
            results.AddRange(page);
        }
        return results;
    }
}

public static class PmwebIds
{
    public static string HeaderDocId(string estimateId) => $"pmweb-estimate-{estimateId}";
    public static string DetailDocId(string estimateDetailId) => $"pmweb-estimatedetail-{estimateDetailId}";
}
