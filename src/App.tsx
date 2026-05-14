import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AdminPage } from './feature/admin/pages/adminPage/AdminPage'
import { ReservaPage } from './feature/reserva/ReservaPage'
import { LoginPage } from './feature/admin/pages/LoginPage';
import { ProtectedRoute } from './feature/admin/components/ProtectedRoute';
import { NotFoundPage } from './feature/reserva/components/NotFoundPage';
import { SuperAdminPage } from './feature/superadmin/superAdminPage';

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
        <Route path="/:slug" element={<ReservaPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
