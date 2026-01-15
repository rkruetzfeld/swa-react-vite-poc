namespace Portal.RefCache.Api.Models;

public sealed class PagedResponse<T>
{
    public required IReadOnlyList<T> Items { get; init; }
    public string? NextCursor { get; init; }
    public int PageSize { get; init; }
    public object? Diagnostics { get; init; }
}
