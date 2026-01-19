using System.Net;
using Microsoft.Azure.Functions.Worker.Http;

namespace Portal.RefCache.Api.Auth;

public static class RequestAuth
{
    private const string ClientPrincipalHeader = "x-ms-client-principal";
    private const string IdTokenHeader = "x-ms-token-aad-id-token";
    private const string DevTenantHeader = "x-dev-tenant";

    public static AuthContext? TryGetAuthContext(HttpRequestData req)
    {
        // 1) Preferred: EasyAuth/SWA style principal header (base64 JSON)
        req.Headers.TryGetValues(ClientPrincipalHeader, out var principalValues);
        var principal = ClientPrincipal.TryParseFromHeader(principalValues?.FirstOrDefault());

        string? tenantId = null;
        string? userId = null;
        string? userDetails = null;
        var roles = new List<string>();

        if (principal is not null)
        {
            tenantId = principal.GetClaim("tid");
            userId = principal.UserId;
            userDetails = principal.UserDetails;
            roles.AddRange(principal.UserRoles);
        }
        else
        {
            // 2) Fallback: EasyAuth can also provide validated tokens via headers
            req.Headers.TryGetValues(IdTokenHeader, out var idTokenValues);
            var jwt = idTokenValues?.FirstOrDefault();
            var claims = JwtClaims.TryReadPayload(jwt);
            if (claims is null)
            {
                // 3) Local dev bypass (opt-in)
                var allowDev = string.Equals(
                    Environment.GetEnvironmentVariable("ALLOW_DEV_AUTH"),
                    "true",
                    StringComparison.OrdinalIgnoreCase);

                if (!allowDev) return null;

                tenantId = Environment.GetEnvironmentVariable("DEV_TENANT_ID") ?? "dev";
                userId = "dev";
                userDetails = Environment.GetEnvironmentVariable("DEV_USER") ?? "dev@local";
                roles.Add("authenticated");
                roles.Add("Estimate.Admin");
            }
            else
            {
                tenantId = JwtClaims.GetString(claims, "tid");
                userId = JwtClaims.GetString(claims, "oid") ?? JwtClaims.GetString(claims, "sub");
                userDetails = JwtClaims.GetString(claims, "preferred_username") ?? JwtClaims.GetString(claims, "upn") ?? JwtClaims.GetString(claims, "name");
                roles.Add("authenticated");
                roles.AddRange(JwtClaims.GetStringArray(claims, "roles"));
            }
        }

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

        if (string.IsNullOrWhiteSpace(tenantId)) tenantId = "unknown";
        if (string.IsNullOrWhiteSpace(userId)) userId = "unknown";
        if (string.IsNullOrWhiteSpace(userDetails)) userDetails = "unknown";

        // Optional tenant allow-list guardrail (comma-separated)
        var allowedTenants = (Environment.GetEnvironmentVariable("ALLOWED_TENANT_IDS") ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (allowedTenants.Length > 0 && !allowedTenants.Any(t => string.Equals(t, tenantId, StringComparison.OrdinalIgnoreCase)))
        {
            // Use a sentinel role so callers can return Forbidden without extra parsing.
            roles.Clear();
            roles.Add("tenant_not_allowed");
        }

        return new AuthContext(
            TenantId: tenantId,
            UserId: userId,
            UserDetails: userDetails,
            Roles: roles.Distinct(StringComparer.OrdinalIgnoreCase).ToArray());
    }

    public static bool HasAnyRole(AuthContext auth, params string[] allowed)
    {
        // Guardrail: tenant allow-list failed
        if (auth.Roles.Any(r => string.Equals(r, "tenant_not_allowed", StringComparison.OrdinalIgnoreCase)))
            return false;

        return allowed.Any(r => auth.Roles.Any(ur => string.Equals(ur, r, StringComparison.OrdinalIgnoreCase)));
    }

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
