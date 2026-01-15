namespace Portal.RefCache.Api.Storage;

public sealed class StorageOptions
{
    public string ConnectionString { get; init; } = "";
    public string EstimatesTableName { get; init; } = "Estimates";
}
