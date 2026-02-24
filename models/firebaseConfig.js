// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBYdK2ev2TOZdOTYPvydpbuYBookhD-yfU",
  authDomain: "ducthinh-efefe.firebaseapp.com",
  projectId: "ducthinh-efefe",
  storageBucket: "ducthinh-efefe.firebasestorage.app",
  messagingSenderId: "547891455916",
  appId: "1:547891455916:web:cc648e8b57b6933a78bc09",
  measurementId: "G-5DJHG3WLG9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);