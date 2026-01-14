import StatusPill from "../components/StatusPill";
import type { Status } from "../models/estimateModels";
import { toneFromEstimateStatus } from "../utils/statusTone"; // or inline it

{
  headerName: "Status",
  field: "status",
  width: 140,
  sortable: true,
  filter: true,
  cellClass: "cellStatusPill",
  cellRenderer: (params: any) => {
    const status = params.value as Status;
    return (
      <StatusPill
        label={status}
        tone={toneFromEstimateStatus(status)}
        variant="grid"
      />
    );
  },
}
