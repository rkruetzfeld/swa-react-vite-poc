using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Portal.RefCache.Api.Repositories;

namespace Portal.RefCache.Api.Functions;

public sealed class ProjectsFunctions
{
    private readonly IProjectsRepository _projects;

    public ProjectsFunctions(IProjectsRepository projects)
    {
        _projects = projects;
    }

    [Function("GetProjects")]
    public async Task<HttpResponseData> GetProjects(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "projects")] HttpRequestData req,
        FunctionContext ctx)
    {
        var items = await _projects.ListAsync(ctx.CancellationToken);

        var res = req.CreateResponse(HttpStatusCode.OK);
        await res.WriteAsJsonAsync(items); // <-- return raw array
        return res;
    }
}
