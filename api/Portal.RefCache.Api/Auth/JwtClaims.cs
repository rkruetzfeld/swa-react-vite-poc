using System.Text;
using System.Text.Json;

namespace Portal.RefCache.Api.Auth;

/// <summary>
/// Minimal JWT payload reader (no signature validation).
/// Safe to use only when App Service Authentication (EasyAuth) has already validated the token.
/// </summary>
public static class JwtClaims
{
    public static IReadOnlyDictionary<string, JsonElement>? TryReadPayload(string? jwt)
    {
        if (string.IsNullOrWhiteSpace(jwt)) return null;

        // header.payload.signature
        var parts = jwt.Split('.');
        if (parts.Length < 2) return null;

        try
        {
            var payloadBytes = Base64UrlDecode(parts[1]);
            var doc = JsonDocument.Parse(payloadBytes);
            return doc.RootElement.EnumerateObject().ToDictionary(p => p.Name, p => p.Value);
        }
        catch
        {
            return null;
        }
    }

    public static string? GetString(IReadOnlyDictionary<string, JsonElement> claims, string name)
    {
        if (!claims.TryGetValue(name, out var v)) return null;
        if (v.ValueKind == JsonValueKind.String) return v.GetString();
        return v.ToString();
    }

    public static IEnumerable<string> GetStringArray(IReadOnlyDictionary<string, JsonElement> claims, string name)
    {
        if (!claims.TryGetValue(name, out var v)) return Enumerable.Empty<string>();

        if (v.ValueKind == JsonValueKind.Array)
        {
            return v.EnumerateArray()
                .Select(x => x.ValueKind == JsonValueKind.String ? x.GetString() : x.ToString())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x!)
                .ToArray();
        }

        var single = v.ValueKind == JsonValueKind.String ? v.GetString() : v.ToString();
        return string.IsNullOrWhiteSpace(single) ? Enumerable.Empty<string>() : new[] { single! };
    }

    private static byte[] Base64UrlDecode(string base64Url)
    {
        var s = base64Url.Replace('-', '+').Replace('_', '/');
        switch (s.Length % 4)
        {
            case 2: s += "=="; break;
            case 3: s += "="; break;
        }
        return Convert.FromBase64String(s);
    }
}
