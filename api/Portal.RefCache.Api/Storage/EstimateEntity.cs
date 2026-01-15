using Azure;
using Azure.Data.Tables;

namespace Portal.RefCache.Api.Storage;

public sealed class EstimateEntity : ITableEntity
{
    // Keys
    public required string PartitionKey { get; set; }  // ProjectId
    public required string RowKey { get; set; }        // EstimateId

    // ITableEntity
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    // Domain
    public required string EstimateId { get; set; }
    public required string ProjectId { get; set; }
    public required string Name { get; set; }
    public required string Status { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }

    public double? Amount { get; set; }
    public string? Currency { get; set; }
}
