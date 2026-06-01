import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC574R9uZb49W4gC9nQRhrW2XXVbTilMlc",
  authDomain: "playtowin-8445f.firebaseapp.com",
  databaseURL: "https://playtowin-8445f-default-rtdb.firebaseio.com",
  projectId: "playtowin-8445f",
  storageBucket: "playtowin-8445f.firebasestorage.app",
  messagingSenderId: "994498245287",
  appId: "1:994498245287:web:948afb8cfb11aa16bde182",
  measurementId: "G-NN0X3VYLL4"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Simple connection test to verify configuration
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration or network status.");
    }
  }
}
testConnection();
