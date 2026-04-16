import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AdminPage } from './feature/admin/pages/AdminPage'
import { ReservaPage } from './feature/reserva/ReservaPage'
import { LoginPage } from './feature/admin/pages/LoginPage';
import { ProtectedRoute } from './feature/admin/components/ProtectedRoute';
import { NotFoundPage } from './feature/reserva/components/NotFoundPage';

export const App = () => {
  return (
    <BrowserRouter>
      <Routes>
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
