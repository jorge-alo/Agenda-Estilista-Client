import { getAdminTabLabel, getAdminTabs } from "../adminTabs";
import type { AdminTab, BusinessType } from "../types/adminPage.types";

interface Props {
  businessType: BusinessType;
  tabActiva: AdminTab;
  setTabActiva: (tab: AdminTab) => void;
}

export const AdminTabs = ({
  businessType,
  tabActiva,
  setTabActiva,
}: Props) => {
  const tabs = getAdminTabs(businessType);

  return (
    <nav className="admin-tabs" aria-label="Secciones del panel">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`admin-tab ${tabActiva === tab ? "active" : ""}`}
          aria-current={tabActiva === tab ? "page" : undefined}
          onClick={() => setTabActiva(tab)}
        >
          {getAdminTabLabel(tab)}
        </button>
      ))}
    </nav>
  );
};
