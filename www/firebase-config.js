// Configuration Firebase pour les défis multijoueur en temps réel.
// Étapes :
//  1. Créez un projet sur https://console.firebase.google.com
//  2. Ajoutez une app Web → copiez l'objet firebaseConfig ci-dessous
//  3. Activez Realtime Database (mode "test" puis appliquez les règles ci-après)
//  4. Dans Realtime Database > Règles, collez :
//
//  {
//    "rules": {
//      ".read": false, ".write": false,
//      "defis": {
//        "$code": {
//          ".read": true,
//          "joueurs": {
//            "$pseudo": {
//              ".write": true,
//              ".validate": "newData.hasChildren(['score','total','pct','ts'])"
//            }
//          }
//        }
//      }
//    }
//  }
//
// Les clés Firebase Web sont publiques par conception (la sécurité passe par les règles).

window.FIREBASE_CONFIG = {
  apiKey:            "",
  authDomain:        "",
  databaseURL:       "",   // ex. https://mon-projet-default-rtdb.firebaseio.com
  projectId:         "",
  storageBucket:     "",
  messagingSenderId: "",
  appId:             "",
};
