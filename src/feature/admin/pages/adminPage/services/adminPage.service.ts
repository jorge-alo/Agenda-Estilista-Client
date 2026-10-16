import { fetchWithAuth } from "../../../../../shared/lib/fetchWithAuth";
import type { AdminMeResponse } from "../types/adminPage.types";


const API_URL =
  import.meta.env.VITE_API_URL;

export const adminPageService = {

  me: async (): Promise<AdminMeResponse> => {

    const res =
      await fetchWithAuth(
        `${API_URL}/api/auth/me`
      );

    if (!res.ok) {
      throw new Error(
        "No autorizado"
      );
    }

    return res.json() as Promise<AdminMeResponse>;
  },
};
