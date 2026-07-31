import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AdminPage } from './feature/admin/pages/adminPage/AdminPage'
import { ReservaPage } from './feature/reserva/page/ReservaPage'
import { LoginPage } from './feature/admin/pages/LoginPage';
import { ProtectedRoute } from './feature/admin/components/ProtectedRoute';
import { NotFoundPage } from './feature/reserva/components/NotFoundPage';
import { SuperAdminPage } from './feature/superadmin/superAdminPage';
import { ResetPasswordPage } from './feature/admin/pages/ResetPasswordPage';
import { PagoExitosoPage } from './feature/pagos/pages/PagoExitosoPage';
import { PagoFallidoPage } from './feature/pagos/pages/PagoFallidoPage';
import { PagoPendientePage } from './feature/pagos/pages/PagoPendientePage';

export const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/superadmin" element={
          <ProtectedRoute requiredRole="superadmin">
            <SuperAdminPage />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        } />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/:slug" element={<ReservaPage />} />
        <Route path="*" element={<NotFoundPage />} />
        <Route path="/pago-exitoso" element={<PagoExitosoPage />} />
        <Route path="/pago-fallido" element={<PagoFallidoPage />} />
        <Route path="/pago-pendiente" element={<PagoPendientePage />} />
      </Routes>
    </BrowserRouter>
  )
}
