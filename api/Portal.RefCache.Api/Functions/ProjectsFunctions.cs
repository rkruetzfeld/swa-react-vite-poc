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

        // TEMP DEBUG: proves which code is deployed + what storage it’s reading
        var tablesConn = Environment.GetEnvironmentVariable("TABLES_CONNECTION") ?? "";
        var accountName = "unknown";
        foreach (var part in tablesConn.Split(';', StringSplitOptions.RemoveEmptyEntries))
        {
            if (part.StartsWith("AccountName=", StringComparison.OrdinalIgnoreCase))
            {
                accountName = part.Split('=', 2)[1];
                break;
            }
        }

        await res.WriteAsJsonAsync(new
        {
            marker = "PROJECTS_V2_ARRAY_2026-01-19",
            storageAccount = accountName,
            count = items.Count,
            items
        });

        return res;
    }
}
