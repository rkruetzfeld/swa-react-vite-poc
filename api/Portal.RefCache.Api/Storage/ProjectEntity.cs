using Azure;
using Azure.Data.Tables;

namespace Portal.RefCache.Api.Storage;

public sealed class ProjectEntity : ITableEntity
{
    public required string PartitionKey { get; set; }   // "PROJECT"
    public required string RowKey { get; set; }         // ProjectId

    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public required string ProjectId { get; set; }
    public required string Name { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }
}
