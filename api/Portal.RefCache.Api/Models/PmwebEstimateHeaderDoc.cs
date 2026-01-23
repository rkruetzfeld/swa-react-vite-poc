using System.Text.Json.Serialization;

namespace Portal.RefCache.Api.Models;

/// <summary>
/// PMWeb SQL "Estimates" header row materialized into Cosmos.
/// Partitioned by TenantId.
/// </summary>
public sealed class PmwebEstimateHeaderDoc
{
    // Cosmos required
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }

    [JsonPropertyName("docType")]
    public string DocType { get; init; } = "pmwebEstimateHeader";

    // Source keys
    public required string EstimateId { get; init; } // PMWeb SQL [Demo].[dbo].[Estimates].[Id]

    public string? ProjectId { get; init; }
    public string? RevisionId { get; init; }
    public int? RevisionNumber { get; init; }
    public DateTime? RevisionDate { get; init; }
    public string? Description { get; init; }
    public string? UomId { get; init; }
    public decimal? EstimateUnit { get; init; }
    public string? DocStatusId { get; init; }
    public string? CurrencyId { get; init; }
    public bool? IsActive { get; init; }
    public string? SpecificationGroupId { get; init; }
    public DateTime? LastRevitUpdateDate { get; init; }
    public string? LastRevitUpdatedBy { get; init; }
    public DateTime? CreatedDate { get; init; }
    public string? CreatedBy { get; init; }
    public DateTime? UpdatedDate { get; init; }
    public string? UpdatedBy { get; init; }
    public string? CategoryId { get; init; }
    public string? Reference { get; init; }
    public decimal? TotalCostValue { get; init; }
    public decimal? TotalExtCostValue { get; init; }
    public string? CheckList_SubmittedById { get; init; }
    public DateTime? CheckList_SubmittedDate { get; init; }
    public int? LastAssemblyPassNumber { get; init; }
    public string? SpecField1 { get; init; }
    public string? SpecField2 { get; init; }
    public string? SpecField3 { get; init; }
    public string? SpecField4 { get; init; }
    public string? SpecField5 { get; init; }
    public string? SpecField6 { get; init; }
    public string? SpecField7 { get; init; }
    public string? SpecField8 { get; init; }
    public string? SpecField9 { get; init; }
    public string? SpecField10 { get; init; }

    // Portal bookkeeping
    public DateTime IngestedUtc { get; init; } = DateTime.UtcNow;
}
