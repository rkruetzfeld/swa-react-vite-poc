using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
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
            Top = top,
            Cursor = q["cursor"],
            IncludeDiagnostics = TryParseBool(q["includeDiagnostics"]) ?? false
        };

        // NEW: PoC rule - require projectId to avoid cross-partition scans
        if (string.IsNullOrWhiteSpace(query.ProjectId))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("projectId is required for listing estimates in this PoC.");
            return bad;
        }

        // Explicit validation
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
        await res.WriteAsJsonAsync(new PagedResponse<EstimateDto>
        {
            Items = items,
            NextCursor = nextCursor,
            PageSize = query.Top,
            Diagnostics = diagnostics
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

    private static int? TryParseInt(string? s) => int.TryParse(s, out var v) ? v : null;
    private static DateTimeOffset? TryParseDateTimeOffset(string? s) => DateTimeOffset.TryParse(s, out var v) ? v : null;
    private static bool? TryParseBool(string? s) => bool.TryParse(s, out var v) ? v : null;
}
