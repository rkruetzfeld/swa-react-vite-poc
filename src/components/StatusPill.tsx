// src/components/StatusPill.tsx
import type { Status } from "../services/estimateDataService";

function statusColors(s: Status): { bg: string; fg: string } {
  if (s === "Draft") return { bg: "#e0f2fe", fg: "#075985" };
  if (s === "Submitted") return { bg: "#fef3c7", fg: "#92400e" };
  if (s === "Approved") return { bg: "#dcfce7", fg: "#166534" };
  return { bg: "#e5e7eb", fg: "#111827" };
}

export function StatusPill(props: { value: Status }) {
  const { bg, fg } = statusColors(props.value);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: 999,
        fontWeight: 900,
        fontSize: 12,
        background: bg,
        color: fg,
        whiteSpace: "nowrap"
      }}
    >
      {props.value}
    </span>
  );
}
