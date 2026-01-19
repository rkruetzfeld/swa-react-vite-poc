using Portal.RefCache.Api.Domain.Docs;
using Portal.RefCache.Api.Domain.Models;

namespace Portal.RefCache.Api.Domain.Repositories;

public interface ICoreEstimatesRepository
{
    Task<EstimateDoc> CreateEstimateAsync(string tenantId, string createdBy, CreateEstimateRequest req, CancellationToken ct);
    Task<IReadOnlyList<EstimateDoc>> ListEstimatesByProjectAsync(string tenantId, string projectId, int top, CancellationToken ct);
    Task<EstimateDoc?> GetEstimateAsync(string tenantId, string estimateId, CancellationToken ct);

    Task<EstimateVersionDoc> CreateDraftVersionAsync(string tenantId, string estimateId, string createdBy, CancellationToken ct);
    Task<IReadOnlyList<EstimateVersionDoc>> ListVersionsAsync(string tenantId, string estimateId, CancellationToken ct);

    Task<(IReadOnlyList<EstimateLineItemDoc> Items, string? ContinuationToken)> ListLineItemsAsync(string tenantId, string estimateId, string versionId, int top, string? continuationToken, CancellationToken ct);
    Task BatchUpsertLineItemsAsync(string tenantId, string estimateId, string versionId, string updatedBy, BatchUpsertLineItemsRequest req, CancellationToken ct);
}
