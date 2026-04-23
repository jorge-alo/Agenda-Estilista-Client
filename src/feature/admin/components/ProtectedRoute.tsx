import type React from "react"
import { Navigate } from "react-router-dom"
import { jwtDecode } from "jwt-decode"

interface Props {
  children: React.ReactNode;
  requiredRole?: string;
}

export const ProtectedRoute = ({ children, requiredRole }: Props) => {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" />;

  if (requiredRole) {
    try {
      const decoded: any = jwtDecode(token);
      if (decoded.rol !== requiredRole) return <Navigate to="/login" />;
    } catch {
      return <Navigate to="/login" />;
    }
  }

  return children;
};