import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "./LoginPage.module.css";
import { useResetPassword } from "./mutations/useResetPassword";
import { resetPasswordConfirmSchema } from "./schemas/auth.schema";


export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const token = searchParams.get("token");
  const resetMutation = useResetPassword();

  useEffect(() => {
    if (!token) {
      setError("Enlace de recuperación inválido o incompleto.");
    }
  }, [token]);

   const handleReset = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Enlace de recuperación inválido o incompleto.");
      return;
    }

    // ✅ Validación completa con Zod (incluye verificación de contraseñas coincidentes)
    const validationResult = resetPasswordConfirmSchema.safeParse({
      token,
      newPassword,
      confirmPassword,
    });

    if (!validationResult.success) {
      setError(validationResult.error.issues[0].message);
      return;
    }

    const data = validationResult.data;
    await resetMutation.mutateAsync({ token: data.token, newPassword: data.newPassword });
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

        {!resetMutation.isSuccess && (
          <>
            <div className={styles.inputGroup}>
              <input
                className={styles.input}
                type="password"
                placeholder="Nueva contraseña"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={resetMutation.isPending}
              />
            </div>
            <div className={styles.inputGroup}>
              <input
                className={styles.input}
                type="password"
                placeholder="Confirmar contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={resetMutation.isPending}
              />
            </div>
            <button className={styles.button} type="submit" disabled={resetMutation.isPending}>
              {resetMutation.isPending ? "Procesando..." : "Guardar nueva contraseña"}
            </button>
          </>
        )}

        {resetMutation.isSuccess && (
          <p className={styles.success}>
            ¡Contraseña actualizada! Redirigiendo al login...
          </p>
        )}
      </form>
    </div>
  );
};