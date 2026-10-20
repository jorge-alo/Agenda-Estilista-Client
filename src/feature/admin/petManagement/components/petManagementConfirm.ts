export const confirmPetManagementAction = (message: string) => window.confirm(message);
export const confirmPetManagementDiscard = () => confirmPetManagementAction("Hay cambios sin guardar. ¿Querés descartarlos?");
