using System.Net;
using System.Text;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Portal.RefCache.Api;

public class Estimates
{
    private readonly ILogger<Estimates> _logger;

    public Estimates(ILogger<Estimates> logger)
    {
        _logger = logger;
    }

    [Function("estimates")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "estimates")] HttpRequestData req)
    {
        _logger.LogInformation("GET /api/estimates");

        var res = req.CreateResponse(HttpStatusCode.OK);
        res.Headers.Add("Content-Type", "application/json; charset=utf-8");

        // Avoid WriteString() (sync IO). Write to the body stream asynchronously.
        var payload = "[]";
        var bytes = Encoding.UTF8.GetBytes(payload);
        await res.Body.WriteAsync(bytes, 0, bytes.Length);

        return res;
    }
}
