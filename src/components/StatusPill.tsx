type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";
type StatusVariant = "default" | "grid";

export default function StatusPill(props: {
  label: string;
  tone?: StatusTone;
  variant?: StatusVariant;
}) {
  const tone = props.tone ?? "neutral";
  const variant = props.variant ?? "default";

  return (
    <span
      className={`statusPill statusPill--${tone} statusPill--${variant}`}
      title={props.label}
    >
      {props.label}
    </span>
  );
}
