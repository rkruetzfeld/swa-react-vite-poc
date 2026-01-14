export default function ReportsPage() {
  return (
    <div className="page">
      <h2>Reports</h2>
      <p>Standardized outputs for review, audit, and distribution.</p>

      <div className="card">
        <h4>Available Reports</h4>

        <div className="reportList">
          <div className="reportItem">
            <strong>Estimate Summary</strong>
            <span>PDF / Excel</span>
          </div>

          <div className="reportItem">
            <strong>Status by Client</strong>
            <span>Excel</span>
          </div>

          <div className="reportItem">
            <strong>Forecast vs Approved</strong>
            <span>PDF</span>
          </div>

          <div className="reportItem">
            <strong>Detailed Line Export</strong>
            <span>CSV</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h4>Scheduled Reports</h4>
        <div className="placeholder">
          Monthly executive pack (auto-email)<br />
          Weekly forecast snapshot
        </div>
      </div>
    </div>
  );
}
