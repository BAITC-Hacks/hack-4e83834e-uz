import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC4mVJCffUktu8Cn46FweeP4keC1R9lyTA",
  authDomain: "road-3b1eb.firebaseapp.com",
  projectId: "road-3b1eb",
  storageBucket: "road-3b1eb.firebasestorage.app",
  messagingSenderId: "337007128805",
  appId: "1:337007128805:web:532ca14ea466c91677640c",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);