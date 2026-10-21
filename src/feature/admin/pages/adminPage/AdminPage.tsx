import { useCallback, useEffect, useRef, useState }
  from "react";

import { useBeforeUnload, useBlocker, useNavigate }
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
import { BUSINESS_TYPE, isBusinessType } from "./types/adminPage.types";
import type { AdminTab, BusinessType } from "./types/adminPage.types";
import { getAdminTabLabel, getInitialAdminTab, reconcileAdminTab } from "./adminTabs";
import type { PetManagementNavigationGuard } from "../../petManagement/state/petManagementNavigation";

interface TabSelection {
  businessType: BusinessType | null;
  tab: AdminTab;
}

export const AdminPage = () => {

  const { pagarMutation } = useSuscripcion();
  const navigate =
    useNavigate();

  const navigationGuard = useRef<PetManagementNavigationGuard | null>(null);
  const registerNavigation = useCallback((guard: PetManagementNavigationGuard | null) => {
    navigationGuard.current = guard;
  }, []);
  const blocker = useBlocker(() => navigationGuard.current?.hasPendingChanges() ?? false);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (navigationGuard.current?.canLeave() ?? true) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useBeforeUnload(useCallback((event: BeforeUnloadEvent) => {
    if (!navigationGuard.current?.hasPendingChanges()) return;
    event.preventDefault();
    event.returnValue = "";
  }, []));

  const [tabSelection, setTabSelection] =
    useState<TabSelection>({ businessType: null, tab: "agenda" });

  const [estilistaId, setEstilistaId] =
    useState<number | null>(null);

  const {
    data,
    isError: isAdminMeError,
    isLoading: loadingAdminMe,
  } = useAdminMe();

  const businessType = data?.businessType ?? null;
  const validBusinessType = businessType && isBusinessType(businessType)
    ? businessType
    : null;
  const tabActiva = validBusinessType
    ? tabSelection.businessType === validBusinessType
      ? reconcileAdminTab(tabSelection.tab, validBusinessType)
      : getInitialAdminTab(validBusinessType)
    : tabSelection.tab;
  const setTabActiva = (tab: AdminTab) => {
    if (tab === tabActiva || !(navigationGuard.current?.canLeave() ?? true)) return;
    setTabSelection({ businessType: validBusinessType, tab });
  };

  const {
    data: estilistas = [],
    isLoading: loadingEstilistas,
  } = useEstilistas(data?.businessType === BUSINESS_TYPE.BEAUTY);

  const { logout } =
    useLogoutMutation();

  // ✅ Obtener datos de suscripción
  const { data: suscripcion, isLoading: loadingSuscripcion } = useSuscripcion();

  // ✅ CALCULAR SI ESTÁ VENCIDO (lo hacemos acá para poder usarlo en el useEffect)
  let diasRestantes = 999;
  if (suscripcion?.suscripcion_vencimiento) {
    const hoy = new Date();
    const vencimiento = new Date(suscripcion.suscripcion_vencimiento);
    const diferenciaTiempo = vencimiento.getTime() - hoy.getTime();
    diasRestantes = Math.ceil(diferenciaTiempo / (1000 * 3600 * 24));
  }

  const estaVencido = diasRestantes <= 0 || suscripcion?.suscripcion_estado === 'vencido';

  // ✅ TÍTULO DINÁMICO DE LA PESTAÑA (un solo useEffect para TODOS los casos)
  useEffect(() => {
    // Caso 1: Suscripción vencida
    if (estaVencido) {
      document.title = 'Suscripción Vencida | AgendaOK';
      return;
    }

    // Caso 2: Normal (con o sin nombre de local)
    const nombreTab = getAdminTabLabel(tabActiva);
    const nombreLocal = data?.nombreLocal;

    if (nombreLocal) {
      document.title = `${nombreTab} | ${nombreLocal} | AgendaOK`;
    } else {
      document.title = `${nombreTab} | AgendaOK`;
    }
  }, [tabActiva, data?.nombreLocal, estaVencido]);

  // ✅ UN SOLO useEffect para manejar el error de login (eliminamos el duplicado)
  useEffect(() => {
    if (isAdminMeError) {
      navigationGuard.current = null;
      localStorage.removeItem("token");
      navigate("/login");
    }
  }, [isAdminMeError, navigate]);

  const handleLogout =
    () => {
      if (!(navigationGuard.current?.canLeave() ?? true)) return;
      navigationGuard.current = null;
      logout();

      navigate("/login");
    };

  if (loadingAdminMe || loadingSuscripcion || (data?.businessType === BUSINESS_TYPE.BEAUTY && loadingEstilistas)) {
    return <AdminPageSkeleton />;
  }

  if (isAdminMeError || !data) {
    return <div role="alert">No se pudo cargar el contexto del local.</div>;
  }

  if (!isBusinessType(data.businessType)) {
    return <div role="alert">El local no tiene un tipo de negocio válido.</div>;
  }

  // ✅ SI ESTÁ VENCIDO, MOSTRAR SOLO LA PANTALLA DE PAGO (BLOQUEO TOTAL)
  // ❌ YA NO hay useEffect acá adentro (eso rompía las reglas de los hooks)
  if (estaVencido) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fef2f2',
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

        <button
          onClick={() => pagarMutation.mutate()}
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
        businessType={data.businessType}
        tabActiva={tabActiva}
        setTabActiva={setTabActiva}
      />

      <AdminContent
        registerNavigation={registerNavigation}
        tabActiva={tabActiva}
        businessType={data.businessType}
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
