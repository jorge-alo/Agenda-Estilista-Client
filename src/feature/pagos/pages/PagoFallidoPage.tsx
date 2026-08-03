import { useNavigate, useSearchParams } from 'react-router-dom';

export const PagoFallidoPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const slug = searchParams.get('slug');


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
          ❌
        </div>

        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '28px',
          color: 'var(--color-error)',
          marginBottom: '16px'
        }}>
          Pago rechazado
        </h1>

        <p style={{
          fontSize: '16px',
          color: 'var(--color-text)',
          marginBottom: '24px',
          lineHeight: '1.6'
        }}>
          No pudimos procesar tu pago. Esto puede deberse a:
        </p>

        <ul style={{
          textAlign: 'left',
          fontSize: '14px',
          color: 'var(--color-text-soft)',
          marginBottom: '24px',
          paddingLeft: '20px',
          lineHeight: '1.8'
        }}>
          <li>Fondos insuficientes en tu cuenta</li>
          <li>Datos de la tarjeta incorrectos</li>
          <li>Problema con el emisor de la tarjeta</li>
        </ul>

        <p style={{
          fontSize: '14px',
          color: 'var(--color-text-soft)',
          marginBottom: '24px'
        }}>
          Podés intentar nuevamente o contactar al local para reservar por WhatsApp.
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => window.history.back()}
            style={{
              flex: 1,
              background: 'var(--color-white)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '14px',
              fontSize: '15px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Intentar de nuevo
          </button>
          <button
            onClick={() => navigate(slug ? `/${slug}` : '/')} // ✅ Redirige al local correcto
            style={{
              flex: 1,
              background: 'var(--color-primary)',
              color: 'var(--color-white)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '14px',
              fontSize: '15px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
};