import { fetchWithAuth } from "../../../../../shared/lib/fetchWithAuth";


const API_URL =
  import.meta.env.VITE_API_URL;

export const adminPageService = {

  me: async () => {

    const res =
      await fetchWithAuth(
        `${API_URL}/api/auth/me`
      );

    if (!res.ok) {
      throw new Error(
        "No autorizado"
      );
    }

    return res.json();
  },
};