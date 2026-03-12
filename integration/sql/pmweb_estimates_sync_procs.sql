/*
  PMWeb Demo database – Portal Sync stored procedures

  Purpose
  -------
  These stored procedures are designed to feed the Logic App + Azure Function sync pipeline.
  They return rowsets shaped for Cosmos upsert into the single "Portal" container.

  Notes
  -----
  - Both procs support an optional @SinceUtc parameter for incremental pulls.
  - EstimateDetails has no UpdatedDate; we drive incremental selection based on the
    parent Estimates.UpdatedDate (common pattern for header/line models).
  - If you find that line-level changes do NOT update Estimates.UpdatedDate in your
    PMWeb schema, we should add a separate change-tracking mechanism (trigger, rowversion,
    or audit table) and adjust this logic.
*/

SET NOCOUNT ON;
GO

/* -------------------------------------------------------------------------
   dbo.PEG_PortalSync_GetEstimates
   ------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.PEG_PortalSync_GetEstimates', 'P') IS NOT NULL
    DROP PROCEDURE dbo.PEG_PortalSync_GetEstimates;
GO

CREATE PROCEDURE dbo.PEG_PortalSync_GetEstimates
    @SinceUtc        DATETIME2(7) = NULL,
    @IncludeInactive BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    /*
      The Azure Logic App SQL connector returns values under ResultSets/Table1.
      Keep a single, flat projection.
    */
    SELECT
        CAST(e.[Id] AS NVARCHAR(64))               AS [EstimateId],
        CAST(e.[ProjectId] AS NVARCHAR(64))        AS [ProjectId],
        CAST(e.[RevisionId] AS NVARCHAR(64))       AS [RevisionId],
        e.[RevisionNumber]                         AS [RevisionNumber],
        e.[RevisionDate]                           AS [RevisionDateUtc],
        e.[Description]                            AS [Description],
        CAST(e.[UOMId] AS NVARCHAR(64))            AS [UOMId],
        e.[EstimateUnit]                           AS [EstimateUnit],
        CAST(e.[DocStatusId] AS NVARCHAR(64))      AS [DocStatusId],
        CAST(e.[CurrencyId] AS NVARCHAR(64))       AS [CurrencyId],
        e.[IsActive]                               AS [IsActive],
        CAST(e.[SpecificationGroupId] AS NVARCHAR(64)) AS [SpecificationGroupId],
        CAST(e.[CategoryId] AS NVARCHAR(64))       AS [CategoryId],
        e.[Reference]                              AS [Reference],
        e.[TotalCostValue]                         AS [TotalCostValue],
        e.[TotalExtCostValue]                      AS [TotalExtCostValue],
        /* Use UpdatedDate for incremental tracking; fall back to CreatedDate. */
        COALESCE(e.[UpdatedDate], e.[CreatedDate]) AS [UpdatedUtc]
    FROM [Demo].[dbo].[Estimates] e
    WHERE
        (
            @SinceUtc IS NULL
            OR COALESCE(e.[UpdatedDate], e.[CreatedDate]) >= @SinceUtc
        )
        AND (
            @IncludeInactive = 1
            OR ISNULL(e.[IsActive], 0) = 1
        );
END
GO


