using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.Diagnostics;
using System.Net;
using System.Linq;

namespace Portal.RefCache.Api.Functions;

public sealed class ProjectsOpsFunctions
{
    private readonly CosmosClient _cosmos;
    private readonly ILogger<ProjectsOpsFunctions> _log;

    public ProjectsOpsFunctions(CosmosClient cosmos, ILogger<ProjectsOpsFunctions> log)
    {
        _cosmos = cosmos;
        _log = log;
    }

    [Function("SyncProjectsNow")]
    public async Task<HttpResponseData> SyncProjectsNow(
        // ✅ Allow GET + POST so /api/sync/projects doesn’t return HTML 405 pages when browsed directly
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "sync/projects")] HttpRequestData req,
        FunctionContext ctx)
    {
        var sw = Stopwatch.StartNew();
        var traceId = ctx.InvocationId;

        try
        {
            var syncUrl = Environment.GetEnvironmentVariable("PEG_PMWEB_PROJECTS_LOGICAPP_URL")
                ?? Environment.GetEnvironmentVariable("PROJECTS_SYNC_URL");
            if (string.IsNullOrWhiteSpace(syncUrl))
            {
                var bad = req.CreateResponse(HttpStatusCode.InternalServerError);
                await bad.WriteAsJsonAsync(new { ok = false, traceId, message = "PEG_PMWEB_PROJECTS_LOGICAPP_URL / PROJECTS_SYNC_URL is not set" });
                return bad;
            }

            var tenantId = Environment.GetEnvironmentVariable("PEG_TENANT_ID")
                ?? Environment.GetEnvironmentVariable("TENANT_ID")
                ?? "default";

            var upserted = await ProjectsSyncFunctions.SyncOnceAsync(_cosmos, syncUrl, tenantId, _log);
            sw.Stop();

            var ok = req.CreateResponse(HttpStatusCode.OK);
            await ok.WriteAsJsonAsync(new
            {
                ok = true,
                traceId,
                elapsedMs = sw.ElapsedMilliseconds,
                upserted
            });
            return ok;
        }
        catch (Exception ex)
        {
            sw.Stop();
            _log.LogError(ex, "projects sync-now failed");
            var bad = req.CreateResponse(HttpStatusCode.InternalServerError);
            await bad.WriteAsJsonAsync(new
            {
                ok = false,
                traceId,
                elapsedMs = sw.ElapsedMilliseconds,
                message = ex.Message
            });
            return bad;
        }
    }

    [Function("ProjectsHealth")]
    public async Task<HttpResponseData> ProjectsHealth(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health/sync-runs/projects")] HttpRequestData req,
        FunctionContext ctx)
    {
        var traceId = ctx.InvocationId;

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

        // Aggregates are cheap within a single partition.
        var qCount = new QueryDefinition("SELECT VALUE COUNT(1) FROM c WHERE c.tenantId = @tenantId")
            .WithParameter("@tenantId", tenantId);
        var qMax = new QueryDefinition("SELECT VALUE MAX(c.syncedUtc) FROM c WHERE c.tenantId = @tenantId")
            .WithParameter("@tenantId", tenantId);

        var countIt = container.GetItemQueryIterator<int>(qCount, requestOptions: new QueryRequestOptions
        {
            PartitionKey = new PartitionKey(tenantId)
        });
        var maxIt = container.GetItemQueryIterator<DateTime?>(qMax, requestOptions: new QueryRequestOptions
        {
            PartitionKey = new PartitionKey(tenantId)
        });

        int total = 0;
        DateTime? lastSyncedUtc = null;

        if (countIt.HasMoreResults)
            total = (await countIt.ReadNextAsync()).Resource.FirstOrDefault();
        if (maxIt.HasMoreResults)
            lastSyncedUtc = (await maxIt.ReadNextAsync()).Resource.FirstOrDefault();

        var res = req.CreateResponse(HttpStatusCode.OK);
        await res.WriteAsJsonAsync(new
        {
            ok = true,
            traceId,
            tenantId,
            total,
            lastSyncedUtc
        });
        return res;
    }


    [Function("ProjectsHealthUi")]
    public async Task<HttpResponseData> ProjectsHealthUi(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health/projects")] HttpRequestData req,
        FunctionContext ctx)
    {
        // Back-compat for the UI which calls /health/projects
        // Shape matches the UI's HealthResponse type.
        var traceId = ctx.InvocationId;

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

            var qCount = new QueryDefinition("SELECT VALUE COUNT(1) FROM c WHERE c.tenantId = @tenantId")
                .WithParameter("@tenantId", tenantId);
            var qMax = new QueryDefinition("SELECT VALUE MAX(c.syncedUtc) FROM c WHERE c.tenantId = @tenantId")
                .WithParameter("@tenantId", tenantId);

            var countIt = container.GetItemQueryIterator<int>(qCount, requestOptions: new QueryRequestOptions
            {
                PartitionKey = new PartitionKey(tenantId)
            });
            var maxIt = container.GetItemQueryIterator<DateTime?>(qMax, requestOptions: new QueryRequestOptions
            {
                PartitionKey = new PartitionKey(tenantId)
            });

            int total = 0;
            DateTime? lastSyncedUtc = null;

            if (countIt.HasMoreResults)
                total = (await countIt.ReadNextAsync()).Resource.FirstOrDefault();
            if (maxIt.HasMoreResults)
                lastSyncedUtc = (await maxIt.ReadNextAsync()).Resource.FirstOrDefault();

            var res = req.CreateResponse(HttpStatusCode.OK);
            await res.WriteAsJsonAsync(new
            {
                entity = "projects",
                latest = new
                {
                    runId = traceId,
                    startedUtc = lastSyncedUtc?.ToString("o") ?? "",
                    endedUtc = lastSyncedUtc?.ToString("o") ?? "",
                    durationMs = 0,
                    recordCount = total,
                    succeeded = true,
                    error = (string?)null
                }
            });
            return res;
        }
        catch (Exception ex)
        {
            var bad = req.CreateResponse(HttpStatusCode.OK);
            await bad.WriteAsJsonAsync(new
            {
                entity = "projects",
                latest = new
                {
                    runId = traceId,
                    startedUtc = "",
                    endedUtc = "",
                    durationMs = 0,
                    recordCount = 0,
                    succeeded = false,
                    error = ex.Message
                }
            });
            return bad;
        }
    }

}
