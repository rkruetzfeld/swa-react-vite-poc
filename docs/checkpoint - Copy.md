CHECKPOINT — Projects Sync + Functions CI/CD (2026-01-23)
✅ Working State

Repo: rkruetzfeld/swa-react-vite-poc

Branch: main

Resource Group: rg-swa-react-vite-poc

Azure Function App: pegportal-api-func-cc-001 (Canada Central)

Logic App (Projects Sync): la-pegportal-projects-sync-cc (Consumption, Canada Central)

✅ APIs

POST /sync/projects

Calls Logic App

Logic App executes stored procedure

Cosmos DB upsert succeeds

Example result: upserted: 64

GET /projects

Returns project list successfully

Root cause of earlier failure fixed (invalid JsonElement.Clone() lifecycle issue)

🔧 Key Fixes (Important)

Logic App Authorization

Function must use full callback URL:

.../invoke?api-version=2016-10-01&sp=...&sv=1.0&sig=...


Missing sig caused 401 Unauthorized

Setting this via Function App → Configuration (UI) is acceptable and correct

Cosmos Read Bug

Error:
System.InvalidOperationException: Operation is not valid due to the current state of the object

Cause: cloning JsonElement backed by disposed internal document

Resolution: materialize safely (strongly typed / page-scoped shaping)

Confirmed fixed

🚀 GitHub Actions — Function Deploy

Workflow: .github/workflows/function-pegportal-cc001.yml

Trigger: push to main when:

api/Portal.RefCache.Api/** changes

Build/Publish: succeeds

Deploy failure cause: invalid validation step

❌ What was wrong
test -d api_publish/bin


.NET 8 isolated publish does NOT create /bin

This caused false failures after successful publish

✅ Correct validation

Validate presence of:

api_publish/host.json

api_publish/worker.config.json

api_publish/functions.metadata

api_publish/Portal_RefCache_Api.dll

📌 Current Status

Application logic: working

Logic App integration: working

Manual deploys: working