/* -------------------------------------------------------------------------
   dbo.PEG_PortalSync_GetEstimateDetails
   ------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.PEG_PortalSync_GetEstimateDetails', 'P') IS NOT NULL
    DROP PROCEDURE dbo.PEG_PortalSync_GetEstimateDetails;
GO

CREATE PROCEDURE dbo.PEG_PortalSync_GetEstimateDetails
    @SinceUtc        DATETIME2(7) = NULL,
    @IncludeInactive BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    /*
      Incremental logic is based on the parent estimate UpdatedUtc.
    */
    SELECT
        CAST(d.[Id] AS NVARCHAR(64))               AS [EstimateDetailId],
        CAST(d.[EstimateId] AS NVARCHAR(64))       AS [EstimateId],
        d.[LineNumber]                             AS [LineNumber],
        d.[AssemblyCode]                           AS [AssemblyCode],
        d.[AssemblyMultiplier]                     AS [AssemblyMultiplier],
        d.[AssemblyIdentifier]                     AS [AssemblyIdentifier],
        CAST(d.[AssemblyPassId] AS NVARCHAR(64))   AS [AssemblyPassId],
        d.[ItemCode]                               AS [ItemCode],
        d.[Description]                            AS [Description],
        CAST(d.[PhaseId] AS NVARCHAR(64))          AS [PhaseId],
        CAST(d.[CostCodeId] AS NVARCHAR(64))       AS [CostCodeId],
        CAST(d.[CostTypeId] AS NVARCHAR(64))       AS [CostTypeId],
        CAST(d.[UOMId] AS NVARCHAR(64))            AS [UOMId],
        d.[Quantity]                               AS [Quantity],
        CAST(d.[CurrencyId] AS NVARCHAR(64))       AS [CurrencyId],
        d.[UnitCost]                               AS [UnitCost],
        d.[ExtendedQuantity]                       AS [ExtendedQuantity],
        d.[TotalCost]                              AS [TotalCost],
        d.[IsSubmittal]                            AS [IsSubmittal],
        CAST(d.[CompanyId] AS NVARCHAR(64))        AS [CompanyId],
        CAST(d.[LocationId] AS NVARCHAR(64))       AS [LocationId],
        d.[Notes1]                                 AS [Notes1],
        CAST(d.[BIMId] AS NVARCHAR(64))            AS [BIMId],
        d.[Imported]                               AS [Imported],
        CAST(d.[BidCategoryId] AS NVARCHAR(64))    AS [BidCategoryId],
        d.[ExtCost]                                AS [ExtCost],
        CAST(d.[DocumentAdjustmentId] AS NVARCHAR(64)) AS [DocumentAdjustmentId],
        d.[Adjustment1]                            AS [Adjustment1],
        d.[Adjustment2]                            AS [Adjustment2],
        d.[Tax]                                    AS [Tax],
        CAST(d.[PeriodId] AS NVARCHAR(64))         AS [PeriodId],
        CAST(d.[TaskId] AS NVARCHAR(64))           AS [TaskId],
        d.[Year]                                   AS [Year],
        CAST(d.[FundingSourceId] AS NVARCHAR(64))  AS [FundingSourceId],
        CAST(d.[ResourceId] AS NVARCHAR(64))       AS [ResourceId],
        d.[ResourceType]                           AS [ResourceType],
        CAST(d.[ManufacturerId] AS NVARCHAR(64))   AS [ManufacturerId],
        d.[ManufacturerNumber]                     AS [ManufacturerNumber],
        CAST(d.[CopiedFromId] AS NVARCHAR(64))     AS [CopiedFromId],
        d.[Field1]                                 AS [Field1],
        d.[Field2]                                 AS [Field2],
        d.[Field3]                                 AS [Field3],
        d.[Field4]                                 AS [Field4],
        d.[Field5]                                 AS [Field5],
        d.[Field6]                                 AS [Field6],
        d.[Field7]                                 AS [Field7],
        d.[Field8]                                 AS [Field8],
        d.[Field9]                                 AS [Field9],
        d.[Field10]                                AS [Field10],
        CAST(d.[WBSId] AS NVARCHAR(64))            AS [WBSId],
        COALESCE(e.[UpdatedDate], e.[CreatedDate]) AS [UpdatedUtc]
    FROM [Demo].[dbo].[EstimateDetails] d
    INNER JOIN [Demo].[dbo].[Estimates] e
        ON e.[Id] = d.[EstimateId]
    WHERE
        (
            @SinceUtc IS NULL
            OR COALESCE(e.[UpdatedDate], e.[CreatedDate]) >= @SinceUtc
        )
        AND (
            @IncludeInactive = 1
            OR ISNULL(e.[IsActive], 0) = 1
        );
END
GO
