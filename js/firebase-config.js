// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
  apiKey: "AIzaSyDU0rqDjPdMsjhS_7MmvCYaoPoXpqeqyRE",
  authDomain: "unno-f3338.firebaseapp.com",
  databaseURL: "https://unno-f3338-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "unno-f3338",
  storageBucket: "unno-f3338.firebasestorage.app",
  messagingSenderId: "925580365013",
  appId: "1:925580365013:web:651b38e0dc0383b28e265c",
  measurementId: "G-976XGC3C0F"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
