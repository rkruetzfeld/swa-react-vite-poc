// File: api/Portal.RefCache.Api/Functions/ProjectsSyncFunctions.cs
// Purpose: Pull Projects from Logic App (PMWeb SQL SP) and upsert into Cosmos DB (Portal/Projects).
//
// Assumptions:
//   - .NET 8 isolated Azure Functions
//   - CosmosClient is registered in Program.cs
//   - App settings exist:
//       PROJECTS_SYNC_URL                  = Logic App callback URL (manual trigger invoke URL)
//       PEG_COSMOS_CONNECTION              = Cosmos DB connection string
//       PEG_COSMOS_DB                      = Portal
//       PEG_COSMOS_PROJECTS_CONTAINER      = Projects
//       PEG_TENANT_ID                      = default

using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Extensions.Timer;
using Microsoft.Extensions.Logging;

namespace Portal.RefCache.Api.Functions;

public sealed class ProjectsSyncFunctions
{
    private readonly CosmosClient _cosmos;

    public ProjectsSyncFunctions(CosmosClient cosmos)
    {
        _cosmos = cosmos;
    }

    [Function("Projects_Sync_Timer")]
    public async Task Run(
        [TimerTrigger("0 */15 * * * *")] TimerInfo timer, // every 15 minutes
        FunctionContext context)
    {
        var log = context.GetLogger("Projects_Sync_Timer");

        var syncUrl = Environment.GetEnvironmentVariable("PROJECTS_SYNC_URL");
        if (string.IsNullOrWhiteSpace(syncUrl))
        {
            log.LogError("Missing app setting PROJECTS_SYNC_URL. Cannot sync Projects.");
            return;
        }

        var dbName = Environment.GetEnvironmentVariable("PEG_COSMOS_DB") ?? "Portal";
        var containerName = Environment.GetEnvironmentVariable("PEG_COSMOS_PROJECTS_CONTAINER") ?? "Projects";
        var tenantId = Environment.GetEnvironmentVariable("PEG_TENANT_ID") ?? "default";

        var container = _cosmos.GetDatabase(dbName).GetContainer(containerName);

        using var http = new HttpClient();

        // If you later implement watermarking, pass sinceUtc here instead of null.
        var resp = await http.PostAsJsonAsync(syncUrl, new { sinceUtc = (string?)null, includeInactive = false });
        resp.EnsureSuccessStatusCode();

        var payload = await resp.Content.ReadFromJsonAsync<JsonElement>();
        if (!payload.TryGetProperty("results", out var resultsEl) || resultsEl.ValueKind != JsonValueKind.Array)
        {
            log.LogError("Logic App response missing results[]. Payload: {Payload}", payload.ToString());
            return;
        }

        var nowUtc = DateTime.UtcNow;
        var count = 0;

        foreach (var p in resultsEl.EnumerateArray())
        {
            var projectId = p.GetProperty("Id").GetInt32();
            var projectNumber = p.TryGetProperty("ProjectNumber", out var pn) && pn.ValueKind != JsonValueKind.Null ? pn.GetString() : null;
            var projectName = p.TryGetProperty("ProjectName", out var pnm) && pnm.ValueKind != JsonValueKind.Null ? pnm.GetString() : null;
            var isActive = p.TryGetProperty("IsActive", out var ia) && ia.ValueKind != JsonValueKind.Null && ia.GetBoolean();

            string? lastUpdateUtc = null;
            if (p.TryGetProperty("LastUpdateDate", out var lud) && lud.ValueKind != JsonValueKind.Null)
                lastUpdateUtc = lud.GetString();

            var doc = new ProjectDoc
            {
                Id = $"pmweb-{projectId}",
                TenantId = tenantId,
                ProjectId = projectId,
                ProjectNumber = projectNumber,
                ProjectName = projectName,
                IsActive = isActive,
                LastUpdateUtc = lastUpdateUtc,
                Source = "PMWeb",
                SyncedUtc = nowUtc
            };

            await container.UpsertItemAsync(doc, new PartitionKey(tenantId));
            count++;
        }

        log.LogInformation(
            "Projects sync complete. Upserted {Count} projects into {Db}/{Container} for tenant {TenantId}.",
            count, dbName, containerName, tenantId);
    }

    private sealed class ProjectDoc
    {
        public string Id { get; set; } = default!;
        public string TenantId { get; set; } = default!;
        public int ProjectId { get; set; }
        public string? ProjectNumber { get; set; }
        public string? ProjectName { get; set; }
        public bool IsActive { get; set; }
        public string? LastUpdateUtc { get; set; }
        public string Source { get; set; } = "PMWeb";
        public DateTime SyncedUtc { get; set; }
    }
}
