export const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    // Si no hay token, podrías manejarlo aquí o dejar que el 401 ocurra
    if (!token) {
        console.warn("No hay token disponible en localStorage");
    }
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
    };
};