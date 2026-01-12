import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

type Row = {
  id: number;
  name: string;
  qty: number;
};

export default function App() {
  const [rowData, setRowData] = useState<Row[]>([
    { id: 1, name: "Apple", qty: 5 },
    { id: 2, name: "Banana", qty: 3 },
    { id: 3, name: "Orange", qty: 8 },
    { id: 4, name: "Pear", qty: 2 },
    { id: 5, name: "Grape", qty: 12 }
  ]);

  const columnDefs = useMemo(
    () => [
      { field: "id", headerName: "ID", editable: false, width: 100 },
      { field: "name", headerName: "Name", editable: true, flex: 1 },
      { field: "qty", headerName: "Qty", editable: true, width: 140 }
    ],
    []
  );

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
      <h1>AG Grid PoC</h1>
      <p>Edit <b>Name</b> or <b>Qty</b>. Click outside the cell to commit.</p>

      <div className="ag-theme-quartz" style={{ height: 320, marginTop: 12 }}>
        <AgGridReact<Row>
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{ resizable: true, sortable: true }}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          onCellValueChanged={(e) => {
            const updated = [...rowData];
            const idx = updated.findIndex((r) => r.id === e.data.id);
            if (idx >= 0) updated[idx] = e.data;
            setRowData(updated);
          }}
        />
      </div>
    </div>
  );
}
