// src/components/Sidebar.tsx
import React from "react";

export type NavId =
  | "dashboard"
  | "reports"
  | "forms.estimates"
  | "forms.forecast";

type Props = {
  active: NavId;
  pinned: NavId[];
  onNavigate: (id: NavId) => void;
  onTogglePin: (id: NavId) => void;
};

type NavItem = {
  id: NavId;
  label: string;
  icon?: string;
  group: "top" | "forms";
};

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "📊", group: "top" },
  { id: "forms.estimates", label: "Estimates", icon: "🧾", group: "forms" },
  { id: "forms.forecast", label: "Forecast", icon: "📈", group: "forms" },
  { id: "reports", label: "Reports", icon: "🗂️", group: "top" },
];

function labelFor(id: NavId) {
  return NAV.find((x) => x.id === id)?.label ?? id;
}

export default function Sidebar({ active, pinned, onNavigate, onTogglePin }: Props) {
  const pinnedSet = new Set(pinned);

  const topItems = NAV.filter((x) => x.group === "top");
  const formItems = NAV.filter((x) => x.group === "forms");

  return (
    <aside className="sb">
      <div className="sbBrand">
        <div className="sbBrandMark" />
        <div className="sbBrandText">
          <div className="sbBrandTitle">Portal</div>
          <div className="sbBrandSub">Ledger / Estimates POC</div>
        </div>
      </div>

      <div className="sbSection">
        <div className="sbSectionTitle">Navigation</div>
        <div className="sbList">
          {topItems.map((item) => (
            <button
              key={item.id}
              className={active === item.id ? "sbItem sbItemActive" : "sbItem"}
              onClick={() => onNavigate(item.id)}
              type="button"
            >
              <span className="sbItemLeft">
                <span className="sbIcon">{item.icon ?? "•"}</span>
                <span className="sbLabel">{item.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="sbSection">
        <div className="sbSectionTitle">Forms</div>
        <div className="sbList">
          {formItems.map((item) => {
            const isPinned = pinnedSet.has(item.id);
            const isActive = active === item.id;

            return (
              <div key={item.id} className={isActive ? "sbRow sbRowActive" : "sbRow"}>
                <button
                  className="sbItem sbItemRow"
                  onClick={() => onNavigate(item.id)}
                  type="button"
                >
                  <span className="sbItemLeft">
                    <span className="sbIcon">{item.icon ?? "•"}</span>
                    <span className="sbLabel">{item.label}</span>
                  </span>
                </button>

                <button
                  className={isPinned ? "sbPin sbPinOn" : "sbPin"}
                  onClick={() => onTogglePin(item.id)}
                  title={isPinned ? "Unpin" : "Pin"}
                  type="button"
                >
                  {isPinned ? "★" : "☆"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {pinned.length > 0 && (
        <div className="sbSection">
          <div className="sbSectionTitle">Pinned</div>
          <div className="sbList">
            {pinned.map((id) => (
              <button
                key={id}
                className={active === id ? "sbItem sbItemActive" : "sbItem"}
                onClick={() => onNavigate(id)}
                type="button"
              >
                <span className="sbItemLeft">
                  <span className="sbIcon">📌</span>
                  <span className="sbLabel">{labelFor(id)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
