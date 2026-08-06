import { useEffect, useState }
  from "react";

import { useNavigate }
  from "react-router-dom";

import "./styles/AdminPage.css";
import { useEstilistas } from "../../estilistas/hooks/useEstilistas";
import { useAdminMe } from "./hooks/useAdminMe";
import { useLogoutMutation } from "./mutations/useLogoutMutation";
import { AdminHeader } from "./components/AdminHeader";
import { AdminTabs } from "./components/AdminTabs";
import { AdminContent } from "./components/AdminContent";
import { AdminPageSkeleton } from "./components/AdminPageSkeleton";
import { useSuscripcion } from "./hooks/useSuscripcion";

export const AdminPage = () => {

  const navigate =
    useNavigate();

  const [tabActiva, setTabActiva] =
    useState("agenda");

  const [estilistaId, setEstilistaId] =
    useState<number | null>(null);

  const {
    data: estilistas = [],
    isLoading: loadingEstilistas,
  } = useEstilistas();

  const {
    data,
    isError,
  } = useAdminMe();

  const { logout } =
    useLogoutMutation();

  // ✅ Obtener datos de suscripción
  const { data: suscripcion, isLoading: loadingSuscripcion } = useSuscripcion();

  useEffect(() => {

    if (isError) {

      localStorage.removeItem(
        "token"
      );

      navigate("/login");
    }

  }, [isError]);

  const handleLogout =
    () => {

      logout();

      navigate("/login");
    };

  if (loadingEstilistas || loadingSuscripcion) {
    return <AdminPageSkeleton />;
  }

  // ✅ CALCULAR DÍAS RESTANTES PARA BLOQUEO TOTAL
  let diasRestantes = 999;
  if (suscripcion?.suscripcion_vencimiento) {
    const hoy = new Date();
    const vencimiento = new Date(suscripcion.suscripcion_vencimiento);
    const diferenciaTiempo = vencimiento.getTime() - hoy.getTime();
    diasRestantes = Math.ceil(diferenciaTiempo / (1000 * 3600 * 24));
  }

  const estaVencido = diasRestantes <= 0 || suscripcion?.suscripcion_estado === 'vencido';

  // ✅ SI ESTÁ VENCIDO, MOSTRAR SOLO LA PANTALLA DE PAGO (BLOQUEO TOTAL)
  if (estaVencido) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fef2f2', // Rojo muy suave
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
        <h1 style={{ fontSize: '28px', color: '#991b1b', marginBottom: '16px', fontFamily: 'var(--font-serif)' }}>
          Suscripción Vencida
        </h1>
        <p style={{ color: '#7f1d1d', maxWidth: '400px', marginBottom: '32px', lineHeight: '1.6' }}>
          Tu período de prueba o suscripción ha finalizado. Para seguir gestionando tu agenda, clientes y turnos, es necesario renovar tu plan.
        </p>

        {/* Reutilizamos la lógica de pago, pero de forma aislada */}
        <button
          onClick={() => {/* Aquí llamas a la mutación de pago, o rediriges a una ruta de pago */ }}
          style={{
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '14px 32px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(220, 38, 38, 0.3)'
          }}
        >
          Renovar Suscripción Ahora
        </button>

        <button
          onClick={handleLogout}
          style={{
            marginTop: '20px',
            background: 'transparent',
            border: 'none',
            color: '#7f1d1d',
            textDecoration: 'underline',
            cursor: 'pointer'
          }}
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (

    <div>

      <AdminHeader
        localNombre={
          data?.nombreLocal || ""
        }
        onLogout={handleLogout}
      />

      <AdminTabs
        tabActiva={tabActiva}
        setTabActiva={setTabActiva}
      />

      <AdminContent
        tabActiva={tabActiva}
        estilistas={estilistas}
        estilistaId={estilistaId}
        setEstilistaId={setEstilistaId}
        localId={
          String(data?.localId || "")
        }
      />

    </div>
  );
};