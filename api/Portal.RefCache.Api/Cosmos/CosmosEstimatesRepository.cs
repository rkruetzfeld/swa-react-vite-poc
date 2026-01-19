using Microsoft.Azure.Cosmos;
using Portal.RefCache.Api.Models;
using Portal.RefCache.Api.Repositories;

namespace Portal.RefCache.Api.Cosmos;

internal sealed class CosmosEstimateDoc
{
    public string Id { get; set; } = string.Empty; // Cosmos 'id'
    public string Pk { get; set; } = string.Empty; // partition key (/pk)
    public string DocType { get; set; } = "estimate";

    public string EstimateId { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = "Draft";
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
    public double? Amount { get; set; }
    public string? Currency { get; set; }
}

public sealed class CosmosEstimatesRepository : IEstimatesRepository
{
    private readonly Container _container;

    public CosmosEstimatesRepository(CosmosClient client, CosmosOptions options)
    {
        _container = client.GetContainer(options.Database, options.Container);
    }

    public async Task<(IReadOnlyList<EstimateDto> Items, string? NextCursor, object? Diagnostics)> QueryAsync(
        EstimateQuery query,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query.ProjectId))
            return (Array.Empty<EstimateDto>(), null, query.IncludeDiagnostics ? new { reason = "projectId_required" } : null);

        var top = query.Top;
        if (top < 1) top = 1;
        if (top > 200) top = 200;

        // Keep queries partition-local for PoC safety (pk == projectId)
        var q = new QueryDefinition(
                "SELECT * FROM c WHERE c.docType = 'estimate' AND c.pk = @pk ORDER BY c.updatedUtc DESC")
            .WithParameter("@pk", query.ProjectId!.Trim());

        var it = _container.GetItemQueryIterator<CosmosEstimateDoc>(
            q,
            continuationToken: query.Cursor,
            requestOptions: new QueryRequestOptions
            {
                PartitionKey = new PartitionKey(query.ProjectId!.Trim()),
                MaxItemCount = top
            });

        if (!it.HasMoreResults)
            return (Array.Empty<EstimateDto>(), null, query.IncludeDiagnostics ? new { returnedCount = 0 } : null);

        var page = await it.ReadNextAsync(ct);
        var items = page.Resource
            .Take(top)
            .Select(ToDto)
            .ToList();

        object? diag = null;
        if (query.IncludeDiagnostics)
        {
            diag = new
            {
                usedPartitionKey = query.ProjectId,
                requestedTop = query.Top,
                effectiveTop = top,
                returnedCount = items.Count,
                hasCursor = !string.IsNullOrWhiteSpace(query.Cursor),
                requestCharge = page.RequestCharge
            };
        }

        return (items, page.ContinuationToken, diag);
    }

    public async Task<EstimateDto?> GetByIdAsync(string projectId, string estimateId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(projectId) || string.IsNullOrWhiteSpace(estimateId)) return null;

        try
        {
            var resp = await _container.ReadItemAsync<CosmosEstimateDoc>(
                id: estimateId,
                partitionKey: new PartitionKey(projectId),
                cancellationToken: ct);

            return ToDto(resp.Resource);
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<EstimateDto> CreateAsync(CreateEstimateRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.ProjectId)) throw new ArgumentException("ProjectId is required.");
        if (string.IsNullOrWhiteSpace(req.Name)) throw new ArgumentException("Name is required.");

        var now = DateTimeOffset.UtcNow;
        var estimateId = $"EST-{req.ProjectId.Trim()}-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}";

        var doc = new CosmosEstimateDoc
        {
            Id = estimateId,
            Pk = req.ProjectId.Trim(),
            DocType = "estimate",
            EstimateId = estimateId,
            ProjectId = req.ProjectId.Trim(),
            Name = req.Name.Trim(),
            Status = string.IsNullOrWhiteSpace(req.Status) ? "Draft" : req.Status!.Trim(),
            CreatedUtc = now,
            UpdatedUtc = now,
            Amount = req.Amount ?? 0,
            Currency = string.IsNullOrWhiteSpace(req.Currency) ? "CAD" : req.Currency!.Trim()
        };

        await _container.CreateItemAsync(doc, new PartitionKey(doc.Pk), cancellationToken: ct);
        return ToDto(doc);
    }

    public async Task<EstimateDto?> UpdateAsync(string projectId, string estimateId, UpdateEstimateRequest req, CancellationToken ct)
    {
        var existing = await GetByIdAsync(projectId, estimateId, ct);
        if (existing is null) return null;

        // Read doc to preserve any doc fields
        var resp = await _container.ReadItemAsync<CosmosEstimateDoc>(estimateId, new PartitionKey(projectId), cancellationToken: ct);
        var doc = resp.Resource;

        doc.Name = (req.Name ?? doc.Name).Trim();
        if (!string.IsNullOrWhiteSpace(req.Status)) doc.Status = req.Status!.Trim();
        if (req.Amount.HasValue) doc.Amount = req.Amount.Value;
        if (!string.IsNullOrWhiteSpace(req.Currency)) doc.Currency = req.Currency!.Trim();
        doc.UpdatedUtc = DateTimeOffset.UtcNow;

        await _container.ReplaceItemAsync(doc, doc.Id, new PartitionKey(doc.Pk), cancellationToken: ct);
        return ToDto(doc);
    }

    public async Task<bool> DeleteAsync(string projectId, string estimateId, CancellationToken ct)
    {
        try
        {
            await _container.DeleteItemAsync<CosmosEstimateDoc>(estimateId, new PartitionKey(projectId), cancellationToken: ct);
            return true;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    public async Task SeedAsync(CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var projects = new[] { "PROJ-001", "PROJ-002", "PROJ-003" };
        var statuses = new[] { "Draft", "Submitted", "Approved" };

        foreach (var projectId in projects)
        {
            for (var i = 1; i <= 10; i++)
            {
                var estimateId = $"EST-{projectId}-{i:000}";

                var doc = new CosmosEstimateDoc
                {
                    Id = estimateId,
                    Pk = projectId,
                    DocType = "estimate",
                    EstimateId = estimateId,
                    ProjectId = projectId,
                    Name = $"Seed Estimate {i:000} for {projectId}",
                    Status = statuses[(i + projectId.Length) % statuses.Length],
                    CreatedUtc = now.AddDays(-i),
                    UpdatedUtc = now.AddDays(-i / 2.0),
                    Amount = 10000 + (i * 250),
                    Currency = "CAD"
                };

                await _container.UpsertItemAsync(doc, new PartitionKey(doc.Pk), cancellationToken: ct);
            }
        }
    }

    private static EstimateDto ToDto(CosmosEstimateDoc d) => new()
    {
        EstimateId = d.EstimateId,
        ProjectId = d.ProjectId,
        Name = d.Name,
        Status = d.Status,
        CreatedUtc = d.CreatedUtc,
        UpdatedUtc = d.UpdatedUtc,
        Amount = d.Amount,
        Currency = d.Currency
    };
}
