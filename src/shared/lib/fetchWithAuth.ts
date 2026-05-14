import { getAuthHeaders } from "../../feature/auth/auth.helpers";

export const fetchWithAuth =
async (
  input: RequestInfo,
  init?: RequestInit
) => {

  const res = await fetch(
    input,
    {
      ...init,

      headers: {
        ...getAuthHeaders(),
        ...init?.headers,
      },
    }
  );

  if (res.status === 401) {

    localStorage.removeItem(
      "token"
    );

    window.location.href =
      "/login";

    throw new Error(
      "Sesión expirada"
    );
  }

  return res;
};