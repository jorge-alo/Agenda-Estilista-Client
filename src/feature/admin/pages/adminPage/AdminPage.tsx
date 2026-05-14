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

export const AdminPage = () => {

  const navigate =
    useNavigate();

  const [tabActiva, setTabActiva] =
    useState("agenda");

  const [estilistaId, setEstilistaId] =
    useState<number | null>(null);

  const {
    data: estilistas = [],
  } = useEstilistas();

  const {
    data,
    isError,
  } = useAdminMe();

  const { logout } =
    useLogoutMutation();

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