import type { PetMascotaFlagsController, PetMascotaFlagsSnapshot } from "../state/petMascotaFlagsController.ts";
import { MASCOTA_FLAGS } from "../types/petMascotaFlags.types.ts";
import type { PetManagementDetail } from "../types/petManagement.types.ts";
import { mascotaFlagBlockedReason, mascotaFlagLabels, MASCOTA_HIGH_DEMAND_INFO } from "./petMascotaFlagsView.ts";

export function PetMascotaFlags({ detail, controller, state, disabled }: {
  detail: PetManagementDetail;
  controller: PetMascotaFlagsController;
  state: PetMascotaFlagsSnapshot;
  disabled: boolean;
}) {
  return (
    <section className="pet-management__detail-section" aria-labelledby="pet-management-flags-title" aria-busy={state.busy}>
      <h4 id="pet-management-flags-title">Estado y reservas</h4>
      {state.notice && <p className="pet-management__status" role="status">{state.notice}</p>}
      {state.errorMessage && <p className="pet-management__alert" role="alert">{state.errorMessage}</p>}
      {state.busy && <p className="pet-management__status" role="status">{state.mode === "writing" ? "Guardando cambio…" : "Verificando estado desde la ficha…"}</p>}
      {state.pending && !state.busy && <button className="pet-management__secondary" type="button" onClick={() => { void controller.verify(); }}>Verificar nuevamente</button>}
      <div className="pet-management__flags">
        {MASCOTA_FLAGS.map(flag => {
          const labels = mascotaFlagLabels(detail, flag);
          const value = !detail[flag];
          const blocked = mascotaFlagBlockedReason(detail, { flag, value });
          const hint = blocked ?? (flag === "altaExigencia" && detail.altaExigencia ? MASCOTA_HIGH_DEMAND_INFO : null);
          const hintId = `pet-management-${flag}-hint`;
          return (
            <div className="pet-management__flag" key={flag}>
              <div><h5>{labels.title}</h5><p>{labels.status}</p></div>
              <button className="pet-management__secondary" type="button" aria-describedby={hint ? hintId : undefined}
                disabled={disabled || state.busy || state.pending !== null || blocked !== null}
                onClick={() => { void controller.changeFlag(flag, value); }}>{labels.action}</button>
              {hint && <p className="pet-management__hint" id={hintId}>{hint}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
