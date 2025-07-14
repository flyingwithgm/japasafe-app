
// Import the functions you need from the SDKs
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDeEsZcoqYKYv5LKvrRD5vNjMdTmHPvme0",
  authDomain: "japasafe-app.firebaseapp.com",
  projectId: "japasafe-app",
  storageBucket: "japasafe-app.appspot.com",
  messagingSenderId: "887629752408",
  appId: "1:887629752408:web:9b33080a388ac1a132022d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services for use in your app
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
