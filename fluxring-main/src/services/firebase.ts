import firebase from '@react-native-firebase/app';

const firebaseConfig = {
  projectId: 'sound-curtain-5unwwh',
};

export function initFirebase() {
  if (!firebase.apps.length) {
    // Firebase is auto-initialized via google-services.json / GoogleService-Info.plist
    // This function is a placeholder for any additional setup
  }
}

export default firebase;
