import { useEffect, useState }
from "react";

import { useNavigate }
from "react-router-dom";

import { adminPageService }
from "../services/adminPage.service";

export const useAdminAuth =
() => {

  const navigate =
    useNavigate();

  const [localNombre,
    setLocalNombre] =
      useState("");

  const [localId,
    setLocalId] =
      useState("");

  useEffect(() => {

    adminPageService
      .me()

      .then((data) => {

        setLocalNombre(
          data.nombreLocal ?? ""
        );

        setLocalId(
          data.localId == null ? "" : String(data.localId)
        );
      })

      .catch(() => {

        localStorage
          .removeItem("token");

        navigate("/login");
      });

  }, [navigate]);

  return {
    localNombre,
    localId,
  };
};
