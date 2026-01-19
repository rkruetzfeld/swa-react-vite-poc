using Microsoft.Azure.Cosmos;
using Portal.RefCache.Api.Domain.Docs;
using Portal.RefCache.Api.Domain.Models;
using Portal.RefCache.Api.Domain.Repositories;

namespace Portal.RefCache.Api.Cosmos;

public sealed class CosmosCoreEstimatesRepository : ICoreEstimatesRepository
{
    private readonly Container _container;

    public CosmosCoreEstimatesRepository(CosmosClient client, CosmosOptions options)
    {
        _container = client.GetContainer(options.Database, options.Container);
    }

    private static string Pk(string tenantId, string estimateId) => $"{tenantId}|{estimateId}";
    private static string EstimateDocId(string estimateId) => $"estimate:{estimateId}";
    private static string VersionDocId(string estimateId, string versionId) => $"version:{estimateId}:{versionId}";
    private static string LineItemDocId(string estimateId, string versionId, string lineItemId) => $"lineItem:{estimateId}:{versionId}:{lineItemId}";

    public async Task<EstimateDoc> CreateEstimateAsync(string tenantId, string createdBy, CreateEstimateRequest req, CancellationToken ct)
    {
        var estimateId = Guid.NewGuid().ToString("N");
        var now = DateTimeOffset.UtcNow;

        var doc = new EstimateDoc
        {
            Id = EstimateDocId(estimateId),
            Pk = Pk(tenantId, estimateId),
            TenantId = tenantId,
            EstimateId = estimateId,
            ProjectId = req.ProjectId.Trim(),
            EstimateNumber = string.IsNullOrWhiteSpace(req.EstimateNumber) ? estimateId[..8] : req.EstimateNumber.Trim(),
            Name = req.Name.Trim(),
            Status = "Draft",
            CreatedUtc = now,
            CreatedBy = createdBy,
            UpdatedUtc = now,
            UpdatedBy = createdBy
        };

        // Transaction: create estimate + initial draft version
        var versionId = Guid.NewGuid().ToString("N");
        var version = new EstimateVersionDoc
        {
            Id = VersionDocId(estimateId, versionId),
            Pk = doc.Pk,
            TenantId = tenantId,
            EstimateId = estimateId,
            VersionId = versionId,
            VersionNumber = 1,
            State = "Draft",
            CreatedUtc = now,
            CreatedBy = createdBy
        };

        var batch = _container.CreateTransactionalBatch(new PartitionKey(doc.Pk))
            .CreateItem(doc)
            .CreateItem(version);

        var resp = await batch.ExecuteAsync(ct);
        if (!resp.IsSuccessStatusCode)
            throw new CosmosException($"Failed to create estimate. Status: {resp.StatusCode}", resp.StatusCode, 0, resp.ActivityId, resp.RequestCharge);

        return doc;
    }

    public async Task<IReadOnlyList<EstimateDoc>> ListEstimatesByProjectAsync(string tenantId, string projectId, int top, CancellationToken ct)
    {
        // Cross-partition query (by design for MVP).
        var q = new QueryDefinition(
                "SELECT TOP @top * FROM c WHERE c.docType = 'estimate' AND c.tenantId = @tenantId AND c.projectId = @projectId ORDER BY c.updatedUtc DESC")
            .WithParameter("@top", top)
            .WithParameter("@tenantId", tenantId)
            .WithParameter("@projectId", projectId);

        var it = _container.GetItemQueryIterator<EstimateDoc>(q, requestOptions: new QueryRequestOptions
        {
            MaxItemCount = top
        });

        var results = new List<EstimateDoc>();
        while (it.HasMoreResults && results.Count < top)
        {
            var page = await it.ReadNextAsync(ct);
            results.AddRange(page.Resource);
        }

        return results;
    }

    public async Task<EstimateDoc?> GetEstimateAsync(string tenantId, string estimateId, CancellationToken ct)
    {
        // We don't know pk without a lookup; for MVP we query by tenant+estimateId.
        // (If you later have a deterministic estimateId prefix per tenant, you can store pk elsewhere.)
        var q = new QueryDefinition(
                "SELECT * FROM c WHERE c.docType = 'estimate' AND c.tenantId = @tenantId AND c.estimateId = @estimateId")
            .WithParameter("@tenantId", tenantId)
            .WithParameter("@estimateId", estimateId);

        var it = _container.GetItemQueryIterator<EstimateDoc>(q, requestOptions: new QueryRequestOptions
        {
            MaxItemCount = 1
        });

        if (!it.HasMoreResults) return null;
        var page = await it.ReadNextAsync(ct);
        return page.Resource.FirstOrDefault();
    }

