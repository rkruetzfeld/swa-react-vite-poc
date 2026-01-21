// File: api/Portal.RefCache.Api/Functions/ProjectsFunctions.cs
// Purpose: GET /api/projects reads Projects from Cosmos DB (Portal/Projects) and returns them for AG Grid.

using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using System.Net;
using System.Text.Json;

namespace Portal.RefCache.Api.Functions;

public sealed class ProjectsFunctions
{
    private readonly CosmosClient _cosmos;

    public ProjectsFunctions(CosmosClient cosmos)
    {
        _cosmos = cosmos;
    }

    [Function("GetProjects")]
    public async Task<HttpResponseData> GetProjects(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "projects")] HttpRequestData req)
    {
        // Prefer the newer PEG_* names, but fall back to the earlier COSMOS_* names
        // used elsewhere in the repo.
        var dbName = Environment.GetEnvironmentVariable("PEG_COSMOS_DB")
            ?? Environment.GetEnvironmentVariable("COSMOS_DATABASE")
            ?? "Ledger";
        var containerName = Environment.GetEnvironmentVariable("PEG_COSMOS_PROJECTS_CONTAINER")
            ?? Environment.GetEnvironmentVariable("COSMOS_CONTAINER")
            ?? "Projects";
        var tenantId = Environment.GetEnvironmentVariable("PEG_TENANT_ID")
            ?? Environment.GetEnvironmentVariable("TENANT_ID")
            ?? "default";

        var container = _cosmos.GetDatabase(dbName).GetContainer(containerName);

        var q = new QueryDefinition(
            "SELECT c.projectId, c.projectNumber, c.projectName, c.isActive, c.lastUpdateUtc, c.syncedUtc " +
            "FROM c WHERE c.tenantId = @tenantId")
            .WithParameter("@tenantId", tenantId);

        var it = container.GetItemQueryIterator<ProjectRow>(
            q,
            requestOptions: new QueryRequestOptions
            {
                PartitionKey = new PartitionKey(tenantId),
                MaxItemCount = 2000
            });

        var rows = new List<ProjectRow>();
        while (it.HasMoreResults)
        {
            foreach (var row in await it.ReadNextAsync())
                rows.Add(row);
        }

        // Shape the response for the UI (AG Grid)
        var shaped = rows.Select(r => new
        {
            projectId = r.ProjectId,
            name = r.ProjectName,
            updatedUtc = r.LastUpdateUtc,
            projectNumber = r.ProjectNumber,
            isActive = r.IsActive,
            syncedUtc = r.SyncedUtc
        });

        var res = req.CreateResponse(HttpStatusCode.OK);
        res.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await res.WriteStringAsync(JsonSerializer.Serialize(shaped, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        return res;
    }

    private sealed class ProjectRow
    {
        public int ProjectId { get; set; }
        public string? ProjectNumber { get; set; }
        public string? ProjectName { get; set; }
        public bool IsActive { get; set; }
        public string? LastUpdateUtc { get; set; }
        public DateTime? SyncedUtc { get; set; }
    }
}
