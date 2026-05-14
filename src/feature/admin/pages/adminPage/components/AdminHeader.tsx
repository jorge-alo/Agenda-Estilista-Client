interface Props {
  localNombre: string;
  onLogout: () => void;
}

export const AdminHeader =
({
  localNombre,
  onLogout,
}: Props) => {

  return (

    <div className="admin-header">

      <div>

        <span className="admin-header-title">
          {localNombre.toUpperCase()}
        </span>

        <div className="admin-subtitle">
          Panel Admin
        </div>

      </div>

      <button
        className="admin-logout"
        onClick={onLogout}
      >
        Cerrar sesión
      </button>

    </div>
  );
};