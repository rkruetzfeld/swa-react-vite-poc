namespace Portal.RefCache.Api.Models;

public sealed class EstimateDto
{
    public required string EstimateId { get; init; }
    public required string ProjectId { get; init; }

    public required string Name { get; init; }
    public required string Status { get; init; }

    public required DateTimeOffset CreatedUtc { get; init; }
    public required DateTimeOffset UpdatedUtc { get; init; }

    public double? Amount { get; init; }
    public string? Currency { get; init; }
}
