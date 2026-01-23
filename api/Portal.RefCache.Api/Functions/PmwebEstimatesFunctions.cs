// File: api/Portal.RefCache.Api/Functions/PmwebEstimatesFunctions.cs
// Purpose:
//  - GET /estimates : list PMWeb-synced estimate headers from Cosmos (Portal/Estimates)
//  - GET /estimates/{estimateId} : get a single estimate header
//  - GET /estimates/{estimateId}/details : list estimate detail rows

using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using System.Net;
using System.Text.Json;

namespace Portal.RefCache.Api.Functions;

public sealed class PmwebEstimatesFunctions
{
    private readonly CosmosClient _cosmos;

    public PmwebEstimatesFunctions(CosmosClient cosmos)
    {
        _cosmos = cosmos;
    }

    [Function("GetEstimates")]
    public async Task<HttpResponseData> GetEstimates(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "estimates")] HttpRequestData req,
        FunctionContext ctx)
    {
        var traceId = ctx.InvocationId;

        var dbName = Environment.GetEnvironmentVariable("PEG_COSMOS_DB")
            ?? Environment.GetEnvironmentVariable("COSMOS_DATABASE")
            ?? "Portal";
        // We keep everything in the single active container (Portal) by default.
        // Override with PEG_COSMOS_ESTIMATES_CONTAINER if you ever split containers later.
        var containerName = Environment.GetEnvironmentVariable("PEG_COSMOS_ESTIMATES_CONTAINER")
            ?? "Portal";
        var tenantId = Environment.GetEnvironmentVariable("PEG_TENANT_ID")
            ?? Environment.GetEnvironmentVariable("TENANT_ID")
            ?? "default";

        // Optional filter
        var projectId = GetQuery(req, "projectId");

        try
        {
            var container = _cosmos.GetDatabase(dbName).GetContainer(containerName);

            var sql = "SELECT c.estimateId, c.projectId, c.revisionId, c.revisionNumber, c.revisionDate, c.description, " +
                      "c.docStatusId, c.currencyId, c.isActive, c.categoryId, c.reference, c.totalCostValue, c.totalExtCostValue, " +
                      "c.createdDate, c.createdBy, c.updatedDate, c.updatedBy, c.lastUpdateUtc, c.syncedUtc " +
                      "FROM c WHERE c.tenantId = @tenantId AND c.docType = @docType";

            var q = new QueryDefinition(sql)
                .WithParameter("@tenantId", tenantId)
                .WithParameter("@docType", "pmwebEstimateHeader");

            if (!string.IsNullOrWhiteSpace(projectId))
            {
                q = q.WithParameter("@projectId", projectId);
                sql += " AND c.projectId = @projectId";
                q = new QueryDefinition(sql)
                    .WithParameter("@tenantId", tenantId)
                    .WithParameter("@docType", "pmwebEstimateHeader")
                    .WithParameter("@projectId", projectId);
            }

            var it = container.GetItemQueryIterator<JsonElement>(
                q,
                requestOptions: new QueryRequestOptions
                {
                    PartitionKey = new PartitionKey(tenantId),
                    MaxItemCount = 2000
                });

            var list = new List<JsonElement>();
            while (it.HasMoreResults)
            {
                foreach (var doc in await it.ReadNextAsync())
                    list.Add(doc.Clone());
            }

            var res = req.CreateResponse(HttpStatusCode.OK);
            await res.WriteAsJsonAsync(new { ok = true, count = list.Count, estimates = list, traceId = traceId.ToString() });
            return res;
        }
        catch (Exception ex)
        {
            var res = req.CreateResponse(HttpStatusCode.InternalServerError);
            await res.WriteAsJsonAsync(new { ok = false, error = ex.Message, traceId = traceId.ToString() });
            return res;
        }
    }

    [Function("GetEstimateById")]
    public async Task<HttpResponseData> GetEstimateById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "estimates/{estimateId}")] HttpRequestData req,
        string estimateId,
        FunctionContext ctx)
    {
        var traceId = ctx.InvocationId;

        var dbName = Environment.GetEnvironmentVariable("PEG_COSMOS_DB")
            ?? Environment.GetEnvironmentVariable("COSMOS_DATABASE")
            ?? "Portal";
        var containerName = Environment.GetEnvironmentVariable("PEG_COSMOS_ESTIMATES_CONTAINER")
            ?? "Portal";
        var tenantId = Environment.GetEnvironmentVariable("PEG_TENANT_ID")
            ?? Environment.GetEnvironmentVariable("TENANT_ID")
            ?? "default";

        try
        {
            var container = _cosmos.GetDatabase(dbName).GetContainer(containerName);

            var q = new QueryDefinition(
                "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.docType = @docType AND c.estimateId = @estimateId")
                .WithParameter("@tenantId", tenantId)
                .WithParameter("@docType", "pmwebEstimateHeader")
                .WithParameter("@estimateId", estimateId);

            var it = container.GetItemQueryIterator<JsonElement>(q, requestOptions: new QueryRequestOptions
            {
                PartitionKey = new PartitionKey(tenantId),
                MaxItemCount = 1
            });

            JsonElement? found = null;
            while (it.HasMoreResults && found is null)
            {
                foreach (var doc in await it.ReadNextAsync())
                {
                    found = doc.Clone();
                    break;
                }
            }

            if (found is null)
            {
                var notFound = req.CreateResponse(HttpStatusCode.NotFound);
                await notFound.WriteAsJsonAsync(new { ok = false, error = "Estimate not found", traceId = traceId.ToString() });
                return notFound;
            }

            var res = req.CreateResponse(HttpStatusCode.OK);
            await res.WriteAsJsonAsync(new { ok = true, estimate = found, traceId = traceId.ToString() });
            return res;
        }
        catch (Exception ex)
        {
            var res = req.CreateResponse(HttpStatusCode.InternalServerError);
            await res.WriteAsJsonAsync(new { ok = false, error = ex.Message, traceId = traceId.ToString() });
            return res;
        }
    }

    [Function("GetEstimateDetails")]
    public async Task<HttpResponseData> GetEstimateDetails(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "estimates/{estimateId}/details")] HttpRequestData req,
        string estimateId,
        FunctionContext ctx)
    {
        var traceId = ctx.InvocationId;

        var dbName = Environment.GetEnvironmentVariable("PEG_COSMOS_DB")
            ?? Environment.GetEnvironmentVariable("COSMOS_DATABASE")
            ?? "Portal";
        var containerName = Environment.GetEnvironmentVariable("PEG_COSMOS_ESTIMATES_CONTAINER")
            ?? "Portal";
        var tenantId = Environment.GetEnvironmentVariable("PEG_TENANT_ID")
            ?? Environment.GetEnvironmentVariable("TENANT_ID")
            ?? "default";

        try
        {
            var container = _cosmos.GetDatabase(dbName).GetContainer(containerName);
            var q = new QueryDefinition(
                "SELECT c.detailId, c.estimateId, c.lineNumber, c.itemCode, c.description, c.costCodeId, c.costTypeId, c.uomId, c.quantity, c.unitCost, c.totalCost, c.extCost, c.year, c.periodId " +
                "FROM c WHERE c.tenantId = @tenantId AND c.docType = @docType AND c.estimateId = @estimateId")
                .WithParameter("@tenantId", tenantId)
                .WithParameter("@docType", "pmwebEstimateDetail")
                .WithParameter("@estimateId", estimateId);

            var it = container.GetItemQueryIterator<JsonElement>(q, requestOptions: new QueryRequestOptions
            {
                PartitionKey = new PartitionKey(tenantId),
                MaxItemCount = 5000
            });

            var list = new List<JsonElement>();
            while (it.HasMoreResults)
            {
                foreach (var doc in await it.ReadNextAsync())
                    list.Add(doc.Clone());
            }

            var res = req.CreateResponse(HttpStatusCode.OK);
            await res.WriteAsJsonAsync(new { ok = true, count = list.Count, details = list, traceId = traceId.ToString() });
            return res;
        }
        catch (Exception ex)
        {
            var res = req.CreateResponse(HttpStatusCode.InternalServerError);
            await res.WriteAsJsonAsync(new { ok = false, error = ex.Message, traceId = traceId.ToString() });
            return res;
        }
    }

    private static string? GetQuery(HttpRequestData req, string key)
    {
        var qs = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        return qs.Get(key);
    }
}
