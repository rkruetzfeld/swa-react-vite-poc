/* =========================================================
   README_run_order.sql
   Suggested execution order (run once for DDL, then per batch for merge)
   =========================================================

   One-time setup:
     001_watermark.sql
     010_stg_projects.sql
     011_stg_estimates.sql
     012_stg_forecasts.sql
     020_int_projects.sql
     030_usp_merge_projects.sql

   Per inbound batch (example):
     1) Logic Apps loads into dbo.stg_Projects with a new @BatchId
     2) EXEC dbo.usp_MergeProjects @TenantId = '<tid>', @BatchId = '<guid>', @UpdatedBy = 'logicapp'

   Notes:
   - Add similar int_* tables and usp_Merge* procedures for Estimates and Forecasts once keys/columns are confirmed.
   - This kit is a starter; align names/schema to PMweb constraints and permissions.
   ========================================================= */
