import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '../types/db';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Navega a la pantalla de llamada entrante si el navigator ya está montado. */
export function navigateToIncomingCall(params: RootStackParamList['IncomingCall']): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate('IncomingCall', params);
  }
}
