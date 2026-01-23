// File: api/Portal.RefCache.Api/Functions/ProjectsFunctions.cs
// Purpose: GET /projects reads Projects from Cosmos DB (Portal/Projects) and returns them for AG Grid.

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
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "projects")] HttpRequestData req,
        FunctionContext ctx)
    {
        var traceId = ctx.InvocationId;
        const string BuildMarker = "projects-hotfix-2026-01-23-1647";

        // Prefer PEG_* names; fall back to older names.
        var dbName = Environment.GetEnvironmentVariable("PEG_COSMOS_DB")
            ?? Environment.GetEnvironmentVariable("COSMOS_DATABASE")
            ?? "Ledger";

        var containerName = Environment.GetEnvironmentVariable("PEG_COSMOS_PROJECTS_CONTAINER")
            ?? Environment.GetEnvironmentVariable("COSMOS_CONTAINER")
            ?? "Projects";

        var tenantId = Environment.GetEnvironmentVariable("PEG_TENANT_ID")
            ?? Environment.GetEnvironmentVariable("TENANT_ID")
            ?? "default";

        try
        {
            var container = _cosmos.GetDatabase(dbName).GetContainer(containerName);

            // We project only the fields we need into a POCO (avoids JsonElement lifetime issues).
            var q = new QueryDefinition(
                    "SELECT c.projectId, c.projectNumber, c.projectName, c.isActive, c.lastUpdateUtc, c.syncedUtc " +
                    "FROM c WHERE c.tenantId = @tenantId")
                .WithParameter("@tenantId", tenantId);

            var it = container.GetItemQueryIterator<ProjectDoc>(
                q,
                requestOptions: new QueryRequestOptions
                {
                    PartitionKey = new PartitionKey(tenantId),
                    MaxItemCount = 2000
                });

            var shaped = new List<object>();

            while (it.HasMoreResults)
            {
                var page = await it.ReadNextAsync();

                foreach (var doc in page)
                {
                    if (string.IsNullOrWhiteSpace(doc.projectId))
                        continue;

                    shaped.Add(new
                    {
                        projectId = doc.projectId,
                        name = doc.projectName ?? "",
                        updatedUtc = doc.lastUpdateUtc ?? "",
                        projectNumber = doc.projectNumber,
                        isActive = doc.isActive ?? false,
                        syncedUtc = doc.syncedUtc
                    });
                }
            }

            var res = req.CreateResponse(HttpStatusCode.OK);
            res.Headers.Add("Content-Type", "application/json; charset=utf-8");
            res.Headers.Add("x-build", BuildMarker);

            await res.WriteStringAsync(JsonSerializer.Serialize(
                shaped,
                new JsonSerializerOptions(JsonSerializerDefaults.Web)));

            return res;
        }
        catch (CosmosException cex)
        {
            var bad = req.CreateResponse(HttpStatusCode.ServiceUnavailable);
            bad.Headers.Add("x-build", BuildMarker);

            await bad.WriteAsJsonAsync(new
            {
                ok = false,
                traceId,
                build = BuildMarker,
                message = "Cosmos query failed for /projects. Check Cosmos DB/Container/PartitionKey (tenantId).",
                cosmosStatus = (int)cex.StatusCode,
                cosmosSubStatus = cex.SubStatusCode,
                error = cex.Message
            });

            return bad;
        }
        catch (Exception ex)
        {
            var bad = req.CreateResponse(HttpStatusCode.InternalServerError);
            bad.Headers.Add("x-build", BuildMarker);

            await bad.WriteAsJsonAsync(new
            {
                ok = false,
                traceId,
                build = BuildMarker,
                message = "Unhandled error in /projects.",
                error = ex.Message,
                detail = ex.ToString()
            });

            return bad;
        }
    }

    // POCO projection for Cosmos query results (matches SELECT fields).
    private sealed class ProjectDoc
    {
        public string? projectId { get; set; }
        public string? projectNumber { get; set; }
        public string? projectName { get; set; }
        public bool? isActive { get; set; }
        public string? lastUpdateUtc { get; set; }
        public string? syncedUtc { get; set; }
    }
}
