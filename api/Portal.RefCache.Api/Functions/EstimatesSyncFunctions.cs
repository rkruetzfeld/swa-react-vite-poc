// File: api/Portal.RefCache.Api/Functions/EstimatesSyncFunctions.cs
// Purpose:
//   - POST /sync/estimates : Call Logic Apps to pull Estimates + EstimateDetails from SQL,
//                            then upsert into Cosmos DB (Portal/Estimates)
//   - Timer trigger to run the same sync periodically
//
// Assumptions (aligned to ProjectsSyncFunctions.cs):
//   - .NET 8 isolated Azure Functions
//   - CosmosClient is registered in Program.cs and injected
//   - App settings exist:
//       ESTIMATES_SYNC_URL                 = Logic App callback URL for headers (manual trigger invoke URL)
//       ESTIMATEDETAILS_SYNC_URL            = Logic App callback URL for details (manual trigger invoke URL)
//       PEG_COSMOS_DB                       = Portal
//       PEG_COSMOS_ESTIMATES_CONTAINER      = Estimates
//       PEG_TENANT_ID                       = default

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Azure.Functions.Worker.Extensions.Timer;
using Microsoft.Extensions.Logging;
using Portal.RefCache.Api.Models;

namespace Portal.RefCache.Api.Functions;

public sealed class EstimatesSyncFunctions
{
    private readonly CosmosClient _cosmos;

    public EstimatesSyncFunctions(CosmosClient cosmos)
    {
        _cosmos = cosmos;
    }

