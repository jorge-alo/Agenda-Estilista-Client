import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./LoginPage.module.css";
import { jwtDecode } from "jwt-decode";

const API_URL = import.meta.env.VITE_API_URL;

export const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
     const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotMessage, setForgotMessage] = useState("");
    const navigate = useNavigate();

    const handleLogin = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        setError("");

        if (!email || !password) {
            setError("Completa todos los campos");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            console.log("STATUS:", res.status);

            const data = await res.json();

            if (data.error) {
                setError(data.error);
                return;
            }

            // 🔥 guardar token
            localStorage.setItem("token", data.token);

            const decoded: any = jwtDecode(data.token);

            if (decoded.rol === "superadmin") {
                navigate("/superadmin");
            } else {
                navigate("/admin");
            }
        } catch (error) {
            setError("Error de conexión");
        }
    };

     const handleForgotPassword = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        setError("");
        setForgotMessage("");

        if (!forgotEmail) {
            setError("Ingresa tu correo electrónico");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: forgotEmail }),
            });

            const data = await res.json();
            
            if (!res.ok) {
                setError(data.error || "Error al procesar la solicitud");
                return;
            }

            setForgotMessage("Si el correo está registrado, recibirás un enlace de recuperación.");
            setForgotEmail("");
        } catch {
            setError("Error de conexión");
        }
    };


   if (showForgot) {
        return (
            <div className={styles.container}>
                <form onSubmit={handleForgotPassword} className={styles.card}>
                    <h1 className={styles.title}>Recuperar contraseña</h1>
                    {error && <p className={styles.error}>{error}</p>}
                    {forgotMessage && <p className={styles.success}>{forgotMessage}</p>}
                    
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
                        />
                    </div>

                    <button className={styles.button} type="submit">
                        Enviar enlace
                    </button>

                    <button 
                        type="button" 
                        className={styles.linkButton}
                        onClick={() => {
                            setShowForgot(false);
                            setError("");
                            setForgotMessage("");
                        }}
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