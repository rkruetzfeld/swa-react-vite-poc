using Portal.RefCache.Api.Domain.Docs;
using Portal.RefCache.Api.Domain.Models;
using Portal.RefCache.Api.Domain.Repositories;

namespace Portal.RefCache.Api.Cosmos;

/// <summary>
/// Allows the Function App to start even when Cosmos isn't configured.
/// Calls throw a clear message for local/prod misconfiguration.
/// </summary>
public sealed class NullCoreEstimatesRepository : ICoreEstimatesRepository
{
    private static InvalidOperationException NotConfigured()
        => new("Cosmos is not configured. Set COSMOS_CONNECTION (and optionally COSMOS_DATABASE/COSMOS_CONTAINER).");

    public Task<EstimateDoc> CreateEstimateAsync(string tenantId, string createdBy, CreateEstimateRequest req, CancellationToken ct)
        => throw NotConfigured();

    public Task<IReadOnlyList<EstimateDoc>> ListEstimatesByProjectAsync(string tenantId, string projectId, int top, CancellationToken ct)
        => throw NotConfigured();

    public Task<EstimateDoc?> GetEstimateAsync(string tenantId, string estimateId, CancellationToken ct)
        => throw NotConfigured();

    public Task<EstimateVersionDoc> CreateDraftVersionAsync(string tenantId, string estimateId, string createdBy, CancellationToken ct)
        => throw NotConfigured();

    public Task<IReadOnlyList<EstimateVersionDoc>> ListVersionsAsync(string tenantId, string estimateId, CancellationToken ct)
        => throw NotConfigured();

    public Task<(IReadOnlyList<EstimateLineItemDoc> Items, string? ContinuationToken)> ListLineItemsAsync(string tenantId, string estimateId, string versionId, int top, string? continuationToken, CancellationToken ct)
        => throw NotConfigured();

    public Task BatchUpsertLineItemsAsync(string tenantId, string estimateId, string versionId, string updatedBy, BatchUpsertLineItemsRequest req, CancellationToken ct)
        => throw NotConfigured();

    public Task<bool> DeleteLineItemAsync(string tenantId, string estimateId, string versionId, string lineItemId, CancellationToken ct)
        => throw NotConfigured();
}
