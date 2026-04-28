import { useEffect } from "react"
import { getDisponibilidadAdmin } from "../../api/Admin.api"

interface DisponibilidadAdminProps {
    fecha: string
    estilistaId: number | null
    servicioId: number | null
    setDisponibles: (horas: string[]) => void
}

export const useDisponibilidadAdmin = ({ fecha, estilistaId, servicioId, setDisponibles}: DisponibilidadAdminProps) => {
    // traer disponibilidad
    useEffect(() => {
        if (!fecha || !estilistaId || !servicioId) return;

        getDisponibilidadAdmin( fecha, estilistaId, servicioId, setDisponibles)

    }, [fecha, estilistaId, servicioId]);
}