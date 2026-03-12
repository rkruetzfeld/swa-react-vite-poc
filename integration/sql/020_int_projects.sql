/* =========================================================
   020_int_projects.sql
   Integration handoff table: Projects (merged, clean)
   Target: PMweb SQL environment
   ========================================================= */

IF OBJECT_ID('dbo.int_Projects', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.int_Projects
    (
        TenantId         NVARCHAR(64) NOT NULL,
        SourceKey        NVARCHAR(128) NOT NULL,
        SourceUpdatedAt  DATETIME2(3) NULL,

        ProjectNumber    NVARCHAR(50) NULL,
        ProjectName      NVARCHAR(200) NULL,
        Status           NVARCHAR(50) NULL,
        StartDate        DATE NULL,
        EndDate          DATE NULL,
        Currency         NVARCHAR(10) NULL,
        ProjectManager   NVARCHAR(200) NULL,

        IsDeleted        BIT NOT NULL CONSTRAINT DF_int_Projects_IsDeleted DEFAULT(0),
        UpdatedAt        DATETIME2(3) NOT NULL CONSTRAINT DF_int_Projects_UpdatedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_int_Projects PRIMARY KEY (TenantId, SourceKey)
    );
END;
GO
