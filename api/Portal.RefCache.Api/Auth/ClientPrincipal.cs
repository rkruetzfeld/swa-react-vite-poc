using System.Text;
using System.Text.Json;

namespace Portal.RefCache.Api.Auth;

/// <summary>
/// Azure Static Web Apps / App Service Auth injects an HTTP header
/// "x-ms-client-principal" that contains a base64-encoded JSON payload.
/// This parses only what we need for authorization decisions.
/// </summary>
public sealed class ClientPrincipal
{
    public string? IdentityProvider { get; init; }
    public string? UserId { get; init; }
    public string? UserDetails { get; init; }
    public IEnumerable<string> UserRoles { get; init; } = Array.Empty<string>();
    public IEnumerable<ClientPrincipalClaim> Claims { get; init; } = Array.Empty<ClientPrincipalClaim>();

    public string? GetClaim(string type)
        => Claims.FirstOrDefault(c => string.Equals(c.Typ, type, StringComparison.OrdinalIgnoreCase))?.Val;

    public static ClientPrincipal? TryParseFromHeader(string? headerValue)
    {
        if (string.IsNullOrWhiteSpace(headerValue)) return null;

        try
        {
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(headerValue));
            return JsonSerializer.Deserialize<ClientPrincipal>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch
        {
            return null;
        }
    }
}

public sealed class ClientPrincipalClaim
{
    public string? Typ { get; init; }
    public string? Val { get; init; }
}