    public async Task<EstimateVersionDoc> CreateDraftVersionAsync(string tenantId, string estimateId, string createdBy, CancellationToken ct)
    {
        // Find the estimate (needed to compute pk)
        var estimate = await GetEstimateAsync(tenantId, estimateId, ct);
        if (estimate is null)
            throw new InvalidOperationException("Estimate not found.");

        // Determine next version number (query within partition)
        var q = new QueryDefinition(
                "SELECT VALUE MAX(c.versionNumber) FROM c WHERE c.docType = 'version' AND c.estimateId = @estimateId")
            .WithParameter("@estimateId", estimateId);

        var it = _container.GetItemQueryIterator<int?>(q, requestOptions: new QueryRequestOptions
        {
            PartitionKey = new PartitionKey(estimate.Pk),
            MaxItemCount = 1
        });

        int next = 1;
        if (it.HasMoreResults)
        {
            var page = await it.ReadNextAsync(ct);
            var max = page.Resource.FirstOrDefault();
            if (max.HasValue) next = max.Value + 1;
        }

        var now = DateTimeOffset.UtcNow;
        var versionId = Guid.NewGuid().ToString("N");
        var version = new EstimateVersionDoc
        {
            Id = VersionDocId(estimateId, versionId),
            Pk = estimate.Pk,
            TenantId = tenantId,
            EstimateId = estimateId,
            VersionId = versionId,
            VersionNumber = next,
            State = "Draft",
            CreatedUtc = now,
            CreatedBy = createdBy
        };

        await _container.CreateItemAsync(version, new PartitionKey(estimate.Pk), cancellationToken: ct);
        return version;
    }

    public async Task<IReadOnlyList<EstimateVersionDoc>> ListVersionsAsync(string tenantId, string estimateId, CancellationToken ct)
    {
        var estimate = await GetEstimateAsync(tenantId, estimateId, ct);
        if (estimate is null) return Array.Empty<EstimateVersionDoc>();

        var q = new QueryDefinition(
            "SELECT * FROM c WHERE c.docType = 'version' AND c.estimateId = @estimateId ORDER BY c.versionNumber DESC")
            .WithParameter("@estimateId", estimateId);

        var it = _container.GetItemQueryIterator<EstimateVersionDoc>(q, requestOptions: new QueryRequestOptions
        {
            PartitionKey = new PartitionKey(estimate.Pk)
        });

        var results = new List<EstimateVersionDoc>();
        while (it.HasMoreResults)
        {
            var page = await it.ReadNextAsync(ct);
            results.AddRange(page.Resource);
        }

        return results;
    }

    public async Task<(IReadOnlyList<EstimateLineItemDoc> Items, string? ContinuationToken)> ListLineItemsAsync(
        string tenantId,
        string estimateId,
        string versionId,
        int top,
        string? continuationToken,
        CancellationToken ct)
    {
        var estimate = await GetEstimateAsync(tenantId, estimateId, ct);
        if (estimate is null) return (Array.Empty<EstimateLineItemDoc>(), null);

        var q = new QueryDefinition(
            "SELECT * FROM c WHERE c.docType = 'lineItem' AND c.estimateId = @estimateId AND c.versionId = @versionId ORDER BY c.lineNumber ASC")
            .WithParameter("@estimateId", estimateId)
            .WithParameter("@versionId", versionId);

        var it = _container.GetItemQueryIterator<EstimateLineItemDoc>(q, continuationToken, new QueryRequestOptions
        {
            PartitionKey = new PartitionKey(estimate.Pk),
            MaxItemCount = top
        });

        var page = await it.ReadNextAsync(ct);
        return (page.Resource.ToList(), page.ContinuationToken);
    }

    public async Task BatchUpsertLineItemsAsync(
        string tenantId,
        string estimateId,
        string versionId,
        string updatedBy,
        BatchUpsertLineItemsRequest req,
        CancellationToken ct)
    {
        var estimate = await GetEstimateAsync(tenantId, estimateId, ct);
        if (estimate is null)
            throw new InvalidOperationException("Estimate not found.");

        var pk = estimate.Pk;
        var now = DateTimeOffset.UtcNow;

        // Cosmos transactional batch has a limit of 100 operations.
        // We chunk to stay under the limit.
        const int batchSize = 90;
        var items = req.Items ?? new List<UpsertLineItem>();

        foreach (var chunk in items.Chunk(batchSize))
        {
            var batch = _container.CreateTransactionalBatch(new PartitionKey(pk));
            foreach (var i in chunk)
            {
                var lineItemId = string.IsNullOrWhiteSpace(i.LineItemId) ? Guid.NewGuid().ToString("N") : i.LineItemId!.Trim();
                var amount = i.Quantity * i.UnitPrice;

                var doc = new EstimateLineItemDoc
                {
                    Id = LineItemDocId(estimateId, versionId, lineItemId),
                    Pk = pk,
                    TenantId = tenantId,
                    EstimateId = estimateId,
                    VersionId = versionId,
                    LineItemId = lineItemId,
                    LineNumber = i.LineNumber,
                    CostCode = i.CostCode.Trim(),
                    Description = i.Description.Trim(),
                    Quantity = i.Quantity,
                    Uom = i.Uom.Trim(),
                    UnitPrice = i.UnitPrice,
                    Amount = amount,
                    Notes = i.Notes,
                    UpdatedUtc = now,
                    UpdatedBy = updatedBy
                };

                batch.UpsertItem(doc);
            }

            var resp = await batch.ExecuteAsync(ct);
            if (!resp.IsSuccessStatusCode)
                throw new CosmosException($"Failed batch upsert. Status: {resp.StatusCode}", resp.StatusCode, 0, resp.ActivityId, resp.RequestCharge);
        }
    }
}
