import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDH171yMswhywaAT55v0CDkRjOvH0cxKfQ",
    authDomain: "gen-lang-client-0988840455.firebaseapp.com",
    projectId: "gen-lang-client-0988840455",
    storageBucket: "gen-lang-client-0988840455.firebasestorage.app",
    messagingSenderId: "443616684437",
    appId: "1:443616684437:web:345aa98542a9513c29ae9c",
    measurementId: "G-S4W3QK9GJY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export { analytics };
