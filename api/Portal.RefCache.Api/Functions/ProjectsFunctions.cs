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

            // Be liberal with schema. We only require projectId + projectName.
            var q = new QueryDefinition(
                    "SELECT c.projectId, c.projectNumber, c.projectName, c.isActive, c.lastUpdateUtc, c.syncedUtc " +
                    "FROM c WHERE c.tenantId = @tenantId")
                .WithParameter("@tenantId", tenantId);

            var it = container.GetItemQueryIterator<JsonElement>(
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
                    // Cosmos can materialize JsonElement backed by an internal JsonDocument
                    // that may be disposed after the FeedResponse is consumed. Clone() makes
                    // the element safe to access beyond the immediate enumerator lifetime.
                    var safe = doc.Clone();

                    var projectId = GetString(safe, "projectId");
                    if (string.IsNullOrWhiteSpace(projectId))
                        continue;

                    shaped.Add(new
                    {
                        projectId,
                        name = GetString(safe, "projectName") ?? GetString(safe, "name") ?? "",
                        updatedUtc = GetString(safe, "lastUpdateUtc") ?? GetString(safe, "updatedUtc") ?? "",
                        projectNumber = GetString(safe, "projectNumber"),
                        isActive = GetBool(safe, "isActive"),
                        syncedUtc = GetString(safe, "syncedUtc")
                    });
                }
            }

            var res = req.CreateResponse(HttpStatusCode.OK);
            res.Headers.Add("Content-Type", "application/json; charset=utf-8");
            await res.WriteStringAsync(JsonSerializer.Serialize(
                shaped,
                new JsonSerializerOptions(JsonSerializerDefaults.Web)));

            return res;
        }
        catch (CosmosException cex)
        {
            var bad = req.CreateResponse(HttpStatusCode.ServiceUnavailable);
            await bad.WriteAsJsonAsync(new
            {
                ok = false,
                traceId,
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
            await bad.WriteAsJsonAsync(new
            {
                ok = false,
                traceId,
                message = "Unhandled error in /projects.",
                error = ex.Message
            });
            return bad;
        }
    }

    private static string? GetString(JsonElement doc, string name)
    {
        if (!doc.TryGetProperty(name, out var p)) return null;
        return p.ValueKind switch
        {
            JsonValueKind.String => p.GetString(),
            JsonValueKind.Number => p.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => p.GetRawText()
        };
    }

    private static bool GetBool(JsonElement doc, string name)
    {
        if (!doc.TryGetProperty(name, out var p)) return false;
        return p.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String => string.Equals(p.GetString(), "true", StringComparison.OrdinalIgnoreCase),
            JsonValueKind.Number => p.TryGetInt32(out var n) && n != 0,
            _ => false
        };
    }
}
