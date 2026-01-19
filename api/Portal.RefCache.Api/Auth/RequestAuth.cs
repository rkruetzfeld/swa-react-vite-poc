using System.Net;
using Microsoft.Azure.Functions.Worker.Http;

namespace Portal.RefCache.Api.Auth;

public static class RequestAuth
{
    private const string ClientPrincipalHeader = "x-ms-client-principal";
    private const string DevTenantHeader = "x-dev-tenant";

    public static AuthContext? TryGetAuthContext(HttpRequestData req)
    {
        req.Headers.TryGetValues(ClientPrincipalHeader, out var principalValues);
        var principal = ClientPrincipal.TryParseFromHeader(principalValues?.FirstOrDefault());
        if (principal is null) return null;

        var tenantId = principal.GetClaim("tid");

        var allowDevTenant = string.Equals(
            Environment.GetEnvironmentVariable("ALLOW_DEV_TENANT_HEADER"),
            "true",
            StringComparison.OrdinalIgnoreCase);

        if (allowDevTenant)
        {
            req.Headers.TryGetValues(DevTenantHeader, out var devTenant);
            var v = devTenant?.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(v))
                tenantId = v;
        }

        if (string.IsNullOrWhiteSpace(tenantId))
            tenantId = "unknown";

        return new AuthContext(
            TenantId: tenantId,
            UserId: principal.UserId ?? "unknown",
            UserDetails: principal.UserDetails ?? "unknown",
            Roles: principal.UserRoles.ToArray());
    }

    public static bool HasAnyRole(AuthContext auth, params string[] allowed)
        => allowed.Any(r => auth.Roles.Any(ur => string.Equals(ur, r, StringComparison.OrdinalIgnoreCase)));

    public static async Task<HttpResponseData> Unauthorized(HttpRequestData req)
    {
        var res = req.CreateResponse(HttpStatusCode.Unauthorized);
        await res.WriteStringAsync("Unauthorized.");
        return res;
    }

    public static async Task<HttpResponseData> Forbidden(HttpRequestData req)
    {
        var res = req.CreateResponse(HttpStatusCode.Forbidden);
        await res.WriteStringAsync("Forbidden.");
        return res;
    }
}

public sealed record AuthContext(
    string TenantId,
    string UserId,
    string UserDetails,
    IReadOnlyCollection<string> Roles);
