import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import styles from "./LoginPage.module.css";
import { useForgotPassword } from "./mutations/useForgotPassword";
import { forgotPasswordSchema, loginSchema, type ForgotPasswordInput, type LoginInput } from "./schemas/auth.schema";
 // Ajusta la ruta

const API_URL = import.meta.env.VITE_API_URL;

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  
  const navigate = useNavigate();
  const forgotMutation = useForgotPassword();

    const handleLogin = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError("");

    // ✅ Validación con Zod
    const validationResult = loginSchema.safeParse({ email, password });
    if (!validationResult.success) {
      setError(validationResult.error.issues[0].message);
      return;
    }

    const data: LoginInput = validationResult.data;

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const responseData = await res.json();

      if (responseData.error) {
        setError(responseData.error);
        return;
      }

      localStorage.setItem("token", responseData.token);
      const decoded: any = jwtDecode(responseData.token);

      if (decoded.rol === "superadmin") {
        navigate("/superadmin");
      } else {
        navigate("/admin");
      }
    } catch {
      setError("Error de conexión");
    }
  };

  const handleForgotPassword = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError("");

    // ✅ Validación con Zod
    const validationResult = forgotPasswordSchema.safeParse({ email: forgotEmail });
    if (!validationResult.success) {
      setError(validationResult.error.issues[0].message);
      return;
    }

    const data: ForgotPasswordInput = validationResult.data;
    await forgotMutation.mutateAsync(data);
    setForgotEmail("");
  };

  if (showForgot) {
    return (
      <div className={styles.container}>
        <form onSubmit={handleForgotPassword} className={styles.card}>
          <h1 className={styles.title}>Recuperar contraseña</h1>
          
          {error && <p className={styles.error}>{error}</p>}
          
          <p className={styles.subtitle}>
            Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
          </p>

          <div className={styles.inputGroup}>
            <input
              className={styles.input}
              type="email"
              placeholder="Email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              disabled={forgotMutation.isPending}
            />
          </div>

          <button className={styles.button} type="submit" disabled={forgotMutation.isPending}>
            {forgotMutation.isPending ? "Enviando..." : "Enviar enlace"}
          </button>

          <button 
            type="button" 
            className={styles.linkButton}
            onClick={() => {
              setShowForgot(false);
              setError("");
              setForgotEmail("");
            }}
            disabled={forgotMutation.isPending}
          >
            ← Volver al inicio de sesión
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <form onSubmit={handleLogin} className={styles.card}>
        <h1 className={styles.title}>Iniciar sesión</h1>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.inputGroup}>
          <input
            className={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className={styles.inputGroup}>
          <input
            className={styles.input}
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className={styles.forgotContainer}>
          <button 
            type="button" 
            className={styles.forgotLink}
            onClick={() => setShowForgot(true)}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        <button className={styles.button} type="submit">
          Entrar
        </button>
      </form>
    </div>
  );
};