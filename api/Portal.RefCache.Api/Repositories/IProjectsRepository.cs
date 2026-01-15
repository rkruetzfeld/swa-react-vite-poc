using Portal.RefCache.Api.Models;

namespace Portal.RefCache.Api.Repositories;

public interface IProjectsRepository
{
    Task<IReadOnlyList<ProjectDto>> ListAsync(CancellationToken ct);
    Task UpsertAsync(ProjectDto project, CancellationToken ct);
}
