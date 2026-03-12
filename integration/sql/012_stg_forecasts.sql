/* =========================================================
   012_stg_forecasts.sql
   Staging table: Forecasts
   Target: PMweb SQL environment
   ========================================================= */

IF OBJECT_ID('dbo.stg_Forecasts', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.stg_Forecasts
    (
        StgId             BIGINT IDENTITY(1,1) PRIMARY KEY,
        BatchId           UNIQUEIDENTIFIER NOT NULL,
        LoadedAt          DATETIME2(3) NOT NULL CONSTRAINT DF_stg_Forecasts_LoadedAt DEFAULT SYSUTCDATETIME(),

        TenantId          NVARCHAR(64) NOT NULL,
        SourceSystem      NVARCHAR(32) NOT NULL CONSTRAINT DF_stg_Forecasts_SourceSystem DEFAULT N'PMweb',
        SourceKey         NVARCHAR(128) NOT NULL,
        SourceUpdatedAt   DATETIME2(3) NULL,

        ProjectSourceKey  NVARCHAR(128) NULL,
        ForecastPeriod    NVARCHAR(20) NULL,        -- e.g. '2026-03'
        ForecastAmount    DECIMAL(18,2) NULL,
        Scenario          NVARCHAR(100) NULL,
        Status            NVARCHAR(50) NULL,

        IsDeleted         BIT NOT NULL CONSTRAINT DF_stg_Forecasts_IsDeleted DEFAULT(0)
    );

    CREATE INDEX IX_stg_Forecasts_Batch ON dbo.stg_Forecasts (BatchId);
    CREATE INDEX IX_stg_Forecasts_TenantKey ON dbo.stg_Forecasts (TenantId, SourceKey);
    CREATE INDEX IX_stg_Forecasts_Project ON dbo.stg_Forecasts (TenantId, ProjectSourceKey);
END;
GO