    [Function("SyncEstimatesNow")]
    public async Task<HttpResponseData> SyncEstimatesNow(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "sync/estimates")] HttpRequestData req,
        FunctionContext context)
    {
        var log = context.GetLogger("SyncEstimatesNow");

        var body = await req.ReadFromJsonAsync<SyncRequest>() ?? new SyncRequest();

        var sinceUtc = body.SinceUtc;
        var includeInactive = body.IncludeInactive ?? false;
        var projectId = body.ProjectId;

        var startedUtc = DateTime.UtcNow;

        try
        {
            var result = await RunSyncAsync(sinceUtc, includeInactive, projectId, log);
            result.ElapsedMs = (long)(DateTime.UtcNow - startedUtc).TotalMilliseconds;

            var resp = req.CreateResponse(HttpStatusCode.OK);
            await resp.WriteAsJsonAsync(result);
            return resp;
        }
        catch (Exception ex)
        {
            log.LogError(ex,
                "SyncEstimatesNow failed. sinceUtc={SinceUtc} includeInactive={IncludeInactive} projectId={ProjectId}",
                sinceUtc, includeInactive, projectId);

            var resp = req.CreateResponse(HttpStatusCode.BadRequest);
            await resp.WriteAsJsonAsync(new
            {
                ok = false,
                serverUtc = DateTime.UtcNow.ToString("o"),
                message = ex.Message
            });
            return resp;
        }
    }

    [Function("Estimates_Sync_Timer")]
    public async Task EstimatesSyncTimer(
        [TimerTrigger("0 */30 * * * *")] TimerInfo timer,
        FunctionContext context)
    {
        var log = context.GetLogger("Estimates_Sync_Timer");

        // Default: look back 24h, same as your Estimates original intent.
        var sinceUtc = DateTime.UtcNow.AddHours(-24).ToString("o");
        var includeInactive = false;
        int? projectId = null;

        var startedUtc = DateTime.UtcNow;

        try
        {
            var result = await RunSyncAsync(sinceUtc, includeInactive, projectId, log);
            result.ElapsedMs = (long)(DateTime.UtcNow - startedUtc).TotalMilliseconds;

            log.LogInformation(
                "Estimates sync timer complete. ok={Ok} headersUpserted={Headers} detailsUpserted={Details} headersElapsedMs={HeadersElapsedMs} detailsElapsedMs={DetailsElapsedMs} elapsedMs={ElapsedMs}",
                result.Ok, result.HeadersUpserted, result.DetailsUpserted, result.HeadersElapsedMs, result.DetailsElapsedMs, result.ElapsedMs);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Estimates sync timer failed. sinceUtc={SinceUtc} includeInactive={IncludeInactive}", sinceUtc, includeInactive);
        }
    }

    private async Task<SyncResult> RunSyncAsync(string? sinceUtc, bool includeInactive, int? projectId, ILogger log)
    {
        // ---- Config (aligned to Projects naming style)
        var estimatesSyncUrl = Environment.GetEnvironmentVariable("ESTIMATES_SYNC_URL");
        var estimateDetailsSyncUrl = Environment.GetEnvironmentVariable("ESTIMATEDETAILS_SYNC_URL");

        if (string.IsNullOrWhiteSpace(estimatesSyncUrl))
            throw new InvalidOperationException("Missing app setting ESTIMATES_SYNC_URL.");
        if (string.IsNullOrWhiteSpace(estimateDetailsSyncUrl))
            throw new InvalidOperationException("Missing app setting ESTIMATEDETAILS_SYNC_URL.");

        var dbName = Environment.GetEnvironmentVariable("PEG_COSMOS_DB") ?? "Portal";
        var containerName = Environment.GetEnvironmentVariable("PEG_COSMOS_ESTIMATES_CONTAINER") ?? "Estimates";
        var tenantId = Environment.GetEnvironmentVariable("PEG_TENANT_ID") ?? "default";

        var container = _cosmos.GetDatabase(dbName).GetContainer(containerName);

        // Same payload shape your Logic Apps expect
        var payload = new
        {
            sinceUtc,
            includeInactive,
            projectId
        };

        // ---- Call Logic App #1: headers
        using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };

        var headersStartedUtc = DateTime.UtcNow;
        using var headersResp = await http.PostAsJsonAsync(estimatesSyncUrl, payload);
        var headersBody = await headersResp.Content.ReadAsStringAsync();
        if (!headersResp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Estimates Logic App failed: {(int)headersResp.StatusCode} {headersResp.ReasonPhrase}. Body={headersBody}");

        var headersJson = JsonSerializer.Deserialize<JsonElement>(headersBody);
        if (!headersJson.TryGetProperty("results", out var headersArr) || headersArr.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException($"Estimates Logic App response missing results[]. Payload={headersJson}");
        }

        var headersElapsedMs = (long)(DateTime.UtcNow - headersStartedUtc).TotalMilliseconds;

        // Upsert headers
        var headersUpserted = 0;

        foreach (var row in headersArr.EnumerateArray())
        {
            var estimateId = GetAsString(row, "Id");
            if (string.IsNullOrWhiteSpace(estimateId))
                continue;

            var doc = new PmwebEstimateHeaderDoc
            {
                Id = $"pmweb-estimate|{estimateId}",
                TenantId = tenantId,
                DocType = "pmweb-estimate",
                EstimateId = estimateId,
                ProjectId = GetAsString(row, "ProjectId"),
                RevisionId = GetAsString(row, "RevisionId"),
                RevisionNumber = GetAsInt(row, "RevisionNumber"),
                RevisionDate = GetAsDateTimeOffset(row, "RevisionDate"),
                Description = GetAsString(row, "Description"),
                UomId = GetAsString(row, "UOMId"),
                EstimateUnit = GetAsDecimal(row, "EstimateUnit"),
                DocStatusId = GetAsString(row, "DocStatusId"),
                CurrencyId = GetAsString(row, "CurrencyId"),
                IsActive = GetAsBool(row, "IsActive"),
                SpecificationGroupId = GetAsString(row, "SpecificationGroupId"),
                LastRevitUpdateDate = GetAsDateTimeOffset(row, "LastRevitUpdateDate"),
                LastRevitUpdatedBy = GetAsString(row, "LastRevitUpdatedBy"),
                CreatedDate = GetAsDateTimeOffset(row, "CreatedDate"),
                CreatedBy = GetAsString(row, "CreatedBy"),
                UpdatedDate = GetAsDateTimeOffset(row, "UpdatedDate"),
                UpdatedBy = GetAsString(row, "UpdatedBy"),
                CategoryId = GetAsString(row, "CategoryId"),
                Reference = GetAsString(row, "Reference"),
                TotalCostValue = GetAsDecimal(row, "TotalCostValue"),
                TotalExtCostValue = GetAsDecimal(row, "TotalExtCostValue"),
                CheckList_SubmittedById = GetAsString(row, "CheckList_SubmittedById"),
                CheckList_SubmittedDate = GetAsDateTimeOffset(row, "CheckList_SubmittedDate"),
                LastAssemblyPassNumber = GetAsInt(row, "LastAssemblyPassNumber"),
                SpecField1 = GetAsString(row, "SpecField1"),
                SpecField2 = GetAsString(row, "SpecField2"),
                SpecField3 = GetAsString(row, "SpecField3"),
                SpecField4 = GetAsString(row, "SpecField4"),
                SpecField5 = GetAsString(row, "SpecField5"),
                SpecField6 = GetAsString(row, "SpecField6"),
                SpecField7 = GetAsString(row, "SpecField7"),
                SpecField8 = GetAsString(row, "SpecField8"),
                SpecField9 = GetAsString(row, "SpecField9"),
                SpecField10 = GetAsString(row, "SpecField10"),
                Source = row
            };

            await container.UpsertItemAsync(doc, new PartitionKey(tenantId));
            headersUpserted++;
        }

        // ---- Call Logic App #2: details
        var detailsStartedUtc = DateTime.UtcNow;
        using var detailsResp = await http.PostAsJsonAsync(estimateDetailsSyncUrl, payload);
        var detailsBody = await detailsResp.Content.ReadAsStringAsync();
        if (!detailsResp.IsSuccessStatusCode)
            throw new InvalidOperationException($"EstimateDetails Logic App failed: {(int)detailsResp.StatusCode} {detailsResp.ReasonPhrase}. Body={detailsBody}");

        var detailsJson = JsonSerializer.Deserialize<JsonElement>(detailsBody);
        if (!detailsJson.TryGetProperty("results", out var detailsArr) || detailsArr.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException($"EstimateDetails Logic App response missing results[]. Payload={detailsJson}");
        }

        var detailsElapsedMs = (long)(DateTime.UtcNow - detailsStartedUtc).TotalMilliseconds;

        // Upsert details
        var detailsUpserted = 0;

        foreach (var row in detailsArr.EnumerateArray())
        {
            var detailId = GetAsString(row, "Id");
            var estimateId = GetAsString(row, "EstimateId");
            if (string.IsNullOrWhiteSpace(detailId) || string.IsNullOrWhiteSpace(estimateId))
                continue;

            var doc = new PmwebEstimateDetailDoc
            {
                Id = $"pmweb-estimatedetail|{detailId}",
                TenantId = tenantId,
                DocType = "pmweb-estimatedetail",
                DetailId = detailId,
                EstimateId = estimateId,
                LineNumber = GetAsInt(row, "LineNumber"),
                AssemblyCode = GetAsString(row, "AssemblyCode"),
                AssemblyMultiplier = GetAsDecimal(row, "AssemblyMultiplier"),
                AssemblyIdentifier = GetAsString(row, "AssemblyIdentifier"),
                AssemblyPassId = GetAsString(row, "AssemblyPassId"),
                ItemCode = GetAsString(row, "ItemCode"),
                Description = GetAsString(row, "Description"),
                PhaseId = GetAsString(row, "PhaseId"),
                CostCodeId = GetAsString(row, "CostCodeId"),
                CostTypeId = GetAsString(row, "CostTypeId"),
                UomId = GetAsString(row, "UOMId"),
                Quantity = GetAsDecimal(row, "Quantity"),
                CurrencyId = GetAsString(row, "CurrencyId"),
                UnitCost = GetAsDecimal(row, "UnitCost"),
                ExtendedQuantity = GetAsDecimal(row, "ExtendedQuantity"),
                TotalCost = GetAsDecimal(row, "TotalCost"),
                IsSubmittal = GetAsBool(row, "IsSubmittal"),
                CompanyId = GetAsString(row, "CompanyId"),
                LocationId = GetAsString(row, "LocationId"),
                Notes1 = GetAsString(row, "Notes1"),
                BIMId = GetAsString(row, "BIMId"),
                Imported = GetAsBool(row, "Imported"),
                BidCategoryId = GetAsString(row, "BidCategoryId"),
                ExtCost = GetAsDecimal(row, "ExtCost"),
                DocumentAdjustmentId = GetAsString(row, "DocumentAdjustmentId"),
                Adjustment1 = GetAsDecimal(row, "Adjustment1"),
                Adjustment2 = GetAsDecimal(row, "Adjustment2"),
                Tax = GetAsDecimal(row, "Tax"),
                PeriodId = GetAsString(row, "PeriodId"),
                TaskId = GetAsString(row, "TaskId"),
                Year = GetAsInt(row, "Year"),
                FundingSourceId = GetAsString(row, "FundingSourceId"),
                ResourceId = GetAsString(row, "ResourceId"),
                ResourceType = GetAsString(row, "ResourceType"),
                ManufacturerId = GetAsString(row, "ManufacturerId"),
                ManufacturerNumber = GetAsString(row, "ManufacturerNumber"),
                CopiedFromId = GetAsString(row, "CopiedFromId"),
                Field1 = GetAsString(row, "Field1"),
                Field2 = GetAsString(row, "Field2"),
                Field3 = GetAsString(row, "Field3"),
                Field4 = GetAsString(row, "Field4"),
                Field5 = GetAsString(row, "Field5"),
                Field6 = GetAsString(row, "Field6"),
                Field7 = GetAsString(row, "Field7"),
                Field8 = GetAsString(row, "Field8"),
                Field9 = GetAsString(row, "Field9"),
                Field10 = GetAsString(row, "Field10"),
                WbsId = GetAsString(row, "WBSId"),
                Source = row
            };

            await container.UpsertItemAsync(doc, new PartitionKey(tenantId));
            detailsUpserted++;
        }

        log.LogInformation(
            "Estimates sync complete. Upserted headers={HeadersUpserted} details={DetailsUpserted} into {Db}/{Container} for tenant {TenantId}.",
            headersUpserted, detailsUpserted, dbName, containerName, tenantId);

        return new SyncResult
        {
            Ok = true,
            TenantId = tenantId,
            SinceUtc = sinceUtc,
            IncludeInactive = includeInactive,
            ProjectId = projectId,
            HeadersUpserted = headersUpserted,
            DetailsUpserted = detailsUpserted,
            HeadersElapsedMs = headersElapsedMs,
            DetailsElapsedMs = detailsElapsedMs
        };
    }

    private static string? GetAsString(JsonElement row, string prop)
    {
        if (!row.TryGetProperty(prop, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Null) return null;
        if (v.ValueKind == JsonValueKind.String) return v.GetString();
        return v.ToString();
    }

    private static int? GetAsInt(JsonElement row, string prop)
    {
        if (!row.TryGetProperty(prop, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Null) return null;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i)) return i;
        if (v.ValueKind == JsonValueKind.String && int.TryParse(v.GetString(), out var s)) return s;
        return null;
    }

    private static decimal? GetAsDecimal(JsonElement row, string prop)
    {
        if (!row.TryGetProperty(prop, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Null) return null;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d)) return d;
        if (v.ValueKind == JsonValueKind.String && decimal.TryParse(v.GetString(), out var s)) return s;
        return null;
    }

    private static bool? GetAsBool(JsonElement row, string prop)
    {
        if (!row.TryGetProperty(prop, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Null) return null;
        if (v.ValueKind == JsonValueKind.True) return true;
        if (v.ValueKind == JsonValueKind.False) return false;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i)) return i != 0;
        if (v.ValueKind == JsonValueKind.String && bool.TryParse(v.GetString(), out var b)) return b;
        return null;
    }

    private static DateTimeOffset? GetAsDateTimeOffset(JsonElement row, string prop)
    {
        if (!row.TryGetProperty(prop, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Null) return null;
        if (v.ValueKind == JsonValueKind.String && DateTimeOffset.TryParse(v.GetString(), out var dto)) return dto;
        return null;
    }

    private sealed class SyncRequest
    {
        public string? SinceUtc { get; set; }
        public bool? IncludeInactive { get; set; }
        public int? ProjectId { get; set; }
    }

    private sealed class SyncResult
    {
        public bool Ok { get; set; }
        public string? TenantId { get; set; }
        public string? SinceUtc { get; set; }
        public bool IncludeInactive { get; set; }
        public int? ProjectId { get; set; }
        public int HeadersUpserted { get; set; }
        public int DetailsUpserted { get; set; }
        public long HeadersElapsedMs { get; set; }
        public long DetailsElapsedMs { get; set; }
        public long ElapsedMs { get; set; }
    }
}
