/* =========================================================
   030_usp_merge_projects.sql
   Stored procedure: merge staged Projects into integration Projects table
   Target: PMweb SQL environment
   ========================================================= */

CREATE OR ALTER PROCEDURE dbo.usp_MergeProjects
    @TenantId NVARCHAR(64),
    @BatchId UNIQUEIDENTIFIER,
    @UpdatedBy NVARCHAR(128) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH Dedup AS
    (
        SELECT
            s.*,
            ROW_NUMBER() OVER (
                PARTITION BY s.TenantId, s.SourceKey
                ORDER BY ISNULL(s.SourceUpdatedAt, '1900-01-01') DESC, s.StgId DESC
            ) AS rn
        FROM dbo.stg_Projects s
        WHERE s.TenantId = @TenantId
          AND s.BatchId = @BatchId
    )
    MERGE dbo.int_Projects AS tgt
    USING (SELECT * FROM Dedup WHERE rn = 1) AS src
        ON tgt.TenantId = src.TenantId
       AND tgt.SourceKey = src.SourceKey
    WHEN MATCHED THEN
        UPDATE SET
            tgt.SourceUpdatedAt = src.SourceUpdatedAt,
            tgt.ProjectNumber   = src.ProjectNumber,
            tgt.ProjectName     = src.ProjectName,
            tgt.Status          = src.Status,
            tgt.StartDate       = src.StartDate,
            tgt.EndDate         = src.EndDate,
            tgt.Currency        = src.Currency,
            tgt.ProjectManager  = src.ProjectManager,
            tgt.IsDeleted       = src.IsDeleted,
            tgt.UpdatedAt       = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (TenantId, SourceKey, SourceUpdatedAt, ProjectNumber, ProjectName, Status, StartDate, EndDate, Currency, ProjectManager, IsDeleted)
        VALUES (src.TenantId, src.SourceKey, src.SourceUpdatedAt, src.ProjectNumber, src.ProjectName, src.Status, src.StartDate, src.EndDate, src.Currency, src.ProjectManager, src.IsDeleted);

    -- Update watermark to the max SourceUpdatedAt in the batch (fallback to now)
    DECLARE @MaxSourceUpdatedAt DATETIME2(3) =
        (SELECT MAX(SourceUpdatedAt) FROM dbo.stg_Projects WHERE TenantId = @TenantId AND BatchId = @BatchId);

    SET @MaxSourceUpdatedAt = ISNULL(@MaxSourceUpdatedAt, SYSUTCDATETIME());

    MERGE dbo.etl_Watermark AS w
    USING (SELECT @TenantId AS TenantId, N'Projects' AS EntityName) AS s
        ON w.TenantId = s.TenantId AND w.EntityName = s.EntityName
    WHEN MATCHED THEN
        UPDATE SET LastProcessedAt = @MaxSourceUpdatedAt, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @UpdatedBy
    WHEN NOT MATCHED THEN
        INSERT (TenantId, EntityName, LastProcessedAt, UpdatedBy)
        VALUES (@TenantId, N'Projects', @MaxSourceUpdatedAt, @UpdatedBy);
END;
GO
