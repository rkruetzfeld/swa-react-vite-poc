using Portal.RefCache.Api.Models;

namespace Portal.RefCache.Api.Repositories;

public interface IEstimatesRepository
{
    Task<(IReadOnlyList<EstimateDto> Items, string? NextCursor, object? Diagnostics)> QueryAsync(
        EstimateQuery query,
        CancellationToken ct);

    Task<EstimateDto?> GetByIdAsync(string projectId, string estimateId, CancellationToken ct);

    Task SeedAsync(CancellationToken ct);
}
