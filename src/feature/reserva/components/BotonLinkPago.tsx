import { useState } from 'react';
import { toast } from 'sonner';
import { fetchWithAuth } from '../../../shared/lib/fetchWithAuth';

const API_URL = import.meta.env.VITE_API_URL;

interface Props {
  turnoId: number;
  onLinkGenerado?: (link: string) => void;
}

export const BotonLinkPago = ({ turnoId, onLinkGenerado }: Props) => {
  const [loading, setLoading] = useState(false);

  const generarLink = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/pagos/crear-link`, {
        method: 'POST',
        body: JSON.stringify({
          turnoId,
          tipo: 'seña',
          porcentajeSeña: 30,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al crear el link');
      }

      toast.success('Link de pago generado');
      
      // Llamar callback si existe
      if (onLinkGenerado) {
        onLinkGenerado(data.link);
      }

      // Copiar al portapapeles
      await navigator.clipboard.writeText(data.link);
      toast.success('Link copiado al portapapeles');
    } catch (error: any) {
      toast.error(error.message || 'Error al generar el link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={generarLink}
      disabled={loading}
      className="sa-btn"
      style={{
        background: 'var(--color-primary)',
        color: 'white',
        border: 'none',
      }}
    >
      {loading ? 'Generando...' : '💳 Generar link de pago'}
    </button>
  );
};