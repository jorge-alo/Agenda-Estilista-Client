import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./LoginPage.module.css";

const API_URL = import.meta.env.VITE_API_URL;

export const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
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

            navigate("/admin");
        } catch (error) {
            setError("Error de conexión");
        }
    };

    return (
        <div className={styles.container}>
            <form onSubmit={handleLogin} className={styles.card}>
                <h1 className={styles.title}>Iniciar sesión</h1>

                {error && <p className={styles.error}>{error}</p>}

                <div className={styles.inputGroup}>
                    <input
                        className={styles.input}
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

                <button className={styles.button}>
                    Entrar
                </button>
            </form>
        </div>
    );
};