import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LocalesLista } from "./components/LocalesLista";
import { CrearLocalModal } from "./components/CrearLocalModal";

import "./superAdminPage.css";
import { useLocales } from "./hooks/useLocales";

export const SuperAdminPage = () => {
  const [modalAbierto, setModalAbierto] = useState(false);
  const navigate = useNavigate();
  
  // ✅ React Query reemplaza useEffect + useState + fetch
  const { data: locales = [], isLoading, isError } = useLocales();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  if (isError) {
    // Si falla la autenticación (401/403), el interceptor de fetchWithAuth 
    // debería manejarlo, pero por seguridad:
    localStorage.removeItem("token");
    navigate("/login");
    return null;
  }

  return (
    <div>
      {modalAbierto && (
        <CrearLocalModal onClose={() => setModalAbierto(false)} />
      )}

      <div className="sa-header">
        <div>
          <span className="sa-header-title">SUPERADMIN</span>
          <div className="sa-subtitle">Panel de control</div>
        </div>
        <button className="sa-logout" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>

      <div className="sa-content">
        <div className="sa-top-bar">
          <h2 className="sa-section-title">Locales</h2>
          <button className="sa-btn-crear" onClick={() => setModalAbierto(true)}>
            + Nuevo local
          </button>
        </div>

        {isLoading ? (
          <p className="sa-empty">Cargando locales...</p>
        ) : (
          <LocalesLista locales={locales} />
        )}
      </div>
    </div>
  );
};