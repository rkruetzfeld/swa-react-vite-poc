using System.Text.Json.Serialization;

namespace Portal.RefCache.Api.Domain.Docs;

public sealed class EstimateLineItemDoc
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("pk")]
    public string Pk { get; init; } = string.Empty;

    public string DocType { get; init; } = "lineItem";

    public string TenantId { get; init; } = string.Empty;
    public string EstimateId { get; init; } = string.Empty;
    public string VersionId { get; init; } = string.Empty;
    public string LineItemId { get; init; } = string.Empty;

    public int LineNumber { get; init; }
    public string CostCode { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public string Uom { get; init; } = string.Empty;
    public decimal UnitPrice { get; init; }
    public decimal Amount { get; init; }
    public string? Notes { get; init; }

    public DateTimeOffset UpdatedUtc { get; init; }
    public string UpdatedBy { get; init; } = string.Empty;
}
