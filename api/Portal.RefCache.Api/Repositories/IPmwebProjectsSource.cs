using Portal.RefCache.Api.Models;

namespace Portal.RefCache.Api.Repositories;

public interface IPmwebProjectsSource
{
    Task<IReadOnlyList<ProjectDto>> FetchProjectsAsync(CancellationToken ct);
}
