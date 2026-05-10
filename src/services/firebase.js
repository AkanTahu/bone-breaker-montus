import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebaseconfig.json";

const missingConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const hasFirebaseConfig = missingConfig.length === 0;
export const firebaseConfigWarning = missingConfig.length
  ? `Konfigurasi Firebase belum lengkap: ${missingConfig.join(", ")}`
  : "";

export const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app) : null;
