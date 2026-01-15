namespace Portal.RefCache.Api.Models;

public sealed class EstimateQuery
{
    public string? ProjectId { get; init; }
    public string? Status { get; init; }

    public DateTimeOffset? UpdatedFromUtc { get; init; }
    public DateTimeOffset? UpdatedToUtc { get; init; }

    // NEW: simple search against Name (PoC)
    public string? Q { get; init; }

    public int Top { get; init; } = 50;
    public string? Cursor { get; init; }

    public bool IncludeDiagnostics { get; init; } = false;

    // NEW: optional total count (PoC – reserved for later)
    public bool IncludeTotal { get; init; } = false;
}
