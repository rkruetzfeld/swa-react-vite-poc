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
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "diag/sql-ping")] HttpRequestData req)
    {
        var logicAppUrl = Environment.GetEnvironmentVariable("SQL_PING_LOGICAPP_URL");
        if (string.IsNullOrWhiteSpace(logicAppUrl))
        {
            var bad = req.CreateResponse(HttpStatusCode.InternalServerError);
            await bad.WriteAsJsonAsync(new
            {
                ok = false,
                error = "SQL_PING_LOGICAPP_URL is not set"
            });
            return bad;
        }

        var client = _httpClientFactory.CreateClient();

        HttpResponseMessage laResp;
        try
        {
            laResp = await client.PostAsJsonAsync(logicAppUrl, new { });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Logic App call failed");
            var bad = req.CreateResponse(HttpStatusCode.BadGateway);
            await bad.WriteAsJsonAsync(new { ok = false, error = ex.Message });
            return bad;
        }

        var content = await laResp.Content.ReadAsStringAsync();

        var resp = req.CreateResponse(laResp.IsSuccessStatusCode ? HttpStatusCode.OK : HttpStatusCode.BadGateway);
        resp.Headers.Add("Content-Type", "application/json");

        await resp.WriteStringAsync(content);
        return resp;
    }
}
