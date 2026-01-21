using Microsoft.Azure.Cosmos;
using Portal.RefCache.Api.Models;
using Portal.RefCache.Api.Repositories;

namespace Portal.RefCache.Api.Cosmos;

internal sealed class CosmosSyncRunDoc
{
    public string Id { get; set; } = string.Empty;
    public string Pk { get; set; } = string.Empty;
    public string DocType { get; set; } = "syncrun";

    public string Entity { get; set; } = string.Empty;
    public string RunId { get; set; } = string.Empty;
    public DateTimeOffset StartedUtc { get; set; }
    public DateTimeOffset EndedUtc { get; set; }
    public long DurationMs { get; set; }
    public int RecordCount { get; set; }
    public bool Succeeded { get; set; }
    public string? Error { get; set; }
}

public sealed class CosmosSyncRunsRepository : ISyncRunsRepository
{
    private readonly Container _container;
    private readonly string _pk;

    public CosmosSyncRunsRepository(CosmosClient client, CosmosOptions options)
    {
        _container = client.GetContainer(options.Database, options.Container);
        _pk = "tenant:default";
    }

    public async Task AddAsync(SyncRunDto run, CancellationToken ct)
    {
        var doc = new CosmosSyncRunDoc
        {
            Id = $"syncrun:{run.Entity}:{run.RunId}",
            Pk = _pk,
            Entity = run.Entity,
            RunId = run.RunId,
            StartedUtc = run.StartedUtc,
            EndedUtc = run.EndedUtc,
            DurationMs = run.DurationMs,
            RecordCount = run.RecordCount,
            Succeeded = run.Succeeded,
            Error = run.Error
        };

        await _container.UpsertItemAsync(doc, new PartitionKey(_pk), cancellationToken: ct);
    }

    public async Task<IReadOnlyList<SyncRunDto>> ListRecentAsync(string entity, int top, CancellationToken ct)
    {
        var q = new QueryDefinition(
            "SELECT TOP @top c.Entity, c.RunId, c.StartedUtc, c.EndedUtc, c.DurationMs, c.RecordCount, c.Succeeded, c.Error " +
            "FROM c WHERE c.Pk = @pk AND c.DocType = 'syncrun' AND c.Entity = @entity ORDER BY c.StartedUtc DESC")
            .WithParameter("@top", top)
            .WithParameter("@pk", _pk)
            .WithParameter("@entity", entity);

        var items = new List<SyncRunDto>();
        using var it = _container.GetItemQueryIterator<dynamic>(q, requestOptions: new QueryRequestOptions
        {
            PartitionKey = new PartitionKey(_pk),
            MaxItemCount = top
        });

        while (it.HasMoreResults)
        {
            var resp = await it.ReadNextAsync(ct);
            foreach (var row in resp)
            {
                items.Add(new SyncRunDto
                {
                    Entity = (string)row.Entity,
                    RunId = (string)row.RunId,
                    StartedUtc = DateTimeOffset.Parse((string)row.StartedUtc),
                    EndedUtc = DateTimeOffset.Parse((string)row.EndedUtc),
                    DurationMs = (long)row.DurationMs,
                    RecordCount = (int)row.RecordCount,
                    Succeeded = (bool)row.Succeeded,
                    Error = (string?)row.Error
                });
            }
        }

        return items;
    }

    public async Task<SyncRunDto?> GetLatestAsync(string entity, CancellationToken ct)
    {
        var runs = await ListRecentAsync(entity, 1, ct);
        return runs.Count > 0 ? runs[0] : null;
    }
}
