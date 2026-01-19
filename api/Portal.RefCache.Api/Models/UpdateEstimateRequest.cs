namespace Portal.RefCache.Api.Models;

public sealed class UpdateEstimateRequest
{
    public string? Name { get; init; }
    public string? Status { get; init; }
    public double? Amount { get; init; }
    public string? Currency { get; init; }
}
