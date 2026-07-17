/* ===================================================================
   HC Steno Wala — Firebase Configuration (firebase-config.js)
   
   यह फ़ाइल Firebase कनेक्शन की सेटिंग्स रखती है।
   इसे अपने Firebase प्रोजेक्ट की डिटेल्स से रिप्लेस करें।
   
   Firebase Console: https://console.firebase.google.com/
   =================================================================== */

// ── Firebase Configuration ────────────────────────────────────────────
// नीचे दी गई वैल्यूज़ को अपने Firebase प्रोजेक्ट की वैल्यूज़ से बदलें।
// यह वैल्यूज़ Firebase Console > Project Settings > General > Your apps
// सेक्शन में मिलेंगी।
const firebaseConfig = {

  // apiKey: यह आपके Firebase प्रोजेक्ट की API Key है।
  // Firebase Console > Project Settings > General में मिलेगी।
  apiKey: 'YOUR_API_KEY',

  // authDomain: Firebase Authentication के लिए डोमेन।
  // फॉर्मेट: your-project-id.firebaseapp.com
    apiKey: "AIzaSyA9HlYg9SNfxYGwiD2GjOM25Rz3OHhacZY",
    authDomain: "hc-steno-wala-d4a15.firebaseapp.com",
    projectId: "hc-steno-wala-d4a15",
    storageBucket: "hc-steno-wala-d4a15.firebasestorage.app",
    messagingSenderId: "195028129044",
    appId: "1:195028129044:web:2b824c29f5ec0875cc9e01"
};

// ── Firebase Initialize ───────────────────────────────────────────────
// Firebase ऐप को शुरू (initialize) करना
firebase.initializeApp(firebaseConfig);

// ── Firebase Services ─────────────────────────────────────────────────

// Authentication — यूज़र लॉगिन/रजिस्ट्रेशन के लिए
const auth = firebase.auth();

// Firestore Database — डेटा स्टोर करने के लिए (यूज़र प्रोफ़ाइल, स्कोर आदि)
const db = firebase.firestore();

// Storage — फ़ाइलें (ऑडियो, इमेज आदि) अपलोड/डाउनलोड करने के लिए
const storage = firebase.storage();

// ── Global Exports ────────────────────────────────────────────────────
// इन्हें window पर सेट करना ताकि बाकी JS फ़ाइलें इन्हें एक्सेस कर सकें
window.firebaseConfig = firebaseConfig;
window.auth = auth;
window.db = db;
window.storage = storage;

// ── Auth State Persistence ────────────────────────────────────────────
// ब्राउज़र बंद करने के बाद भी यूज़र लॉग-इन रहेगा
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch(function(error) {
    console.error('Auth persistence error:', error.message);
  });

console.log('✅ Firebase initialized successfully — HC Steno Wala');
