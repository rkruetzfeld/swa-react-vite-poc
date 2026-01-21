using Portal.RefCache.Api.Models;
using Portal.RefCache.Api.Repositories;

namespace Portal.RefCache.Api.Storage;

// PoC fallback when Cosmos isn't configured.
// NOTE: data is lost on cold start.
public sealed class InMemorySyncRunsRepository : ISyncRunsRepository
{
    private readonly object _lock = new();
    private readonly List<SyncRunDto> _runs = new();

    public Task AddAsync(SyncRunDto run, CancellationToken ct)
    {
        lock (_lock)
        {
            _runs.Add(run);
            // keep last 200
            if (_runs.Count > 200)
                _runs.RemoveRange(0, _runs.Count - 200);
        }
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<SyncRunDto>> ListRecentAsync(string entity, int top, CancellationToken ct)
    {
        lock (_lock)
        {
            var list = _runs
                .Where(r => string.Equals(r.Entity, entity, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(r => r.StartedUtc)
                .Take(top)
                .ToList()
                .AsReadOnly();

            return Task.FromResult((IReadOnlyList<SyncRunDto>)list);
        }
    }

    public async Task<SyncRunDto?> GetLatestAsync(string entity, CancellationToken ct)
    {
        var list = await ListRecentAsync(entity, 1, ct);
        return list.Count > 0 ? list[0] : null;
    }
}
