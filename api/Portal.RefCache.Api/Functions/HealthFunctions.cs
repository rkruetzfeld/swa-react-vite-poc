using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Portal.RefCache.Api.Repositories;

namespace Portal.RefCache.Api.Functions;

public sealed class HealthFunctions
{
    private readonly ISyncRunsRepository _runs;

    public HealthFunctions(ISyncRunsRepository runs)
    {
        _runs = runs;
    }

    [Function("Health_Projects")]
    public async Task<HttpResponseData> Projects(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health/projects")] HttpRequestData req,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;
        var top = 25;

        var latest = await _runs.GetLatestAsync("Projects", ct);
        var recent = await _runs.ListRecentAsync("Projects", top, ct);

        var res = req.CreateResponse(HttpStatusCode.OK);
        await res.WriteAsJsonAsync(new
        {
            entity = "Projects",
            latest,
            recent
        });

        return res;
    }
}
