namespace Portal.RefCache.Api.Domain.Models;

public sealed class CreateEstimateRequest
{
    public string ProjectId { get; init; } = string.Empty;
    public string EstimateNumber { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
}
