using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using Portal.RefCache.Api.Models;
using Portal.RefCache.Api.Repositories;

namespace Portal.RefCache.Api.Storage;

public sealed class HttpPmwebProjectsSource : IPmwebProjectsSource
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<HttpPmwebProjectsSource> _log;

    public HttpPmwebProjectsSource(IHttpClientFactory httpClientFactory, ILogger<HttpPmwebProjectsSource> log)
    {
        _httpClientFactory = httpClientFactory;
        _log = log;
    }

    public async Task<IReadOnlyList<ProjectDto>> FetchProjectsAsync(CancellationToken ct)
    {
        var url = Environment.GetEnvironmentVariable("PMWEB_PROJECTS_URL");
        if (string.IsNullOrWhiteSpace(url))
            throw new InvalidOperationException("PMWEB_PROJECTS_URL is not configured.");

        var client = _httpClientFactory.CreateClient();
        using var resp = await client.GetAsync(url, ct);
        resp.EnsureSuccessStatusCode();

        // Expect either:
        // Expect either:
        // 1) array of { projectId, name, updatedUtc }
        // 2) { items: [...] } wrapper
        // Use System.Text.Json DOM for flexibility
        var raw = await resp.Content.ReadAsStringAsync(ct);
        using var doc = System.Text.Json.JsonDocument.Parse(raw);
        var root = doc.RootElement;

        System.Text.Json.JsonElement arr;
        if (root.ValueKind == System.Text.Json.JsonValueKind.Array)
            arr = root;
        else if (root.TryGetProperty("items", out var itemsEl) && itemsEl.ValueKind == System.Text.Json.JsonValueKind.Array)
            arr = itemsEl;
        else
            throw new InvalidOperationException("PMWEB projects response was not an array or { items: [...] }.");

        var list = new List<ProjectDto>();
        foreach (var el in arr.EnumerateArray())
        {
            var projectId = el.TryGetProperty("projectId", out var pid) ? pid.GetString()
                : el.TryGetProperty("ProjectId", out var pid2) ? pid2.GetString()
                : null;

            if (string.IsNullOrWhiteSpace(projectId)) continue;

            var name = el.TryGetProperty("name", out var nm) ? nm.GetString()
                : el.TryGetProperty("Name", out var nm2) ? nm2.GetString()
                : projectId;

            DateTimeOffset updatedUtc = DateTimeOffset.UtcNow;
            if (el.TryGetProperty("updatedUtc", out var uu) && uu.ValueKind == System.Text.Json.JsonValueKind.String)
                DateTimeOffset.TryParse(uu.GetString(), out updatedUtc);
            else if (el.TryGetProperty("UpdatedUtc", out var uu2) && uu2.ValueKind == System.Text.Json.JsonValueKind.String)
                DateTimeOffset.TryParse(uu2.GetString(), out updatedUtc);

            list.Add(new ProjectDto
            {
                ProjectId = projectId!,
                Name = name ?? projectId!,
                UpdatedUtc = updatedUtc
            });
        }

        _log.LogInformation("Fetched {Count} projects from PMWeb source.", list.Count);
        return list;
    }
}
