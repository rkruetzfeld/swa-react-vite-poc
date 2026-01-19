using Azure;
using Azure.Data.Tables;
using Portal.RefCache.Api.Mapping;
using Portal.RefCache.Api.Models;
using Portal.RefCache.Api.Repositories;

namespace Portal.RefCache.Api.Storage;

public sealed class TableEstimatesRepository : IEstimatesRepository
{
    private readonly TableClient _estimatesTable;
    private readonly TableClient _projectsTable;
    private const string ProjectPartition = "PROJECT";

    private bool _ensured;
    private readonly SemaphoreSlim _ensureLock = new(1, 1);

    public TableEstimatesRepository(TableClient estimatesTable, TableClient projectsTable)
    {
        _estimatesTable = estimatesTable;
        _projectsTable = projectsTable;
    }

    public async Task<(IReadOnlyList<EstimateDto> Items, string? NextCursor, object? Diagnostics)> QueryAsync(
        EstimateQuery query,
        CancellationToken ct)
    {
        await EnsureTablesAsync(ct);

        var top = query.Top;
        if (top < 1) top = 1;
        if (top > 200) top = 200;

        var filters = new List<string>();

        // Partition-local is required by endpoint, but keep the filter explicit anyway
        if (!string.IsNullOrWhiteSpace(query.ProjectId))
            filters.Add($"PartitionKey eq '{EscapeOData(query.ProjectId!)}'");

        if (!string.IsNullOrWhiteSpace(query.Status))
            filters.Add($"Status eq '{EscapeOData(query.Status!)}'");

        if (query.UpdatedFromUtc.HasValue)
            filters.Add($"UpdatedUtc ge datetime'{query.UpdatedFromUtc.Value.UtcDateTime:O}'");

        if (query.UpdatedToUtc.HasValue)
            filters.Add($"UpdatedUtc le datetime'{query.UpdatedToUtc.Value.UtcDateTime:O}'");

        var filter = filters.Count == 0 ? null : string.Join(" and ", filters);

        // If q is present, we do a bounded scan within the partition and filter in-memory.
        // This avoids relying on OData functions that vary across Table implementations.
        var hasSearch = !string.IsNullOrWhiteSpace(query.Q);
        var search = query.Q?.Trim();

        // Bound the scan for PoC safety
        var scanCap = Math.Min(500, top * 5);

        // Continuation token handling:
        // - If hasSearch: we treat cursor as continuation within the bounded scan
        // - If no search: normal paging
        var pageSizeHint = hasSearch ? scanCap : top;

        var pageable = _estimatesTable.QueryAsync<EstimateEntity>(
            filter: filter,
            maxPerPage: pageSizeHint,
            cancellationToken: ct);

        await foreach (var page in pageable.AsPages(continuationToken: query.Cursor, pageSizeHint: pageSizeHint))
        {
            IEnumerable<EstimateEntity> entities = page.Values;

            if (hasSearch && !string.IsNullOrEmpty(search))
            {
                entities = entities.Where(e =>
                    e.Name != null &&
                    e.Name.Contains(search, StringComparison.OrdinalIgnoreCase));
            }

            var items = entities
                .Take(top)
                .Select(EstimateMapper.ToDto)
                .ToList();

            // If we used search + bounded scan, the continuation token is still valid
            // (but you may “page” through more results until you exhaust the scan).
            var next = page.ContinuationToken;

            object? diag = null;
            if (query.IncludeDiagnostics)
            {
                diag = new
                {
                    filter,
                    usedPartitionFilter = !string.IsNullOrWhiteSpace(query.ProjectId),
                    requestedTop = query.Top,
                    effectiveTop = top,
                    hasCursor = !string.IsNullOrWhiteSpace(query.Cursor),
                    returnedCount = items.Count,
                    hasSearch,
                    search,
                    scanCap
                };
            }

            return (items, next, diag);
        }

        return (Array.Empty<EstimateDto>(), null,
            query.IncludeDiagnostics ? new { filter, returnedCount = 0, hasSearch, search, scanCap } : null);
    }

    public async Task<EstimateDto?> GetByIdAsync(string projectId, string estimateId, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);

        try
        {
            var entity = await _estimatesTable.GetEntityAsync<EstimateEntity>(
                partitionKey: projectId,
                rowKey: estimateId,
                cancellationToken: ct);

            return EstimateMapper.ToDto(entity.Value);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }

    public async Task<EstimateDto> CreateAsync(CreateEstimateRequest req, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);

        if (string.IsNullOrWhiteSpace(req.ProjectId)) throw new ArgumentException("ProjectId is required.");
        if (string.IsNullOrWhiteSpace(req.Name)) throw new ArgumentException("Name is required.");

