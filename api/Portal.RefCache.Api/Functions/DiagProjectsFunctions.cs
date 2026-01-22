// File: api/Portal.RefCache.Api/Functions/DiagProjectsFunctions.cs
// Purpose: /diag/projects-ping validates Cosmos connectivity + container existence for Projects.

using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.Diagnostics;
using System.Net;

namespace Portal.RefCache.Api.Functions;

public sealed class DiagProjectsFunctions
{
    private readonly CosmosClient _cosmos;
    private readonly ILogger<DiagProjectsFunctions> _log;

    public DiagProjectsFunctions(CosmosClient cosmos, ILogger<DiagProjectsFunctions> log)
    {
        _cosmos = cosmos;
        _log = log;
    }

    [Function("DiagProjectsPing")]
    public async Task<HttpResponseData> ProjectsPing(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "diag/projects-ping")] HttpRequestData req,
        FunctionContext ctx)
    {
        var sw = Stopwatch.StartNew();
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

            // Lightweight read: count 0..1 items in the tenant partition.
            var q = new QueryDefinition("SELECT TOP 1 VALUE c.id FROM c WHERE c.tenantId = @tenantId")
                .WithParameter("@tenantId", tenantId);

            var it = container.GetItemQueryIterator<string>(q, requestOptions: new QueryRequestOptions
            {
                PartitionKey = new PartitionKey(tenantId),
                MaxItemCount = 1
            });

            string? sampleId = null;
            if (it.HasMoreResults)
                sampleId = (await it.ReadNextAsync()).Resource.FirstOrDefault();

            sw.Stop();
            var ok = req.CreateResponse(HttpStatusCode.OK);
            await ok.WriteAsJsonAsync(new
            {
                ok = true,
                traceId,
                elapsedMs = sw.ElapsedMilliseconds,
                dbName,
                containerName,
                tenantId,
                sampleId
            });
            return ok;
        }
        catch (CosmosException cex)
        {
            sw.Stop();
            _log.LogError(cex, "diag/projects-ping cosmos failure");
            var bad = req.CreateResponse(HttpStatusCode.ServiceUnavailable);
            await bad.WriteAsJsonAsync(new
            {
                ok = false,
                traceId,
                elapsedMs = sw.ElapsedMilliseconds,
                message = "Cosmos ping failed (projects). Check DB/container/partition key.",
                cosmosStatus = (int)cex.StatusCode,
                cosmosSubStatus = cex.SubStatusCode,
                error = cex.Message
            });
            return bad;
        }
        catch (Exception ex)
        {
            sw.Stop();
            _log.LogError(ex, "diag/projects-ping failure");
            var bad = req.CreateResponse(HttpStatusCode.InternalServerError);
            await bad.WriteAsJsonAsync(new
            {
                ok = false,
                traceId,
                elapsedMs = sw.ElapsedMilliseconds,
                error = ex.Message
            });
            return bad;
        }
    }
}
