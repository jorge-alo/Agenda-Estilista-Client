const tabs = [
  "dashboard",
  "agenda",
  "reservar",
  "clientes",
  "estilistas",
  "servicios",
  "horarios",
  "bloqueos",
  "configuracion",
  "whatsapp"
];

interface Props {
  tabActiva: string;

  setTabActiva:
    (tab: string) => void;
}

export const AdminTabs =
({
  tabActiva,
  setTabActiva,
}: Props) => {

  return (

    <div className="admin-tabs">

      {tabs.map((tab) => (

        <div
          key={tab}
          className={`admin-tab ${
            tabActiva === tab
              ? "active"
              : ""
          }`}
          onClick={() =>
            setTabActiva(tab)
          }
        >
          {tab}
        </div>

      ))}

    </div>
  );
};