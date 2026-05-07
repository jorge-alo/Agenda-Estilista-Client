import { useState } from "react";
import { useDashboard }from "../hooks/useDashboard";
import { MetricasCard }from "./MetricasCard";
import { ListaTurnosHoy } from "./ListaTurnosHoy";
import "../styles/dashboard.css";
import { PorEstilista } from "./PorEstilista";
import { HistorialClientes } from "./HistorialCliente";
import { ReporteMensual } from "./ReporteMensual";

export const Resumen = () => {

    const [fecha] = useState(
        new Date()
            .toISOString()
            .split("T")[0]
    );

    const {
        data,
        isLoading,
        error
    } = useDashboard(fecha);

    if (isLoading) {
        return (
            <p>Cargando dashboard...</p>
        );
    }

    if (error) {
        return <p>Error al cargar dashboard</p>;
    }

    if (!data) {
        return null;
    }

    return (

        <div className="dashboard-container">

            <div className="dashboard-header">

                <h1 className="dashboard-title">
                    Dashboard
                </h1>

                <span className="dashboard-date">
                    {data.fecha}
                </span>

            </div>

            {/* RESUMEN DEL DÍA */}

            <section className="dashboard-section">

                <h2 className="dashboard-section-title">
                    Resumen del día
                </h2>

                <div className="dashboard-grid">

                    <MetricasCard
                        titulo="Turnos"
                        valor={data.totalTurnos}
                    />

                    <MetricasCard
                        titulo="Completados"
                        valor={data.completados}
                    />

                    <MetricasCard
                        titulo="Cancelados"
                        valor={data.cancelados}
                    />

                    <MetricasCard
                        titulo="Pendientes"
                        valor={data.pendientes}
                    />

                    <MetricasCard
                        titulo="Ingresos"
                        valor={`$${data.ingresosEstimados}`}
                    />

                    <MetricasCard
                        titulo="Ocupación"
                        valor={`${data.ocupacionPorcentaje}%`}
                    />

                </div>

                <PorEstilista
                    estilistas={data.porEstilista}
                />

                <ListaTurnosHoy
                    turnos={data.turnos}
                />

            </section>

            {/* CLIENTES */}

            <section className="dashboard-section">

                <HistorialClientes />

            </section>

            {/* REPORTE */}

            <section className="dashboard-section">


                <ReporteMensual />

            </section>

        </div>
    );
};