// Configuración pública de la aplicación web «LUMEN Web» del proyecto rol-serv.
// Pegar exclusivamente el firebaseConfig exacto de Firebase Console.
// No incluir contraseñas, tokens ni cuentas de servicio en el repositorio.
// El portal permanece bloqueado si falta algún campo requerido.
export const firebaseConfig = Object.freeze({
  apiKey: '',
  authDomain: '',
  projectId: 'rol-serv',
  appId: '',
  messagingSenderId: ''
});
export const configured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain &&
  firebaseConfig.projectId === 'rol-serv' && firebaseConfig.appId &&
  firebaseConfig.messagingSenderId
);
