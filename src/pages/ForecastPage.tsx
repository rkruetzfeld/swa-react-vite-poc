export default function ForecastPage() {
  return (
    <div className="page">
      <h2>Forecast</h2>
      <p>Forward-looking view of cost and delivery projections.</p>

      {/* Filters */}
      <div className="cardRow">
        <div className="card small">Client: All</div>
        <div className="card small">Program: FY25</div>
        <div className="card small">Status: Active</div>
      </div>

      {/* Summary */}
      <div className="cardRow">
        <div className="card">
          <h4>Forecast Total</h4>
          <div className="kpi">$46.1M</div>
        </div>
        <div className="card">
          <h4>Variance to Approved</h4>
          <div className="kpi warn">+8.2%</div>
        </div>
        <div className="card">
          <h4>Confidence</h4>
          <div className="kpi">Medium</div>
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <h4>Forecast Over Time</h4>
        <div className="placeholder">
          Time series / burn-up chart placeholder
        </div>
      </div>

      {/* Risk notes */}
      <div className="card">
        <h4>Key Risks & Assumptions</h4>
        <div className="placeholder">
          • Escalation on concrete rates<br />
          • Pending scope clarification<br />
          • Labour availability Q3
        </div>
      </div>
    </div>
  );
}
