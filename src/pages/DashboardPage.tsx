export default function DashboardPage() {
  return (
    <div className="page">
      <h2>Dashboard</h2>
      <p>High-level overview of estimates and forecast health.</p>

      {/* KPI row */}
      <div className="cardRow">
        <div className="card">
          <h4>Total Estimates</h4>
          <div className="kpi">128</div>
        </div>
        <div className="card">
          <h4>Approved Value</h4>
          <div className="kpi">$42.6M</div>
        </div>
        <div className="card">
          <h4>At Risk</h4>
          <div className="kpi warn">6</div>
        </div>
        <div className="card">
          <h4>On Time</h4>
          <div className="kpi good">94%</div>
        </div>
      </div>

      {/* Status summary */}
      <div className="card">
        <h4>Status Breakdown</h4>
        <div className="placeholder">
          Chart placeholder (Approved / Submitted / Draft / Completed)
        </div>
      </div>

      {/* Activity */}
      <div className="card">
        <h4>Recent Activity</h4>
        <div className="placeholder">
          • Estimate 24-017 approved<br />
          • Estimate 24-021 submitted<br />
          • Estimate 24-009 revised
        </div>
      </div>
    </div>
  );
}
