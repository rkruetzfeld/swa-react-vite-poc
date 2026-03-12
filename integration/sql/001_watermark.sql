/* =========================================================
   001_watermark.sql
   Watermark table: tracks incremental processing per entity+tenant
   Target: PMweb SQL environment
   ========================================================= */

IF OBJECT_ID('dbo.etl_Watermark', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.etl_Watermark
    (
        WatermarkId        INT IDENTITY(1,1) PRIMARY KEY,
        TenantId           NVARCHAR(64) NOT NULL,
        EntityName         NVARCHAR(64) NOT NULL,   -- 'Projects'|'Estimates'|'Forecasts'
        LastProcessedAt    DATETIME2(3) NOT NULL,
        UpdatedAt          DATETIME2(3) NOT NULL CONSTRAINT DF_etl_Watermark_UpdatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedBy          NVARCHAR(128) NULL,
        CONSTRAINT UQ_etl_Watermark UNIQUE (TenantId, EntityName)
    );
END;
GO
