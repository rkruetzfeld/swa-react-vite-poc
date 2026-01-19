using System.Text.Json.Serialization;

namespace Portal.RefCache.Api.Domain.Docs;

public sealed class EstimateVersionDoc
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("pk")]
    public string Pk { get; init; } = string.Empty;

    public string DocType { get; init; } = "version";

    public string TenantId { get; init; } = string.Empty;
    public string EstimateId { get; init; } = string.Empty;
    public string VersionId { get; init; } = string.Empty;
    public int VersionNumber { get; init; }
    public string State { get; init; } = "Draft";

    public DateTimeOffset CreatedUtc { get; init; }
    public string CreatedBy { get; init; } = string.Empty;
}
