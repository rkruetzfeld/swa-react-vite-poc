using Portal.RefCache.Api.Models;

namespace Portal.RefCache.Api.Repositories;

public interface ISyncRunsRepository
{
    Task AddAsync(SyncRunDto run, CancellationToken ct);
    Task<IReadOnlyList<SyncRunDto>> ListRecentAsync(string entity, int top, CancellationToken ct);
    Task<SyncRunDto?> GetLatestAsync(string entity, CancellationToken ct);
}
