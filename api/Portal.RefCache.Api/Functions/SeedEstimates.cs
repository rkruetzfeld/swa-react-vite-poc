using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Portal.RefCache.Api.Repositories;

namespace Portal.RefCache.Api.Functions;

public sealed class SeedEstimates
{
    private readonly IEstimatesRepository _repo;

    public SeedEstimates(IEstimatesRepository repo)
    {
        _repo = repo;
    }

    [Function("SeedEstimates")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "seed/estimates")] HttpRequestData req,
        FunctionContext ctx)
    {
        await _repo.SeedAsync(ctx.CancellationToken);

        var res = req.CreateResponse(HttpStatusCode.OK);
        await res.WriteAsJsonAsync(new { ok = true, seededUtc = DateTimeOffset.UtcNow });
        return res;
    }
}
