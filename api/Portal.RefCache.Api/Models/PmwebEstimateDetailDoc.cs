using System.Text.Json.Serialization;

namespace Portal.RefCache.Api.Models;

/// <summary>
/// PMWeb SQL "EstimateDetails" row materialized into Cosmos.
/// Partitioned by TenantId.
/// </summary>
public sealed class PmwebEstimateDetailDoc
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }

    [JsonPropertyName("docType")]
    public string DocType { get; init; } = "pmwebEstimateDetail";

    // Source keys
    public required string EstimateDetailId { get; init; } // [Demo].[dbo].[EstimateDetails].[Id]
    public required string EstimateId { get; init; }      // [Demo].[dbo].[EstimateDetails].[EstimateId]

    public int? LineNumber { get; init; }
    public string? AssemblyCode { get; init; }
    public decimal? AssemblyMultiplier { get; init; }
    public string? AssemblyIdentifier { get; init; }
    public string? AssemblyPassId { get; init; }
    public string? ItemCode { get; init; }
    public string? Description { get; init; }
    public string? PhaseId { get; init; }
    public string? CostCodeId { get; init; }
    public string? CostTypeId { get; init; }
    public string? UomId { get; init; }
    public decimal? Quantity { get; init; }
    public string? CurrencyId { get; init; }
    public decimal? UnitCost { get; init; }
    public decimal? ExtendedQuantity { get; init; }
    public decimal? TotalCost { get; init; }
    public bool? IsSubmittal { get; init; }
    public string? CompanyId { get; init; }
    public string? LocationId { get; init; }
    public string? Notes1 { get; init; }
    public string? BIMId { get; init; }
    public bool? Imported { get; init; }
    public string? BidCategoryId { get; init; }
    public decimal? ExtCost { get; init; }
    public string? DocumentAdjustmentId { get; init; }
    public decimal? Adjustment1 { get; init; }
    public decimal? Adjustment2 { get; init; }
    public decimal? Tax { get; init; }
    public string? PeriodId { get; init; }
    public string? TaskId { get; init; }
    public int? Year { get; init; }
    public string? FundingSourceId { get; init; }
    public string? ResourceId { get; init; }
    public string? ResourceType { get; init; }
    public string? ManufacturerId { get; init; }
    public string? ManufacturerNumber { get; init; }
    public string? CopiedFromId { get; init; }
    public string? Field1 { get; init; }
    public string? Field2 { get; init; }
    public string? Field3 { get; init; }
    public string? Field4 { get; init; }
    public string? Field5 { get; init; }
    public string? Field6 { get; init; }
    public string? Field7 { get; init; }
    public string? Field8 { get; init; }
    public string? Field9 { get; init; }
    public string? Field10 { get; init; }
    public string? WbsId { get; init; }

    public DateTime IngestedUtc { get; init; } = DateTime.UtcNow;
}
