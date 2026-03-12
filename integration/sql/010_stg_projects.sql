/* =========================================================
   010_stg_projects.sql
   Staging table: Projects
   Target: PMweb SQL environment
   ========================================================= */

IF OBJECT_ID('dbo.stg_Projects', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.stg_Projects
    (
        StgId             BIGINT IDENTITY(1,1) PRIMARY KEY,
        BatchId           UNIQUEIDENTIFIER NOT NULL,
        LoadedAt          DATETIME2(3) NOT NULL CONSTRAINT DF_stg_Projects_LoadedAt DEFAULT SYSUTCDATETIME(),

        TenantId          NVARCHAR(64) NOT NULL,
        SourceSystem      NVARCHAR(32) NOT NULL CONSTRAINT DF_stg_Projects_SourceSystem DEFAULT N'PMweb',
        SourceKey         NVARCHAR(128) NOT NULL,
        SourceUpdatedAt   DATETIME2(3) NULL,

        ProjectNumber     NVARCHAR(50) NULL,
        ProjectName       NVARCHAR(200) NULL,
        Status            NVARCHAR(50) NULL,
        StartDate         DATE NULL,
        EndDate           DATE NULL,
        Currency          NVARCHAR(10) NULL,
        ProjectManager    NVARCHAR(200) NULL,

        IsDeleted         BIT NOT NULL CONSTRAINT DF_stg_Projects_IsDeleted DEFAULT(0)
    );

    CREATE INDEX IX_stg_Projects_Batch ON dbo.stg_Projects (BatchId);
    CREATE INDEX IX_stg_Projects_TenantKey ON dbo.stg_Projects (TenantId, SourceKey);
END;
GO
