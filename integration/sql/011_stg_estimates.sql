/* =========================================================
   011_stg_estimates.sql
   Staging table: Estimates
   Target: PMweb SQL environment
   ========================================================= */

IF OBJECT_ID('dbo.stg_Estimates', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.stg_Estimates
    (
        StgId             BIGINT IDENTITY(1,1) PRIMARY KEY,
        BatchId           UNIQUEIDENTIFIER NOT NULL,
        LoadedAt          DATETIME2(3) NOT NULL CONSTRAINT DF_stg_Estimates_LoadedAt DEFAULT SYSUTCDATETIME(),

        TenantId          NVARCHAR(64) NOT NULL,
        SourceSystem      NVARCHAR(32) NOT NULL CONSTRAINT DF_stg_Estimates_SourceSystem DEFAULT N'PMweb',
        SourceKey         NVARCHAR(128) NOT NULL,
        SourceUpdatedAt   DATETIME2(3) NULL,

        ProjectSourceKey  NVARCHAR(128) NULL,  -- links to project by PMweb key
        EstimateNumber    NVARCHAR(50) NULL,
        EstimateDate      DATE NULL,
        EstimateAmount    DECIMAL(18,2) NULL,
        Status            NVARCHAR(50) NULL,
        Version           INT NULL,

        IsDeleted         BIT NOT NULL CONSTRAINT DF_stg_Estimates_IsDeleted DEFAULT(0)
    );

    CREATE INDEX IX_stg_Estimates_Batch ON dbo.stg_Estimates (BatchId);
    CREATE INDEX IX_stg_Estimates_TenantKey ON dbo.stg_Estimates (TenantId, SourceKey);
    CREATE INDEX IX_stg_Estimates_Project ON dbo.stg_Estimates (TenantId, ProjectSourceKey);
END;
GO
