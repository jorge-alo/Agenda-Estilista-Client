import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "./LoginPage.module.css"; // Reutilizamos los mismos estilos

const API_URL = import.meta.env.VITE_API_URL;

export const ResetPasswordPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const token = searchParams.get("token");

    useEffect(() => {
        if (!token) {
            setError("Enlace de recuperación inválido o incompleto.");
        }
    }, [token]);

    const handleReset = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        setError("");

        if (!newPassword || !confirmPassword) {
            setError("Completa todos los campos");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Las contraseñas no coinciden");
            return;
        }
        if (newPassword.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, newPassword }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Error al restablecer la contraseña");
                return;
            }

            setSuccess(true);
            setTimeout(() => navigate("/login"), 3000); // Redirige al login después de 3 seg
        } catch {
            setError("Error de conexión");
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <h1 className={styles.title}>Error</h1>
                    <p className={styles.error}>{error}</p>
                    <button className={styles.button} onClick={() => navigate("/login")}>
                        Volver al login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <form onSubmit={handleReset} className={styles.card}>
                <h1 className={styles.title}>Nueva contraseña</h1>
                
                {error && <p className={styles.error}>{error}</p>}
                {success && (
                    <p className={styles.success}>
                        ¡Contraseña actualizada! Redirigiendo al login...
                    </p>
                )}

                {!success && (
                    <>
                        <div className={styles.inputGroup}>
                            <input
                                className={styles.input}
                                type="password"
                                placeholder="Nueva contraseña"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <input
                                className={styles.input}
                                type="password"
                                placeholder="Confirmar contraseña"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <button className={styles.button} type="submit" disabled={isLoading}>
                            {isLoading ? "Procesando..." : "Guardar nueva contraseña"}
                        </button>
                    </>
                )}
            </form>
        </div>
    );
};