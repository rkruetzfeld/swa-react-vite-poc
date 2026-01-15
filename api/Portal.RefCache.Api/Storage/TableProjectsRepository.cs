using Azure;
using Azure.Data.Tables;
using Portal.RefCache.Api.Mapping;
using Portal.RefCache.Api.Models;
using Portal.RefCache.Api.Repositories;

namespace Portal.RefCache.Api.Storage;

public sealed class TableProjectsRepository : IProjectsRepository
{
    private const string ProjectPartition = "PROJECT";
    private readonly TableClient _projectsTable;

    // PoC: ensure table exists once per process
    private bool _ensured;
    private readonly SemaphoreSlim _ensureLock = new(1, 1);

    public TableProjectsRepository(TableClient projectsTable)
    {
        _projectsTable = projectsTable;
    }

    public async Task<IReadOnlyList<ProjectDto>> ListAsync(CancellationToken ct)
    {
        await EnsureTableAsync(ct);

        var filter = $"PartitionKey eq '{ProjectPartition}'";
        var results = new List<ProjectDto>();

        await foreach (var e in _projectsTable.QueryAsync<ProjectEntity>(filter: filter, cancellationToken: ct))
        {
            results.Add(ProjectMapper.ToDto(e));
        }

        results.Sort((a, b) => string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase));
        return results;
    }

    public async Task UpsertAsync(ProjectDto project, CancellationToken ct)
    {
        await EnsureTableAsync(ct);

        var entity = new ProjectEntity
        {
            PartitionKey = ProjectPartition,
            RowKey = project.ProjectId,
            ProjectId = project.ProjectId,
            Name = project.Name,
            UpdatedUtc = project.UpdatedUtc
        };

        await _projectsTable.UpsertEntityAsync(entity, TableUpdateMode.Merge, ct);
    }

    private async Task EnsureTableAsync(CancellationToken ct)
    {
        if (_ensured) return;

        await _ensureLock.WaitAsync(ct);
        try
        {
            if (_ensured) return;

            await _projectsTable.CreateIfNotExistsAsync(ct);
            _ensured = true;
        }
        catch (RequestFailedException)
        {
            // Let the caller fail naturally if storage is unavailable
            throw;
        }
        finally
        {
            _ensureLock.Release();
        }
    }
}
