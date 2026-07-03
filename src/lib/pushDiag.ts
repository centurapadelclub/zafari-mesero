/**
 * Store mínimo (observable) para mostrar en pantalla el resultado del registro
 * del token FCM. savePushToken() escribe acá y el PanelScreen lo renderiza, así
 * podemos diagnosticar desde el dispositivo sin ver los logs de la consola.
 */
type Listener = (msg: string) => void;

let current = '';
const listeners = new Set<Listener>();

export function setPushDiag(msg: string): void {
  current = msg;
  listeners.forEach((l) => l(msg));
}

export function getPushDiag(): string {
  return current;
}

export function subscribePushDiag(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
