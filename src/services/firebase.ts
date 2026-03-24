import { initializeApp, getApps } from 'firebase/app';

const firebaseConfig = {
  apiKey: "AIzaSyDmSs-dEkmUkeSNZxF6u6fU_ifDhSZKkVI",
  authDomain: "sound-curtain-5unwwh.firebaseapp.com",
  projectId: "sound-curtain-5unwwh",
  storageBucket: "sound-curtain-5unwwh.firebasestorage.app",
  messagingSenderId: "496626750767",
  appId: "1:496626750767:web:fb627d42fc98e95ca57dda",
};

export function initFirebase() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
}
