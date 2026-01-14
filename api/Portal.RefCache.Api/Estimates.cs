using System.Net;
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
    public HttpResponseData Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "estimates")] HttpRequestData req)
    {
        _logger.LogInformation("GET /api/estimates");

        var res = req.CreateResponse(HttpStatusCode.OK);
        res.Headers.Add("Content-Type", "application/json");
        res.WriteString("[]");
        return res;
    }
}
