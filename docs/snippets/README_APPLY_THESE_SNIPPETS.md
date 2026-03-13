# Pinned sections (how to apply)

## Where to paste

- Paste `ARCHITECTURE_PINNED_AZURE_TOPOLOGY.md` into `docs/ARCHITECTURE.md` under a heading like **Azure Deployment Topology**.
- Paste `INTEGRATION_PINNED_WORKFLOWS.md` into `docs/INTEGRATION.md` under a heading like **Integration Workflows**.
- Paste `RELEASE_PINNED_BRANCHING.md` into `docs/ARCHITECTURE.md` or `docs/RELEASE_PROCESS.md`.

## Suggested commit

After pasting into your repo files:

```powershell
git add docs/ARCHITECTURE.md docs/INTEGRATION.md docs/RELEASE_PROCESS.md 2>$null
# or just stage all changed docs
git add docs

git commit -m "Add pinned Azure topology and integration workflow sections"
```

Then push to your dev branch (`main`) and promote to `stable` via PR.

