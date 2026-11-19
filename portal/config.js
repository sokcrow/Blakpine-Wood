// Configuración PÚBLICA de la app «LUMEN Web» registrada en Firebase: rol-serv.
// Tomada literalmente del firebaseConfig proporcionado por el Director.
// NUNCA agregar credenciales privadas, contraseñas ni service accounts aquí.
export const firebaseConfig = Object.freeze({
  apiKey: 'AIzaSyCF9YjLZBT8Z9nN4ReBxqQeVTy7x2CeRvE',
  authDomain: 'rol-serv.firebaseapp.com',
  projectId: 'rol-serv',
  storageBucket: 'rol-serv.firebasestorage.app',
  messagingSenderId: '714989108848',
  appId: '1:714989108848:web:30764e5d57961653823eb5',
  measurementId: 'G-B83Q8D22PD'
});
export const configured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain &&
  firebaseConfig.projectId === 'rol-serv' && firebaseConfig.appId &&
  firebaseConfig.messagingSenderId
);
