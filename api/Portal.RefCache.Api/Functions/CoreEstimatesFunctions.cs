using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Portal.RefCache.Api.Auth;
using Portal.RefCache.Api.Domain.Models;
using Portal.RefCache.Api.Domain.Repositories;

namespace Portal.RefCache.Api.Functions;

/// <summary>
/// Core domain APIs backed by Cosmos DB.
/// Routes are prefixed with "core" to avoid breaking the existing Table-based PoC endpoints.
/// Once you switch the frontend, you can migrate these to /api/estimates.
/// </summary>
public sealed class CoreEstimatesFunctions
{
    private readonly ICoreEstimatesRepository _repo;

    public CoreEstimatesFunctions(ICoreEstimatesRepository repo)
    {
        _repo = repo;
    }

    [Function("Core_CreateEstimate")]
    public async Task<HttpResponseData> CreateEstimate(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "core/estimates")] HttpRequestData req,
        FunctionContext ctx)
    {
        var auth = RequestAuth.TryGetAuthContext(req);
        if (auth is null) return await RequestAuth.Unauthorized(req);
        if (!RequestAuth.HasAnyRole(auth, "authenticated", "Estimate.Editor", "Estimate.Admin"))
            return await RequestAuth.Forbidden(req);

        var body = await req.ReadFromJsonAsync<CreateEstimateRequest>(cancellationToken: ctx.CancellationToken);
        if (body is null || string.IsNullOrWhiteSpace(body.ProjectId) || string.IsNullOrWhiteSpace(body.Name))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("ProjectId and Name are required.");
            return bad;
        }

        var created = await _repo.CreateEstimateAsync(auth.TenantId, auth.UserDetails, body, ctx.CancellationToken);

        var res = req.CreateResponse(HttpStatusCode.Created);
        await res.WriteAsJsonAsync(created);
        return res;
    }

    [Function("Core_ListEstimates")]
    public async Task<HttpResponseData> ListEstimates(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "core/estimates")] HttpRequestData req,
        FunctionContext ctx)
    {
        var auth = RequestAuth.TryGetAuthContext(req);
        if (auth is null) return await RequestAuth.Unauthorized(req);
        if (!RequestAuth.HasAnyRole(auth, "authenticated", "Estimate.Reader", "Estimate.Editor", "Estimate.Admin"))
            return await RequestAuth.Forbidden(req);

        var q = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        var projectId = q["projectId"];
        var top = int.TryParse(q["top"], out var t) ? t : 50;

        if (string.IsNullOrWhiteSpace(projectId))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("projectId is required.");
            return bad;
        }

        if (top < 1 || top > 200)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("top must be between 1 and 200.");
            return bad;
        }

        var items = await _repo.ListEstimatesByProjectAsync(auth.TenantId, projectId, top, ctx.CancellationToken);
        var res = req.CreateResponse(HttpStatusCode.OK);
        await res.WriteAsJsonAsync(new { items });
        return res;
    }

    [Function("Core_GetEstimate")]
    public async Task<HttpResponseData> GetEstimate(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "core/estimates/{estimateId}")] HttpRequestData req,
        string estimateId,
        FunctionContext ctx)
    {
        var auth = RequestAuth.TryGetAuthContext(req);
        if (auth is null) return await RequestAuth.Unauthorized(req);
        if (!RequestAuth.HasAnyRole(auth, "authenticated", "Estimate.Reader", "Estimate.Editor", "Estimate.Admin"))
            return await RequestAuth.Forbidden(req);

        var doc = await _repo.GetEstimateAsync(auth.TenantId, estimateId, ctx.CancellationToken);
        if (doc is null)
        {
            var nf = req.CreateResponse(HttpStatusCode.NotFound);
            await nf.WriteStringAsync("Estimate not found.");
            return nf;
        }

        var ok = req.CreateResponse(HttpStatusCode.OK);
        await ok.WriteAsJsonAsync(doc);
        return ok;
    }

    [Function("Core_CreateDraftVersion")]
    public async Task<HttpResponseData> CreateDraftVersion(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "core/estimates/{estimateId}/versions")] HttpRequestData req,
        string estimateId,
        FunctionContext ctx)
    {
        var auth = RequestAuth.TryGetAuthContext(req);
        if (auth is null) return await RequestAuth.Unauthorized(req);
        if (!RequestAuth.HasAnyRole(auth, "authenticated", "Estimate.Editor", "Estimate.Admin"))
            return await RequestAuth.Forbidden(req);

        try
        {
            var created = await _repo.CreateDraftVersionAsync(auth.TenantId, estimateId, auth.UserDetails, ctx.CancellationToken);
            var res = req.CreateResponse(HttpStatusCode.Created);
            await res.WriteAsJsonAsync(created);
            return res;
        }
        catch (InvalidOperationException)
        {
            var nf = req.CreateResponse(HttpStatusCode.NotFound);
            await nf.WriteStringAsync("Estimate not found.");
            return nf;
        }
    }

    [Function("Core_ListVersions")]
    public async Task<HttpResponseData> ListVersions(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "core/estimates/{estimateId}/versions")] HttpRequestData req,
        string estimateId,
        FunctionContext ctx)
    {
        var auth = RequestAuth.TryGetAuthContext(req);
        if (auth is null) return await RequestAuth.Unauthorized(req);
        if (!RequestAuth.HasAnyRole(auth, "authenticated", "Estimate.Reader", "Estimate.Editor", "Estimate.Admin"))
            return await RequestAuth.Forbidden(req);

        var items = await _repo.ListVersionsAsync(auth.TenantId, estimateId, ctx.CancellationToken);
        var res = req.CreateResponse(HttpStatusCode.OK);
        await res.WriteAsJsonAsync(new { items });
        return res;
    }

    [Function("Core_ListLineItems")]
    public async Task<HttpResponseData> ListLineItems(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "core/estimates/{estimateId}/versions/{versionId}/line-items")] HttpRequestData req,
        string estimateId,
        string versionId,
        FunctionContext ctx)
    {
        var auth = RequestAuth.TryGetAuthContext(req);
        if (auth is null) return await RequestAuth.Unauthorized(req);
        if (!RequestAuth.HasAnyRole(auth, "authenticated", "Estimate.Reader", "Estimate.Editor", "Estimate.Admin"))
            return await RequestAuth.Forbidden(req);

        var q = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        var top = int.TryParse(q["top"], out var t) ? t : 200;
        var cursor = q["cursor"];

        if (top < 1 || top > 500)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("top must be between 1 and 500.");
            return bad;
        }

        var (items, nextCursor) = await _repo.ListLineItemsAsync(auth.TenantId, estimateId, versionId, top, cursor, ctx.CancellationToken);

        var res = req.CreateResponse(HttpStatusCode.OK);
        await res.WriteAsJsonAsync(new { items, nextCursor });
        return res;
    }

    [Function("Core_BatchUpsertLineItems")]
    public async Task<HttpResponseData> BatchUpsertLineItems(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "core/estimates/{estimateId}/versions/{versionId}/line-items:batchUpsert")] HttpRequestData req,
        string estimateId,
        string versionId,
        FunctionContext ctx)
    {
        var auth = RequestAuth.TryGetAuthContext(req);
        if (auth is null) return await RequestAuth.Unauthorized(req);
        if (!RequestAuth.HasAnyRole(auth, "authenticated", "Estimate.Editor", "Estimate.Admin"))
            return await RequestAuth.Forbidden(req);

        var body = await req.ReadFromJsonAsync<BatchUpsertLineItemsRequest>(cancellationToken: ctx.CancellationToken);
        if (body?.Items is null)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("Body must include items.");
            return bad;
        }

        await _repo.BatchUpsertLineItemsAsync(auth.TenantId, estimateId, versionId, auth.UserDetails, body, ctx.CancellationToken);

        var res = req.CreateResponse(HttpStatusCode.OK);
        await res.WriteStringAsync("OK");
        return res;
    }

    [Function("Core_DeleteLineItem")]
    public async Task<HttpResponseData> DeleteLineItem(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "core/estimates/{estimateId}/versions/{versionId}/line-items/{lineItemId}")] HttpRequestData req,
        string estimateId,
        string versionId,
        string lineItemId,
        FunctionContext ctx)
    {
        var auth = RequestAuth.TryGetAuthContext(req);
        if (auth is null) return await RequestAuth.Unauthorized(req);
        if (!RequestAuth.HasAnyRole(auth, "authenticated", "Estimate.Editor", "Estimate.Admin"))
            return await RequestAuth.Forbidden(req);

        var ok = await _repo.DeleteLineItemAsync(auth.TenantId, estimateId, versionId, lineItemId, ctx.CancellationToken);
        if (!ok)
        {
            var nf = req.CreateResponse(HttpStatusCode.NotFound);
            await nf.WriteStringAsync("Line item not found.");
            return nf;
        }

        var res = req.CreateResponse(HttpStatusCode.NoContent);
        return res;
    }
}
