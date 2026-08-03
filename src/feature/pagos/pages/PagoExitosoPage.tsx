import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL;

export const PagoExitosoPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const turnoId = searchParams.get('turno');
  const [turnoInfo, setTurnoInfo] = useState<any>(null);
   const slug = searchParams.get('slug');

  useEffect(() => {
    if (turnoId) {
      // Obtener información del turno para mostrar al cliente
       fetch(`${API_URL}/api/public/turno/${turnoId}`)
        .then(res => res.json())
        .then(data => setTurnoInfo(data))
        .catch(err => console.error('Error cargando turno:', err));
    }
  }, [turnoId]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--color-white)',
        borderRadius: 'var(--radius-lg)',
        padding: '40px',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          fontSize: '64px',
          marginBottom: '20px'
        }}>
          ✅
        </div>

        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '28px',
          color: 'var(--color-success)',
          marginBottom: '16px'
        }}>
          ¡Pago exitoso!
        </h1>

        <p style={{
          fontSize: '16px',
          color: 'var(--color-text)',
          marginBottom: '24px',
          lineHeight: '1.6'
        }}>
          Tu turno ha sido confirmado correctamente.
        </p>

        {turnoInfo && (
          <div style={{
            background: 'var(--color-bg)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            marginBottom: '24px',
            textAlign: 'left'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--color-text-soft)',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Detalles del turno
            </h3>
            <div style={{ fontSize: '14px', color: 'var(--color-text)' }}>
              <p style={{ marginBottom: '8px' }}>
                <strong>📅 Fecha:</strong> {new Date(turnoInfo.fecha).toLocaleDateString('es-AR')}
              </p>
              <p style={{ marginBottom: '8px' }}>
                <strong>⏰ Hora:</strong> {turnoInfo.hora}
              </p>
              <p style={{ marginBottom: '8px' }}>
                <strong>💇 Servicio:</strong> {turnoInfo.servicioNombre}
              </p>
              <p style={{ marginBottom: '8px' }}>
                <strong>📍 Local:</strong> {turnoInfo.localNombre}
              </p>
            </div>
          </div>
        )}

        <p style={{
          fontSize: '14px',
          color: 'var(--color-text-soft)',
          marginBottom: '24px'
        }}>
          Te enviamos un mensaje de confirmación por WhatsApp.
        </p>

         <button
      onClick={() => navigate(slug ? `/${slug}` : '/')} // ✅ Redirige al local correcto, o a '/' por seguridad
      style={{
        background: 'var(--color-primary)',
        color: 'var(--color-white)',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        padding: '14px 32px',
        fontSize: '15px',
        fontWeight: '500',
        cursor: 'pointer',
        width: '100%'
      }}
    >
      Volver al inicio
    </button>
      </div>
    </div>
  );
};