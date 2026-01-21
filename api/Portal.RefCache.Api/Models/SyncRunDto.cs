namespace Portal.RefCache.Api.Models;

public sealed class SyncRunDto
{
    public required string Entity { get; init; }            // e.g. "Projects"
    public required string RunId { get; init; }             // guid
    public required DateTimeOffset StartedUtc { get; init; }
    public required DateTimeOffset EndedUtc { get; init; }
    public required long DurationMs { get; init; }
    public required int RecordCount { get; init; }
    public required bool Succeeded { get; init; }
    public string? Error { get; init; }
}