        var now = DateTimeOffset.UtcNow;
        var estimateId = $"EST-{req.ProjectId.Trim()}-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}";

        var entity = new EstimateEntity
        {
            PartitionKey = req.ProjectId.Trim(),
            RowKey = estimateId,
            EstimateId = estimateId,
            ProjectId = req.ProjectId.Trim(),
            Name = req.Name.Trim(),
            Status = string.IsNullOrWhiteSpace(req.Status) ? "Draft" : req.Status!.Trim(),
            CreatedUtc = now,
            UpdatedUtc = now,
            Amount = req.Amount ?? 0,
            Currency = string.IsNullOrWhiteSpace(req.Currency) ? "CAD" : req.Currency!.Trim()
        };

        await _estimatesTable.UpsertEntityAsync(entity, TableUpdateMode.Merge, ct);
        return EstimateMapper.ToDto(entity);
    }

    public async Task<EstimateDto?> UpdateAsync(string projectId, string estimateId, UpdateEstimateRequest req, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);

        var existing = await GetByIdAsync(projectId, estimateId, ct);
        if (existing is null) return null;

        var now = DateTimeOffset.UtcNow;

        var entity = new EstimateEntity
        {
            PartitionKey = projectId,
            RowKey = estimateId,
            EstimateId = estimateId,
            ProjectId = projectId,
            Name = (req.Name ?? existing.Name).Trim(),
            Status = string.IsNullOrWhiteSpace(req.Status) ? existing.Status : req.Status!.Trim(),
            CreatedUtc = existing.CreatedUtc,
            UpdatedUtc = now,
            Amount = req.Amount ?? existing.Amount ?? 0,
            Currency = string.IsNullOrWhiteSpace(req.Currency) ? existing.Currency : req.Currency!.Trim()
        };

        await _estimatesTable.UpsertEntityAsync(entity, TableUpdateMode.Merge, ct);
        return EstimateMapper.ToDto(entity);
    }

    public async Task<bool> DeleteAsync(string projectId, string estimateId, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);

        try
        {
            await _estimatesTable.DeleteEntityAsync(projectId, estimateId, cancellationToken: ct);
            return true;
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return false;
        }
    }

    public async Task SeedAsync(CancellationToken ct)
    {
        await EnsureTablesAsync(ct);

        var now = DateTimeOffset.UtcNow;

        var projects = new[]
        {
            new ProjectDto { ProjectId = "PROJ-001", Name = "Demo Project 001", UpdatedUtc = now },
            new ProjectDto { ProjectId = "PROJ-002", Name = "Demo Project 002", UpdatedUtc = now },
            new ProjectDto { ProjectId = "PROJ-003", Name = "Demo Project 003", UpdatedUtc = now }
        };

        foreach (var p in projects)
        {
            var pe = new ProjectEntity
            {
                PartitionKey = ProjectPartition,
                RowKey = p.ProjectId,
                ProjectId = p.ProjectId,
                Name = p.Name,
                UpdatedUtc = p.UpdatedUtc
            };

            await _projectsTable.UpsertEntityAsync(pe, TableUpdateMode.Merge, ct);
        }

        var statuses = new[] { "Draft", "Submitted", "Approved" };

        foreach (var p in projects)
        {
            var actions = new List<TableTransactionAction>(100);

            for (var i = 1; i <= 30; i++)
            {
                var estimateId = $"EST-{p.ProjectId}-{i:000}";

                var entity = new EstimateEntity
                {
                    PartitionKey = p.ProjectId,
                    RowKey = estimateId,
                    EstimateId = estimateId,
                    ProjectId = p.ProjectId,
                    Name = $"Estimate {i:000} for {p.ProjectId}",
                    Status = statuses[(i + p.ProjectId.Length) % statuses.Length],
                    CreatedUtc = now.AddDays(-i),
                    UpdatedUtc = now.AddDays(-i / 2.0),
                    Amount = 10000 + (i * 250),
                    Currency = "CAD"
                };

                actions.Add(new TableTransactionAction(TableTransactionActionType.UpsertMerge, entity));
            }

            await _estimatesTable.SubmitTransactionAsync(actions, ct);
        }
    }

    private async Task EnsureTablesAsync(CancellationToken ct)
    {
        if (_ensured) return;

        await _ensureLock.WaitAsync(ct);
        try
        {
            if (_ensured) return;

            await _estimatesTable.CreateIfNotExistsAsync(ct);
            await _projectsTable.CreateIfNotExistsAsync(ct);

            _ensured = true;
        }
        finally
        {
            _ensureLock.Release();
        }
    }

    private static string EscapeOData(string value) => value.Replace("'", "''");
}
