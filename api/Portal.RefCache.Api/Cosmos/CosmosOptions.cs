namespace Portal.RefCache.Api.Cosmos;

public sealed class CosmosOptions
{
    public string ConnectionString { get; init; } = string.Empty;
    public string Database { get; init; } = "Ledger";
    public string Container { get; init; } = "Estimates";

    /// <summary>
    /// If true, the function app will attempt to create the database/container on startup.
    /// Recommended for local development only; use IaC in real environments.
    /// </summary>
    public bool EnsureCreated { get; init; } = false;
}
