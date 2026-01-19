namespace Portal.RefCache.Api.Domain.Models;

public sealed class BatchUpsertLineItemsRequest
{
    public IList<UpsertLineItem> Items { get; init; } = new List<UpsertLineItem>();
}

public sealed class UpsertLineItem
{
    public string? LineItemId { get; init; }
    public int LineNumber { get; init; }
    public string CostCode { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public string Uom { get; init; } = string.Empty;
    public decimal UnitPrice { get; init; }
    public string? Notes { get; init; }
}
