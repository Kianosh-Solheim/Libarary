import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  addDoc,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";
import { Home, Star, Trash2, User } from 'lucide-react';
import {
  NavBar,
  LoadingSpinner,
  AdminDashboard,
  PatronDashboard,
  UserAccount,
  AuthPage,
  formatDate
} from './components';
import { PersistentCameraProvider } from './components/PersistentCameraProvider';

// Define the Firebase context
const FirebaseContext = createContext(null);

// Custom hook to use Firebase
const useFirebase = () => useContext(FirebaseContext);

// Your provided Firebase configuration
const providedFirebaseConfig = {
  apiKey: "AIzaSyAs1Qu5ezH2JY4Anag4Kf-aEIG7uSKBWc8",
  authDomain: "library-app-2beba.firebaseapp.com",
  projectId: "library-app-2beba",
  storageBucket: "library-app-2beba.firebasestorage.app",
  messagingSenderId: "819248854208",
  appId: "1:819248854208:web:ffc5055a21624475cbe925",
  measurementId: "G-QNS8M4YBWP"
};

// Extract appId directly from the provided config
const customAppId = providedFirebaseConfig.projectId;

const App = () => {
  // State for Firebase instances
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'admin', 'patron', or null
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('login'); // 'login', 'admin', 'patron', 'user-account'
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  // New states for global app settings
  const [logoUrl, setLogoUrl] = useState("https://placehold.co/60x60/3b82f6/ffffff?text=LIB"); // Default logo
  const [appName, setAppName] = useState("My Library"); // Default app name
  const [loadingText, setLoadingText] = useState("Loading Library..."); // Default loading text
  const [quaggaScriptLoaded, setQuaggaScriptLoaded] = useState(false); // New state for QuaggaJS script loading

  // New states for user and loan management
  const [activeLoans, setActiveLoans] = useState([]);
  const [filteredLoans, setFilteredLoans] = useState([]);
  const [loadingActiveLoans, setLoadingActiveLoans] = useState(false);
  const [users, setUsers] = useState([]);
  
  // Edit user modal state
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    email: '',
    role: 'patron',
    cardNumber: '',
    phone: ''
  });

  // New states for loan period days
  const [loanPeriodDays, setLoanPeriodDays] = useState(14);
  const [renewPeriodDays, setRenewPeriodDays] = useState(14);

  // showMessage function wrapped in useCallback for stable reference
  const showMessage = useCallback((msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  }, []); // Empty dependency array because setMessage and setMessageType are stable

  // Effect to dynamically load QuaggaJS
  useEffect(() => {
    const scriptId = 'quagga-script';
    let script = document.getElementById(scriptId);

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = "https://unpkg.com/quagga@0.12.1/dist/quagga.min.js";
      script.async = true;
      script.onload = () => {
        console.log("QuaggaJS script loaded successfully.");
        setQuaggaScriptLoaded(true);
      };
      script.onerror = () => {
        console.error("Failed to load QuaggaJS script.");
        setQuaggaScriptLoaded(false);
        showMessage("Failed to load barcode scanner library. Please check your internet connection.", 'error');
      };
      document.body.appendChild(script);
    } else if (window.Quagga) {
      // If script already exists and Quagga is available (e.g., hot reload), set state immediately
      setQuaggaScriptLoaded(true);
    }

    return () => {
      // Cleanup: remove the script if the component unmounts, though usually not needed for global libs
      // if (script && script.parentNode) {
      //   script.parentNode.removeChild(script);
      // }
    };
  }, [showMessage]); // Added showMessage to dependency array


  // Initialize Firebase and set up auth listener
  useEffect(() => {
    let unsubscribeAuth = () => {};
    let unsubscribeSettings = () => {};

    const initializeFirebase = async () => {
      try {
        const firebaseConfig = providedFirebaseConfig;
        const appId = customAppId;

        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
          console.error("Firebase config is missing or empty.");
          showMessage('Firebase configuration is missing. Please ensure the app is running in a valid environment.', 'error');
          setLoading(false);
          return;
        }

        const app = initializeApp(firebaseConfig);
        getAnalytics(app);
        const firestore = getFirestore(app);
        const firebaseAuth = getAuth(app);

        setDb(firestore);
        setAuth(firebaseAuth);

        // Fetch and listen for app settings
        const settingsDocRef = doc(firestore, 'artifacts', appId, 'settings', 'appSettings');
        unsubscribeSettings = onSnapshot(settingsDocRef, async (docSnap) => {
          if (docSnap.exists()) {
            const settingsData = docSnap.data();
            setLogoUrl(settingsData.logoUrl || "https://placehold.co/60x60/3b82f6/ffffff?text=LIB");
            setLoadingText(settingsData.loadingText || "Loading Library...");
            setAppName(settingsData.appName || "My Library");
            setLoanPeriodDays(settingsData.loanPeriodDays ?? 14);
            setRenewPeriodDays(settingsData.renewPeriodDays ?? 14);
          } else {
            // Set default settings if document doesn't exist
            await setDoc(settingsDocRef, {
              logoUrl: "https://placehold.co/60x60/3b82f6/ffffff?text=LIB",
              loadingText: "Loading Library...",
              appName: "My Library",
              loanPeriodDays: 14,
              renewPeriodDays: 14
            });
            setLogoUrl("https://placehold.co/60x60/3b82f6/ffffff?text=LIB");
            setLoadingText("Loading Library...");
            setAppName("My Library");
            setLoanPeriodDays(14);
            setRenewPeriodDays(14);
          }
        }, (error) => {
          console.error("Error fetching app settings:", error);
          showMessage(`Error loading app settings: ${error.message}`, 'error');
        });


        // Always sign in anonymously if custom config is used.
        // This ensures a user is always authenticated with some UID, even if it's anonymous.
        // await signInAnonymously(firebaseAuth);
        // console.log("App - Initializing: Signed in anonymously using provided Firebase config.");

        // Set up auth state change listener
        unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (user) => {
          if (user) {
            setCurrentUser(user);
            const currentUserId = user.uid;
            setUserId(currentUserId);
            console.log("App - onAuthStateChanged: User detected, UID:", currentUserId);

            // Fetch user role from Firestore or assign a default
            const userDocRef = doc(firestore, 'artifacts', appId, 'users', currentUserId);
            try {
              const userDocSnap = await getDoc(userDocRef);
              console.log("App - onAuthStateChanged: User document exists in Firestore?", userDocSnap.exists());

              if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                setUserRole(userData.role);
                setCurrentUser({
                  ...JSON.parse(JSON.stringify(user)),
                  ...userData
                });
                console.log('Setting currentUser to:', { ...JSON.parse(JSON.stringify(user)), ...userData });
                setCurrentPage(prevPage => {
                  if (prevPage === 'login' || prevPage === 'admin' || prevPage === 'patron') {
                    return userData.role === 'admin' ? 'admin' : 'patron';
                  }
                  return prevPage;
                });
                console.log("App - onAuthStateChanged: User data from Firestore:", userData);
                console.log("Current user role (from Firestore):", userData.role);
              } else {
                // If user document doesn't exist, it's a new anonymous user or uninitialized user.
                // Create a basic patron document. Admins will be created manually via registration or made admin after anonymous login.
                setUserRole('patron');
                setCurrentPage('patron'); // Default page for new patrons
                await setDoc(userDocRef, {
                  uid: currentUserId,
                  email: user.isAnonymous ? 'anonymous@example.com' : user.email,
                  role: 'patron',
                  createdAt: new Date(),
                  loans: []
                }, { merge: true }); // Use merge: true to avoid overwriting if doc partly exists
                console.log("App - onAuthStateChanged: Created new user document for:", currentUserId, "with role: patron");
                console.log("Current user role (newly created): patron");
              }
            } catch (firestoreError) {
              console.error("App - onAuthStateChanged: Error fetching/creating user document:", firestoreError);
              showMessage(`Error with user data: ${firestoreError.message}. Please check Firestore rules for users collection.`, 'error');
              setLoading(false); // Stop loading if Firestore access fails
              return; // Exit early if user doc cannot be accessed
            }
          } else {
            setCurrentUser(null);
            setUserId(null);
            setUserRole(null);
            setCurrentPage('login'); // Redirect to login if no user is found
            console.log("App - onAuthStateChanged: No user found or user logged out.");
          }
          setIsAuthReady(true);
          setLoading(false);
        });
      } catch (error) {
        console.error("App - Initialize Firebase Error:", error);
        showMessage(`Error initializing app: ${error.message}`, 'error');
        setLoading(false);
      }
    };

    initializeFirebase();

    return () => {
      unsubscribeAuth();
      unsubscribeSettings();
    };
  }, [showMessage, customAppId, providedFirebaseConfig]);

  // Add Google Fonts and meta viewport for mobile (MOVED INSIDE APP COMPONENT)
  useEffect(() => {
    // Add Google Fonts
    if (!document.getElementById('google-fonts-playfair-lora')) {
      const link = document.createElement('link');
      link.id = 'google-fonts-playfair-lora';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Playfair+Display:wght@400;700&display=swap';
      document.head.appendChild(link);
    }
    // Add meta viewport
    if (!document.querySelector('meta[name="viewport"]')) {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0';
      document.head.appendChild(meta);
    }
    // Add global style
    if (!document.getElementById('global-modern-style')) {
      const style = document.createElement('style');
      style.id = 'global-modern-style';
      style.innerHTML = `
        html, body {
          font-family: 'Lora', Georgia, 'Times New Roman', Times, serif;
          background: #f7f7fa;
          color: #222;
          font-size: 16px;
          min-height: 100vh;
        }
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Playfair Display', 'Times New Roman', Times, serif;
          font-weight: 700;
          letter-spacing: 0.01em;
        }
        .modern-card, .bg-white, .bg-blue-50 {
          border-radius: 1.25rem !important;
          box-shadow: 0 2px 16px 0 rgba(60,60,90,0.07), 0 1.5px 4px 0 rgba(60,60,90,0.04);
          background: #fff;
        }
        .modern-btn, button, .btn {
          border-radius: 0.75rem !important;
          font-size: 1rem;
          font-family: 'Lora', Georgia, 'Times New Roman', Times, serif;
          padding: 0.75rem 1.5rem;
          min-width: 44px;
          min-height: 44px;
          transition: background 0.2s, color 0.2s, box-shadow 0.2s, transform 0.1s;
        }
        .modern-btn:active, button:active, .btn:active {
          transform: scale(0.97);
        }
        .modern-btn-primary, .bg-blue-600 {
          background: #2563eb !important;
          color: #fff !important;
          border: none;
        }
        .modern-btn-primary:hover, .bg-blue-600:hover {
          background: #1d4ed8 !important;
        }
        .modern-btn-danger, .bg-red-600 {
          background: #dc2626 !important;
          color: #fff !important;
        }
        .modern-btn-danger:hover, .bg-red-600:hover {
          background: #b91c1c !important;
        }
        .modern-btn-secondary, .bg-gray-800 {
          background: #22223b !important;
          color: #fff !important;
        }
        .modern-btn-secondary:hover, .bg-gray-900 {
          background: #1a1a2e !important;
        }
        .modern-modal, .fixed.inset-0.bg-black.bg-opacity-50 {
          z-index: 1000;
        }
        .modern-modal .bg-white {
          border-radius: 1.25rem;
          max-width: 95vw;
        }
        .modern-table, table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }
        .modern-table th, .modern-table td, table th, table td {
          padding: 0.75rem 0.5rem;
          font-size: 1rem;
        }
        .modern-table th {
          background: #f1f5f9;
          font-weight: 700;
        }
        .modern-table-responsive, .overflow-x-auto {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        @media (max-width: 640px) {
          html, body {
            font-size: 15px;
          }
          .max-w-4xl, .max-w-2xl, .max-w-md {
            max-width: 100vw !important;
            padding-left: 0.5rem !important;
            padding-right: 0.5rem !important;
          }
          .p-6, .p-8, .p-4 {
            padding: 1rem !important;
          }
          .rounded-xl, .rounded-lg {
            border-radius: 1rem !important;
          }
          .modern-table th, .modern-table td, table th, table td {
            padding: 0.5rem 0.25rem;
            font-size: 0.95rem;
          }
          .modern-modal .bg-white {
            padding: 1rem !important;
            max-width: 98vw;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
        showMessage('You have been logged out.', 'success');
        // No need to set page to 'login', onAuthStateChanged will handle it
      } catch (error) {
        console.error("Logout Error:", error);
        showMessage(`Logout failed: ${error.message}`, 'error');
      }
    }
  };

  const handleViewMyAccount = () => {
    setCurrentPage('user-account');
  };

  const handleGoHome = () => {
    if (userRole === 'admin') {
      setCurrentPage('admin');
    } else {
      setCurrentPage('patron');
    }
  };

  if (loading || !isAuthReady) {
    return <LoadingSpinner text={loadingText} logoUrl={logoUrl} />;
  }

  return (
    <PersistentCameraProvider>
      <FirebaseContext.Provider value={{
        db,
        auth,
        currentUser,
        userId,
        userRole,
        isAuthReady,
        loading,
        currentPage,
        message,
        messageType,
        logoUrl,
        appName,
        loadingText,
        quaggaScriptLoaded,
        customAppId,
        showMessage,
        handleLogout,
        handleViewMyAccount,
        handleGoHome,
        activeLoans,
        filteredLoans,
        loadingActiveLoans,
        users,
        setActiveLoans,
        setFilteredLoans,
        setLoadingActiveLoans,
        setUsers,
        loanPeriodDays,
        renewPeriodDays
      }}>
        <div className="min-h-screen bg-gray-100 font-sans">
          {message && <div className={`fixed top-0 left-0 right-0 p-4 text-white text-center z-50 ${messageType === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{message}</div>}

          {currentPage !== 'login' && (
            <NavBar
              userRole={userRole}
              onLogout={handleLogout}
              onGoHome={handleGoHome}
              onViewAccount={handleViewMyAccount}
              logoUrl={logoUrl}
              appName={appName}
            />
          )}

          <main className="w-full max-w-4xl mx-auto p-8">
            {/* This is a simple router. It renders a component based on the currentPage state. */}
            {currentPage === 'login' && <AuthPage setCurrentPage={setCurrentPage} />}
            {currentPage === 'admin' && <AdminDashboard />}
            {currentPage === 'patron' && <PatronDashboard />}
            {currentPage === 'user-account' && <UserAccount />}
          </main>
        </div>
      </FirebaseContext.Provider>
    </PersistentCameraProvider>
  );
};

export default App;
export { useFirebase };
      