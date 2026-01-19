namespace Portal.RefCache.Api.Models;

public sealed class CreateEstimateRequest
{
    public string ProjectId { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Status { get; init; }
    public double? Amount { get; init; }
    public string? Currency { get; init; }
}
