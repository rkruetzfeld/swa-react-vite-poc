using Portal.RefCache.Api.Models;
using Portal.RefCache.Api.Storage;

namespace Portal.RefCache.Api.Mapping;

public static class EstimateMapper
{
    public static EstimateDto ToDto(EstimateEntity e) => new()
    {
        EstimateId = e.EstimateId,
        ProjectId = e.ProjectId,
        Name = e.Name,
        Status = e.Status,
        CreatedUtc = e.CreatedUtc,
        UpdatedUtc = e.UpdatedUtc,
        Amount = e.Amount,
        Currency = e.Currency
    };
}
