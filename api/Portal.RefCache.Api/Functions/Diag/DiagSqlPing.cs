using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Portal.RefCache.Api.Functions;

public class DiagSqlPing
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<DiagSqlPing> _log;

    public DiagSqlPing(IHttpClientFactory httpClientFactory, ILogger<DiagSqlPing> log)
    {
        _httpClientFactory = httpClientFactory;
        _log = log;
    }

    [Function("DiagSqlPing")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "diag/sql-ping")] HttpRequestData req,
        FunctionContext ctx)
    {
        var traceId = ctx.InvocationId; // correlation id you can grep in logs
        var sw = Stopwatch.StartNew();

        var logicAppUrl = Environment.GetEnvironmentVariable("SQL_PING_LOGICAPP_URL");
        if (string.IsNullOrWhiteSpace(logicAppUrl))
        {
            var bad = req.CreateResponse(HttpStatusCode.InternalServerError);
            await bad.WriteAsJsonAsync(new
            {
                ok = false,
                elapsedMs = sw.ElapsedMilliseconds,
                traceId,
                errorCategory = "config",
                message = "SQL_PING_LOGICAPP_URL is not set"
            });
            return bad;
        }

        try
        {
            var client = _httpClientFactory.CreateClient();
            using var laResp = await client.PostAsJsonAsync(logicAppUrl, new { });

            var body = await laResp.Content.ReadAsStringAsync();
            sw.Stop();

            if (!laResp.IsSuccessStatusCode)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadGateway);
                await bad.WriteAsJsonAsync(new
                {
                    ok = false,
                    elapsedMs = sw.ElapsedMilliseconds,
                    traceId,
                    errorCategory = "upstream",
                    upstreamStatus = (int)laResp.StatusCode,
                    upstreamBody = body.Length > 500 ? body[..500] : body // avoid huge payloads
                });
                return bad;
            }

            // Return a normalized wrapper (keep your existing LA payload as "payload")
            var ok = req.CreateResponse(HttpStatusCode.OK);
            await ok.WriteAsJsonAsync(new
            {
                ok = true,
                elapsedMs = sw.ElapsedMilliseconds,
                traceId,
                payload = body // string; you can later parse JSON if you want
            });

            return ok;
        }
        catch (HttpRequestException ex)
        {
            sw.Stop();
            var bad = req.CreateResponse(HttpStatusCode.BadGateway);
            await bad.WriteAsJsonAsync(new
            {
                ok = false,
                elapsedMs = sw.ElapsedMilliseconds,
                traceId,
                errorCategory = ClassifyHttp(ex),
                message = ex.Message
            });
            return bad;
        }
        catch (TaskCanceledException ex)
        {
            sw.Stop();
            var bad = req.CreateResponse(HttpStatusCode.GatewayTimeout);
            await bad.WriteAsJsonAsync(new
            {
                ok = false,
                elapsedMs = sw.ElapsedMilliseconds,
                traceId,
                errorCategory = "timeout",
                message = ex.Message
            });
            return bad;
        }
        catch (Exception ex)
        {
            sw.Stop();
            _log.LogError(ex, "diag sql-ping failed");
            var bad = req.CreateResponse(HttpStatusCode.InternalServerError);
            await bad.WriteAsJsonAsync(new
            {
                ok = false,
                elapsedMs = sw.ElapsedMilliseconds,
                traceId,
                errorCategory = "unknown",
                message = ex.Message
            });
            return bad;
        }
    }

    private static string ClassifyHttp(HttpRequestException ex)
    {
        // Best-effort categorization without leaking secrets
        var msg = (ex.Message ?? "").ToLowerInvariant();
        if (msg.Contains("name or service not known") || msg.Contains("nodename nor servname") || msg.Contains("no such host"))
            return "dns";
        if (msg.Contains("unauthorized") || msg.Contains("401"))
            return "auth";
        if (msg.Contains("forbidden") || msg.Contains("403"))
            return "auth";
        if (msg.Contains("timeout") || msg.Contains("timed out"))
            return "timeout";
        return "network";
    }
}
