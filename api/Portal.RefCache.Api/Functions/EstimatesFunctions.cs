using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Portal.RefCache.Api.Auth;
using Portal.RefCache.Api.Models;
using Portal.RefCache.Api.Repositories;

namespace Portal.RefCache.Api.Functions;

public sealed class EstimatesFunctions
{
    private readonly IEstimatesRepository _repo;

    public EstimatesFunctions(IEstimatesRepository repo)
    {
        _repo = repo;
    }

    [Function("CreateEstimate")]
    public async Task<HttpResponseData> CreateEstimate(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "estimates")] HttpRequestData req,
        FunctionContext ctx)
    {
        var auth = RequestAuth.TryGetAuthContext(req);
        if (auth is null) return await RequestAuth.Unauthorized(req);
        if (!RequestAuth.HasAnyRole(auth, "authenticated")) return await RequestAuth.Forbidden(req);

        var body = await req.ReadFromJsonAsync<CreateEstimateRequest>(cancellationToken: ctx.CancellationToken);
        if (body is null)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("Missing or invalid JSON body.");
            return bad;
        }

        if (string.IsNullOrWhiteSpace(body.ProjectId) || string.IsNullOrWhiteSpace(body.Name))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("projectId and name are required.");
            return bad;
        }

        var created = await _repo.CreateAsync(body, ctx.CancellationToken);
        var res = req.CreateResponse(HttpStatusCode.Created);
        await res.WriteAsJsonAsync(created);
        return res;
    }

    [Function("GetEstimates")]
    public async Task<HttpResponseData> GetEstimates(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "estimates")] HttpRequestData req,
        FunctionContext ctx)
    {
        var q = System.Web.HttpUtility.ParseQueryString(req.Url.Query);

        var top = TryParseInt(q["top"]) ?? 50;

        var query = new EstimateQuery
        {
            ProjectId = q["projectId"],
            Status = q["status"],
            UpdatedFromUtc = TryParseDateTimeOffset(q["updatedFromUtc"]),
            UpdatedToUtc = TryParseDateTimeOffset(q["updatedToUtc"]),
            Q = q["q"],
            Top = top,
            Cursor = q["cursor"],
            IncludeDiagnostics = TryParseBool(q["includeDiagnostics"]) ?? false,
            IncludeTotal = TryParseBool(q["includeTotal"]) ?? false
        };

        // PoC rule - require projectId to avoid cross-partition scans
        if (string.IsNullOrWhiteSpace(query.ProjectId))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("projectId is required for listing estimates in this PoC.");
            return bad;
        }

        if (query.Top < 1 || query.Top > 200)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("top must be between 1 and 200.");
            return bad;
        }

        if (q["updatedFromUtc"] is not null && query.UpdatedFromUtc is null)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("updatedFromUtc must be a valid ISO 8601 datetime.");
            return bad;
        }

        if (q["updatedToUtc"] is not null && query.UpdatedToUtc is null)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("updatedToUtc must be a valid ISO 8601 datetime.");
            return bad;
        }

        var (items, nextCursor, diagnostics) = await _repo.QueryAsync(query, ctx.CancellationToken);

        var res = req.CreateResponse(HttpStatusCode.OK);
        await res.WriteAsJsonAsync(new
        {
            items,
            nextCursor,
            pageSize = query.Top,
            diagnostics
        });

        return res;
    }

    [Function("GetEstimateById")]
    public async Task<HttpResponseData> GetEstimateById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "estimates/{projectId}/{estimateId}")] HttpRequestData req,
        string projectId,
        string estimateId,
        FunctionContext ctx)
    {
        if (string.IsNullOrWhiteSpace(projectId) || string.IsNullOrWhiteSpace(estimateId))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("projectId and estimateId are required.");
            return bad;
        }

        var dto = await _repo.GetByIdAsync(projectId, estimateId, ctx.CancellationToken);
        if (dto is null)
        {
            var nf = req.CreateResponse(HttpStatusCode.NotFound);
            await nf.WriteStringAsync("Estimate not found.");
            return nf;
        }

        var ok = req.CreateResponse(HttpStatusCode.OK);
        await ok.WriteAsJsonAsync(dto);
        return ok;
    }

    [Function("UpdateEstimate")]
    public async Task<HttpResponseData> UpdateEstimate(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "estimates/{projectId}/{estimateId}")] HttpRequestData req,
        string projectId,
        string estimateId,
        FunctionContext ctx)
    {
        var auth = RequestAuth.TryGetAuthContext(req);
        if (auth is null) return await RequestAuth.Unauthorized(req);
        if (!RequestAuth.HasAnyRole(auth, "authenticated")) return await RequestAuth.Forbidden(req);

        var body = await req.ReadFromJsonAsync<UpdateEstimateRequest>(cancellationToken: ctx.CancellationToken);
        if (body is null)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("Missing or invalid JSON body.");
            return bad;
        }

        var updated = await _repo.UpdateAsync(projectId, estimateId, body, ctx.CancellationToken);
        if (updated is null)
        {
            var nf = req.CreateResponse(HttpStatusCode.NotFound);
            await nf.WriteStringAsync("Estimate not found.");
            return nf;
        }

        var ok = req.CreateResponse(HttpStatusCode.OK);
        await ok.WriteAsJsonAsync(updated);
        return ok;
    }

    [Function("DeleteEstimate")]
    public async Task<HttpResponseData> DeleteEstimate(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "estimates/{projectId}/{estimateId}")] HttpRequestData req,
        string projectId,
        string estimateId,
        FunctionContext ctx)
    {
        var auth = RequestAuth.TryGetAuthContext(req);
        if (auth is null) return await RequestAuth.Unauthorized(req);
        if (!RequestAuth.HasAnyRole(auth, "authenticated")) return await RequestAuth.Forbidden(req);

        var deleted = await _repo.DeleteAsync(projectId, estimateId, ctx.CancellationToken);
        var res = req.CreateResponse(deleted ? HttpStatusCode.OK : HttpStatusCode.NotFound);
        await res.WriteAsJsonAsync(new { ok = deleted });
        return res;
    }

    private static int? TryParseInt(string? s) => int.TryParse(s, out var v) ? v : null;
    private static DateTimeOffset? TryParseDateTimeOffset(string? s) => DateTimeOffset.TryParse(s, out var v) ? v : null;
    private static bool? TryParseBool(string? s) => bool.TryParse(s, out var v) ? v : null;
}
