import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthHeaders } from "../auth/auth.helpers";
import { LocalesLista } from "./components/LocalesLista";
import { CrearLocalModal } from "./components/CrearLocalModal";
import "./SuperAdminPage.css";

const API_URL = import.meta.env.VITE_API_URL;

export const SuperAdminPage = () => {
  const [locales, setLocales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const navigate = useNavigate();

  const cargarLocales = async () => {
    try {
      const res = await fetch(`${API_URL}/api/superadmin/locales`, {
        headers: getAuthHeaders(),
      });
      if (res.status === 401 || res.status === 403) {
        navigate("/login");
        return;
      }
      const data = await res.json();
      setLocales(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando locales:", error);
      setLocales([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarLocales();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div>
      {modalAbierto && (
        <CrearLocalModal
          onClose={() => setModalAbierto(false)}
          onSuccess={cargarLocales}
        />
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

        {loading ? (
          <p className="sa-empty">Cargando...</p>
        ) : (
          <LocalesLista
            locales={locales}
            onRefresh={cargarLocales}
          />
        )}
      </div>
    </div>
  );
};