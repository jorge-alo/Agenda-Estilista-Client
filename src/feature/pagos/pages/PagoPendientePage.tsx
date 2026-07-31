import {  useNavigate } from 'react-router-dom';

export const PagoPendientePage = () => {
  
  const navigate = useNavigate();
  

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
          ⏳
        </div>

        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '28px',
          color: '#f5a623',
          marginBottom: '16px'
        }}>
          Pago en proceso
        </h1>

        <p style={{
          fontSize: '16px',
          color: 'var(--color-text)',
          marginBottom: '24px',
          lineHeight: '1.6'
        }}>
          Tu pago está siendo procesado. Esto puede tardar unos minutos.
        </p>

        <div style={{
          background: 'rgba(245, 166, 35, 0.1)',
          border: '1px solid #f5a623',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '24px',
          textAlign: 'left'
        }}>
          <p style={{
            fontSize: '14px',
            color: 'var(--color-text)',
            marginBottom: '8px',
            fontWeight: '500'
          }}>
            ¿Qué sigue?
          </p>
          <ul style={{
            fontSize: '13px',
            color: 'var(--color-text-soft)',
            paddingLeft: '20px',
            lineHeight: '1.8',
            margin: 0
          }}>
            <li>Una vez confirmado, recibirás un mensaje por WhatsApp</li>
            <li>El turno quedará automáticamente confirmado</li>
            <li>Si el pago no se confirma en 24hs, el turno se liberará</li>
          </ul>
        </div>

        <p style={{
          fontSize: '14px',
          color: 'var(--color-text-soft)',
          marginBottom: '24px'
        }}>
          Podés cerrar esta ventana. Te avisaremos por WhatsApp cuando tu turno esté confirmado.
        </p>

        <button
          onClick={() => navigate('/')}
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