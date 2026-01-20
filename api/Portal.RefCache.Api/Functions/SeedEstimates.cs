using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Portal.RefCache.Api.Auth;
using Portal.RefCache.Api.Models;
using Portal.RefCache.Api.Repositories;

namespace Portal.RefCache.Api.Functions;

public sealed class SeedEstimates
{
    private readonly IEstimatesRepository _repo;
    private readonly IProjectsRepository _projects;

    public SeedEstimates(IEstimatesRepository repo, IProjectsRepository projects)
    {
        _repo = repo;
        _projects = projects;
    }

    [Function("SeedEstimates")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "seed/estimates")] HttpRequestData req,
        FunctionContext ctx)
    {
        var enabled = string.Equals(Environment.GetEnvironmentVariable("SEED_ENABLED"), "true", StringComparison.OrdinalIgnoreCase);
        if (!enabled)
{
         var notFound = req.CreateResponse(HttpStatusCode.NotFound);
         await notFound.WriteStringAsync("Not found.");
        return notFound;
}

        var auth = RequestAuth.TryGetAuthContext(req);
        if (auth is null) return await RequestAuth.Unauthorized(req);
        if (!RequestAuth.HasAnyRole(auth, "Estimate.Admin")) return await RequestAuth.Forbidden(req);

        // Seed Projects (Table Storage)
        var now = DateTimeOffset.UtcNow;
        var projects = new[]
        {
            new ProjectDto { ProjectId = "PROJ-001", Name = "Demo Project 001", UpdatedUtc = now },
            new ProjectDto { ProjectId = "PROJ-002", Name = "Demo Project 002", UpdatedUtc = now },
            new ProjectDto { ProjectId = "PROJ-003", Name = "Demo Project 003", UpdatedUtc = now }
        };

        foreach (var p in projects)
            await _projects.UpsertAsync(p, ctx.CancellationToken);

        await _repo.SeedAsync(ctx.CancellationToken);

        var res = req.CreateResponse(HttpStatusCode.OK);
        await res.WriteAsJsonAsync(new { ok = true, seededUtc = DateTimeOffset.UtcNow });
        return res;
    }
}
