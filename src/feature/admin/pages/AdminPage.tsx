import { useEffect, useState } from "react";
import { EstilistasAdmin } from "../components/EstilistasAdmin";
import { HorariosAdmin } from "../components/HorariosAdmin";
import { ServiciosAdmin } from "../components/ServiciosAdmin";
import { AgendaLista } from "../agenda/components/AgendaLista";
import { useNavigate } from "react-router-dom";
import './AdminPage.css'
import { ReservarTurnoAdmin } from "../components/reservaAdmin/ReservarTurnoAdmini";
import { getAuthHeaders } from "../../auth/auth.helpers";
import { WhatsAppStatus } from "../components/whatsappStatus";

const API_URL = import.meta.env.VITE_API_URL;

export const AdminPage = () => {
  const [estilistas, setEstilistas] = useState<any[]>([]);
  const [estilistaId, setEstilistaId] = useState<number | null>(null);
  const [tabActiva, setTabActiva] = useState("agenda");
  const [localNombre, setLocalNombre] = useState("");
  const [localId, setLocalId] = useState<string>("");
  const navigate = useNavigate();
  useEffect(() => {
    fetch(`${API_URL}/api/auth/me`, {
      headers: getAuthHeaders()
    })
      .then(res => {
        if (res.status === 401) {
          navigate("/login");
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data) {
          setLocalNombre(data.nombreLocal);
          setLocalId(String(data.localId));
        }
      })
      .catch(() => {
        navigate("/login");
      });
  }, []);

  const cargarEstilistas = async () => {
    try {
      const res = await fetch(`${API_URL}/api/estilistas/admin`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("token");
          navigate("/login"); // usás navigate en vez de window.location porque ya lo tenés
        }
        setEstilistas([]);
        return;
      }

      const data = await res.json();

      if (Array.isArray(data)) {
        setEstilistas(data);
      } else {
        setEstilistas([]);
      }

    } catch (error) {
      console.log("Error cargando estilistas:", error);
      setEstilistas([]);
    }
  };

  useEffect(() => {
    cargarEstilistas();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };
  return (
    <div>
      <div className="admin-header">
        <div>
          <span className="admin-header-title">
            {localNombre ? localNombre.toUpperCase() : ""}
          </span>
          <div className="admin-subtitle">
            Panel Admin
          </div>
        </div>
        <button className="admin-logout" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>

      <div className="admin-tabs">
        {["agenda", "reservar", "estilistas", "servicios", "horarios", "whatsapp"].map((tab) => (
          <div
            key={tab}
            className={`admin-tab ${tabActiva === tab ? "active" : ""}`}
            onClick={() => setTabActiva(tab)}
          >
            {tab}
          </div>
        ))}
      </div>

      <div className="admin-content">
        {tabActiva === "agenda" && (
          <AgendaLista
            estilistas={estilistas}
          />
        )}
        {tabActiva === "reservar" && (
          <ReservarTurnoAdmin
            estilistaId={estilistaId}
            setEstilistaId={setEstilistaId}
            estilistas={estilistas}
          />
        )}
        {tabActiva === "estilistas" && (
          <EstilistasAdmin
            estilistas={estilistas}
            cargarEstilistas={cargarEstilistas}
          />
        )}
        {tabActiva === "servicios" && (
          <ServiciosAdmin
            estilistaId={estilistaId}
            setEstilistaId={setEstilistaId}
            estilistas={estilistas}
          />
        )}
        {tabActiva === "horarios" && (
          <HorariosAdmin
            estilistaId={estilistaId}
            setEstilistaId={setEstilistaId}
            estilistas={estilistas}
          />
        )}
         {tabActiva === "whatsapp" && (
          <WhatsAppStatus localId={localId} />
        )}
      </div>
    </div>
  );
};