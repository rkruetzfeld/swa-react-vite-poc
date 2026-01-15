namespace Portal.RefCache.Api.Models;

public sealed class ProjectDto
{
    public required string ProjectId { get; init; }
    public required string Name { get; init; }
    public required DateTimeOffset UpdatedUtc { get; init; }
}
