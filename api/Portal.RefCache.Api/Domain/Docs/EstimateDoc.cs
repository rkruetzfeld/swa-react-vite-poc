using System.Text.Json.Serialization;

namespace Portal.RefCache.Api.Domain.Docs;

public sealed class EstimateDoc
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("pk")]
    public string Pk { get; init; } = string.Empty;

    public string DocType { get; init; } = "estimate";

    public string TenantId { get; init; } = string.Empty;
    public string EstimateId { get; init; } = string.Empty;

    public string ProjectId { get; init; } = string.Empty;
    public string EstimateNumber { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Status { get; init; } = "Draft";

    public DateTimeOffset CreatedUtc { get; init; }
    public string CreatedBy { get; init; } = string.Empty;
    public DateTimeOffset UpdatedUtc { get; init; }
    public string UpdatedBy { get; init; } = string.Empty;
}
