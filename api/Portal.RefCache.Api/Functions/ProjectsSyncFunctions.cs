using System.Diagnostics;
using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Portal.RefCache.Api.Models;
using Portal.RefCache.Api.Repositories;

namespace Portal.RefCache.Api.Functions;

public sealed class ProjectsSyncFunctions
{
    private readonly IPmwebProjectsSource _source;
    private readonly IProjectsRepository _projects;
    private readonly ISyncRunsRepository _runs;
    private readonly ILogger<ProjectsSyncFunctions> _log;

    public ProjectsSyncFunctions(
        IPmwebProjectsSource source,
        IProjectsRepository projects,
        ISyncRunsRepository runs,
        ILogger<ProjectsSyncFunctions> log)
    {
        _source = source;
        _projects = projects;
        _runs = runs;
        _log = log;
    }

    // Manual trigger (useful while validating connectivity)
    [Function("ProjectsSync_RunNow")]
    public async Task<HttpResponseData> RunNow(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "sync/projects")] HttpRequestData req,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;
        var run = await RunOnceAsync(ct);

        var res = req.CreateResponse(run.Succeeded ? HttpStatusCode.OK : HttpStatusCode.BadGateway);
        await res.WriteAsJsonAsync(new { ok = run.Succeeded, run });
        return res;
    }

    // Timer trigger: every 15 minutes (PoC)
    [Function("ProjectsSync_Timer")]
    public async Task Timer(
        [TimerTrigger("0 */15 * * * *")] TimerInfo timer,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;
        var run = await RunOnceAsync(ct);
        _log.LogInformation("Projects sync completed. ok={Ok} count={Count} durationMs={Ms}",
            run.Succeeded, run.RecordCount, run.DurationMs);
    }

    private async Task<SyncRunDto> RunOnceAsync(CancellationToken ct)
    {
        var runId = Guid.NewGuid().ToString("N");
        var started = DateTimeOffset.UtcNow;
        var sw = Stopwatch.StartNew();

        int count = 0;
        bool ok = false;
        string? err = null;

        try
        {
            var projects = await _source.FetchProjectsAsync(ct);

            foreach (var p in projects)
            {
                await _projects.UpsertAsync(p, ct);
                count++;
            }

            ok = true;
        }
        catch (Exception ex)
        {
            err = ex.Message;
            _log.LogError(ex, "Projects sync failed: {Message}", ex.Message);
        }
        finally
        {
            sw.Stop();
        }

        var ended = DateTimeOffset.UtcNow;

        var run = new SyncRunDto
        {
            Entity = "Projects",
            RunId = runId,
            StartedUtc = started,
            EndedUtc = ended,
            DurationMs = sw.ElapsedMilliseconds,
            RecordCount = count,
            Succeeded = ok,
            Error = err
        };

        try
        {
            await _runs.AddAsync(run, ct);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to persist sync run metrics.");
        }

        return run;
    }
}
