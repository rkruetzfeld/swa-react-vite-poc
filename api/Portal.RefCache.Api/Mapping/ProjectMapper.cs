using Portal.RefCache.Api.Models;
using Portal.RefCache.Api.Storage;

namespace Portal.RefCache.Api.Mapping;

public static class ProjectMapper
{
    public static ProjectDto ToDto(ProjectEntity e) => new()
    {
        ProjectId = e.ProjectId,
        Name = e.Name,
        UpdatedUtc = e.UpdatedUtc
    };
}
