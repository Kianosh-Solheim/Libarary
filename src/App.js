/* global grecaptcha */
import './App.css';
import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
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
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  addDoc,
  getDocs
} from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

// Define the Firebase context
const FirebaseContext = createContext(null);

// Custom hook to use Firebase
const useFirebase = () => useContext(FirebaseContext);

const App = () => {
  // State for Firebase instances
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'admin', 'patron', or null
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('login'); // 'login', 'admin', 'patron'
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  // New states for global app settings
  const [logoUrl, setLogoUrl] = useState("https://placehold.co/60x60/3b82f6/ffffff?text=LIB"); // Default logo
  const [loadingText, setLoadingText] = useState("Loading Library..."); // Default loading text


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
          } else {
            // Set default settings if document doesn't exist
            await setDoc(settingsDocRef, {
              logoUrl: "https://placehold.co/60x60/3b82f6/ffffff?text=LIB",
              loadingText: "Loading Library...",
            });
            setLogoUrl("https://placehold.co/60x60/3b82f6/ffffff?text=LIB");
            setLoadingText("Loading Library...");
          }
        }, (error) => {
          console.error("Error fetching app settings:", error);
          showMessage(`Error loading app settings: ${error.message}`, 'error');
        });


        // Always sign in anonymously if custom config is used.
        // This ensures a user is always authenticated with some UID, even if it's anonymous.
        await signInAnonymously(firebaseAuth);
        console.log("App - Initializing: Signed in anonymously using provided Firebase config.");

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
                // Update currentUser with more data like name from Firestore
                setCurrentUser(prevUser => ({ ...prevUser, ...userData }));
                console.log("App - onAuthStateChanged: User data from Firestore:", userData);
                console.log("Current user role (from Firestore):", userData.role);
                if (userData.role === 'admin') {
                  setCurrentPage('admin');
                } else {
                  setCurrentPage('patron');
                }
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
  }, []);

  const handleLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
        showMessage('Successfully logged out.', 'success');
        setCurrentPage('login');
        console.log("App - Logout: User logged out.");
      }
    } catch (error) {
      console.error("App - Logout Error:", error);
      showMessage(`Logout failed: ${error.message}`, 'error');
    }
  };

  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  if (loading || !isAuthReady) {
    return <LoadingSpinner text={loadingText} logoUrl={logoUrl} />;
  }

  return (
    <FirebaseContext.Provider value={{ db, auth, userId, userRole, currentUser, showMessage, setCurrentPage, customAppId, logoUrl, loadingText }}>
      {/* Load QuaggaJS from CDN globally when the app mounts */}
      <script src="https://unpkg.com/quagga@0.12.1/dist/quagga.min.js"></script>

      <div className="min-h-screen bg-gray-100 font-inter flex flex-col items-center p-4">
        <header className="w-full max-w-4xl bg-white text-gray-800 p-4 rounded-b-xl shadow-lg flex justify-between items-center mb-6">
          <div className="flex items-center">
            {/* Removed shadow from logo */}
            {logoUrl && <img src={logoUrl} alt="Library Logo" className="h-10 w-10 mr-3 object-contain" onError={(e) => e.target.src = "https://placehold.co/40x40/3b82f6/ffffff?text=LIB"} />}
            <h1 className="text-3xl font-playfair-display font-bold rounded-lg px-2 py-1 text-gray-900">BIBLIOTHECA SOLHEIMENSIS</h1>
          </div>
          {userId && (
            <div className="flex items-center space-x-4">
              <button
                className="bg-gray-800 hover:bg-gray-900 text-white font-semibold py-2 px-4 rounded-md shadow-md border border-gray-800 transition duration-300 ease-in-out transform hover:scale-105"
              >
                {currentUser?.name || currentUser?.email || 'User'}
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
              >
                Logout
              </button>
            </div>
          )}
        </header>

        {message && (
          <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-xl text-white ${messageType === 'success' ? 'bg-green-500' : 'bg-red-500'} z-50 transition-transform transform duration-300 ease-out animate-fade-in-down`}>
            {message}
          </div>
        )}

        <main className="w-full max-w-4xl bg-white rounded-xl shadow-2xl p-6 flex flex-col items-center">
          {currentPage === 'login' && <AuthPage setCurrentPage={setCurrentPage} />}
          {currentPage === 'admin' && userRole === 'admin' && <AdminDashboard />}
          {currentPage === 'patron' && userRole === 'patron' && <PatronDashboard />}
          {(currentPage === 'admin' && userRole !== 'admin') && (
            <div className="text-center text-red-600 text-lg p-8">
              You do not have administrative privileges to view this page.
            </div>
          )}
        </main>
      </div>
    </FirebaseContext.Provider>
  );
};

// Loading Spinner Component
const LoadingSpinner = ({ text = 'Loading...', logoUrl }) => (
  <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 z-50">
    <div className="flex flex-col items-center text-white">
      {logoUrl && <img src={logoUrl} alt="Loading Logo" className="h-20 w-20 mb-4 object-contain" onError={(e) => e.target.src = "https://placehold.co/80x80/3b82f6/ffffff?text=LIB"} />}
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
      <p className="mt-4 text-lg">{text}</p>
    </div>
  </div>
);

// Auth Page Component
const AuthPage = ({ setCurrentPage }) => {
  const { auth, showMessage, db, logoUrl } = useFirebase();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cardPin, setCardPin] = useState('');
  const [registerRole, setRegisterRole] = useState('patron');

  const { customAppId: appId } = useFirebase(); // Get appId from context

  const handleAuth = async (e) => {
    if (e) {
      e.preventDefault();
    }
    try {
      if (!auth) {
        showMessage('Authentication service not available.', 'error');
        return;
      }
      console.log(`AuthPage - handleAuth: Attempting ${isLogin ? 'login' : 'registration'} for email: ${email}`);

      if (isLogin) {
        // Login Logic
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
          console.log("AuthPage - handleAuth: Login successful for user UID:", user.uid);
          const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            console.log("AuthPage - handleAuth: User data from Firestore:", userData);
            // Only check cardPin for patrons and if a PIN exists in userData
            if (userData.role === 'patron' && userData.cardPin && userData.cardPin !== cardPin) {
                showMessage('Incorrect Card PIN.', 'error');
                await signOut(auth); // Log out if PIN is incorrect
                return;
            }
            showMessage(`Welcome back, ${userData.email || 'Patron'}!`, 'success');
          } else {
            console.warn("AuthPage - handleAuth: User signed in via Auth, but Firestore document missing for UID:", user.uid);
            showMessage('User data not found in Firestore. Please register or contact support.', 'error');
            await signOut(auth); // Log out to prevent inconsistent state
            return;
          }
        } catch (error) {
          console.error("AuthPage - handleAuth: Login failed:", error);
          showMessage(`Authentication failed: ${error.message}. Ensure Email/Password sign-in is enabled in Firebase Auth.`, 'error');
          return;
        }
      } else {
        // Register Logic
        console.log("AuthPage - handleAuth: Attempting registration for email:", email);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("AuthPage - handleAuth: Registration successful for user UID:", user.uid);
        const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid);
        await setDoc(userDocRef, {
          email: user.email,
          role: registerRole,
          uid: user.uid,
          createdAt: new Date(),
          cardPin: registerRole === 'patron' ? cardPin : undefined,
          loans: []
        }, { merge: true }); // Ensure merge for new fields
        showMessage(`${registerRole.charAt(0).toUpperCase() + registerRole.slice(1)} registered successfully!`, 'success');
        setIsLogin(true); // Switch to login after successful registration
      }
    } catch (error) {
      console.error("AuthPage - handleAuth: General Auth Error:", error);
      showMessage(`Authentication failed: ${error.message}. Please check your credentials and Firebase Auth settings.`, 'error');
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8">
      {logoUrl && <img src={logoUrl} alt="Library Logo" className="h-20 w-20 mx-auto mb-6 object-contain" onError={(e) => e.target.src = "https://placehold.co/80x80/3b82f6/ffffff?text=LIB"} />}
      <h2 className="text-3xl font-playfair-display font-extrabold text-gray-800 mb-6 text-center">
        {isLogin ? 'Login' : 'Register'}
      </h2>
      <form onSubmit={handleAuth} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="your@example.2com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="********"
          />
        </div>
        {/* Corrected conditional logic for Card PIN field */}
        {((!isLogin && registerRole === 'patron') || isLogin) && ( // Simplified: Show if registering as patron, or if logging in (could be a patron)
            <div>
                <label htmlFor="cardPin" className="block text-sm font-medium text-gray-700">
                    Card PIN (for Patrons)
                </label>
                <input
                    id="cardPin"
                    type="password"
                    value={cardPin}
                    onChange={(e) => setCardPin(e.target.value)}
                    // PIN is required during patron registration or for any login attempt (as it might be a patron)
                    required={(!isLogin && registerRole === 'patron') || isLogin}
                    className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="e.g., 1234"
                />
            </div>
        )}
        {!isLogin && (
          <div>
            <label htmlFor="registerRole" className="block text-sm font-medium text-gray-700">
              Register As
            </label>
            <select
              id="registerRole"
              value={registerRole}
              onChange={(e) => setRegisterRole(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="patron">Patron</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        )}
        <div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isLogin ? 'Login' : 'Register'}
          </button>
        </div>
      </form>
      <div className="mt-6 text-center">
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-blue-600 hover:underline text-sm font-medium mt-4"
        >
          {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  );
};

// Admin Dashboard Component
const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('books'); // 'books', 'users', 'lend-books', 'process-returns', 'manage-returns', 'settings'
  const { db, showMessage, userRole, customAppId: appId } = useFirebase();

  // Removed handlePopulateCatalogue as per user request

  const [loading, setLoading] = useState(false); // Local loading state for populate button

  return (
    <div className="w-full flex flex-col items-center">
      <h2 className="text-4xl font-playfair-display font-extrabold text-gray-800 mb-8 mt-4 text-center">
        Admin Dashboard
      </h2>
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-md p-2 flex justify-center space-x-2 mb-6">
        <button
          onClick={() => setActiveTab('books')}
          className={`flex-1 py-2 px-4 rounded-md font-semibold transition duration-300 ${activeTab === 'books' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Manage Books
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-2 px-4 rounded-md font-semibold transition duration-300 ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Manage Users
        </button>
        <button
          onClick={() => setActiveTab('lend-books')}
          className={`flex-1 py-2 px-4 rounded-md font-semibold transition duration-300 ${activeTab === 'lend-books' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Lend Books
        </button>
        <button
          onClick={() => setActiveTab('process-returns')}
          className={`flex-1 py-2 px-4 rounded-md font-semibold transition duration-300 ${activeTab === 'process-returns' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Process Returns
        </button>
        <button
          onClick={() => setActiveTab('manage-returns')}
          className={`flex-1 py-2 px-4 rounded-md font-semibold transition duration-300 ${activeTab === 'manage-returns' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Review Requests
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2 px-4 rounded-md font-semibold transition duration-300 ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Settings
        </button>
      </div>

      {/* Removed Populate Catalogue button */}

      <div className="w-full max-w-4xl p-4">
        {activeTab === 'books' && <ManageBooks />}
        {activeTab === 'users' && <ManageUsers />}
        {activeTab === 'lend-books' && <LendBooks />}
        {activeTab === 'process-returns' && <AdminProcessReturns />}
        {activeTab === 'manage-returns' && <ManageReturns />}
        {activeTab === 'settings' && <AdminSettings />}
      </div>
    </div>
  );
};

// Manage Books Component (Admin)
const ManageBooks = () => {
  const { db, showMessage, userRole, customAppId: appId } = useFirebase();
  const [books, setBooks] = useState([]);
  const [newBook, setNewBook] = useState({
    title: '',
    author: '',
    isbn: '',
    description: '', // Added description
    language: '',    // Added language
    copies: 1,
    available: 1
  });
  const [editingBookId, setEditingBookId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // New states for ISBN lookup functionality
  const [isbnToFetch, setIsbnToFetch] = useState('');
  const [fetchingBookInfo, setFetchingBookInfo] = useState(false);
  const [fetchedCoverUrl, setFetchedCoverUrl] = useState(null);


  useEffect(() => {
    if (!db) return;

    console.log("ManageBooks - useEffect: Current user role:", userRole); // ADDED LOG
    setFetchError(null);
    const q = collection(db, 'artifacts', appId, 'books'); // Corrected path
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const booksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("ManageBooks - Fetched books data:", booksData); // Log fetched data
      setBooks(booksData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching books:", error);
      showMessage(`Error fetching books: ${error.message}`, 'error');
      setFetchError(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, appId, showMessage, userRole]); // Added userRole to dependencies

  // Function to fetch book details from Open Library API
  const fetchBookDetailsByISBN = async () => {
    if (!isbnToFetch) {
      showMessage('Please enter an ISBN to fetch book information.', 'error');
      return;
    }

    setFetchingBookInfo(true);
    setFetchedCoverUrl(null); // Clear previous cover
    let bookFound = false;
    let fetchedTitle = '';
    let fetchedAuthor = '';
    let fetchedDescription = '';
    let fetchedLanguage = '';
    let fetchedCover = null;

    // --- Try Open Library API ---
    try {
      const openLibraryApiUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbnToFetch}&format=json&jscmd=data`;
      const openLibraryResponse = await fetch(openLibraryApiUrl);
      const openLibraryData = await openLibraryResponse.json();

      if (openLibraryData && openLibraryData[`ISBN:${isbnToFetch}`]) {
        const bookEntry = openLibraryData[`ISBN:${isbnToFetch}`];
        fetchedTitle = bookEntry.title || '';
        fetchedAuthor = bookEntry.authors && bookEntry.authors.length > 0 ? bookEntry.authors[0].name : '';
        // Open Library description can be a string or an object with a 'value' key
        fetchedDescription = (bookEntry.details && bookEntry.details.description) ?
                             (typeof bookEntry.details.description === 'object' ? bookEntry.details.description.value : bookEntry.details.description) : '';
        fetchedLanguage = (bookEntry.details && bookEntry.details.languages && bookEntry.details.languages.length > 0) ? bookEntry.details.languages[0].key.split('/').pop() : ''; // e.g., /languages/eng -> eng
        fetchedCover = bookEntry.cover && bookEntry.cover.large ? bookEntry.cover.large :
                       (bookEntry.thumbnail_url ? bookEntry.thumbnail_url.replace('-S.jpg', '-L.jpg') : null); // Attempt to get large from thumbnail

        if (fetchedTitle) { // Consider it found if at least a title is present
          bookFound = true;
          showMessage('Book information fetched successfully from Open Library!', 'success');
        } else {
            console.log("Open Library: No sufficient book information found for this ISBN.");
        }
      } else {
        console.log("Open Library: No entry found for this ISBN or API structure unexpected.");
      }
    } catch (error) {
      console.error("Error fetching book details from Open Library:", error);
      showMessage(`Failed to fetch book info from Open Library: ${error.message}. Trying another provider.`, 'error');
    }

    // --- If not found, try Google Books API ---
    if (!bookFound) {
      try {
        const googleBooksApiUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbnToFetch}`;
        const googleBooksResponse = await fetch(googleBooksApiUrl);
        const googleBooksData = await googleBooksResponse.json();

        if (googleBooksData.items && googleBooksData.items.length > 0) {
          const volumeInfo = googleBooksData.items[0].volumeInfo;
          fetchedTitle = volumeInfo.title || '';
          fetchedAuthor = volumeInfo.authors && volumeInfo.authors.length > 0 ? volumeInfo.authors[0] : '';
          fetchedDescription = volumeInfo.description || '';
          fetchedLanguage = volumeInfo.language || ''; // e.g., 'en'
          fetchedCover = volumeInfo.imageLinks && volumeInfo.imageLinks.thumbnail ? volumeInfo.imageLinks.thumbnail :
                           volumeInfo.imageLinks && volumeInfo.imageLinks.smallThumbnail ? volumeInfo.imageLinks.smallThumbnail : null;

          if (fetchedTitle) { // Consider it found if at least a title is present
            bookFound = true;
            showMessage('Book information fetched successfully from Google Books!', 'success');
          } else {
              console.log("Google Books: No sufficient book information found for this ISBN.");
          }
        } else {
          console.log("Google Books: No book information found for this ISBN.");
        }
      } catch (error) {
        console.error("Error fetching book details from Google Books:", error);
        showMessage(`Failed to fetch book info from Google Books: ${error.message}.`, 'error');
      }
    }

    if (bookFound) {
      setNewBook(prev => ({
        ...prev,
        title: fetchedTitle,
        author: fetchedAuthor,
        isbn: isbnToFetch, // Always use the ISBN entered by the user
        description: fetchedDescription,
        language: fetchedLanguage,
      }));
      setFetchedCoverUrl(fetchedCover);
    } else {
      showMessage('Book not found for this ISBN from any provider. Please enter details manually.', 'error');
      setNewBook(prev => ({ ...prev, isbn: isbnToFetch, title: '', author: '', description: '', language: '' })); // Keep ISBN, clear other fields
      setFetchedCoverUrl(null);
    }

    setFetchingBookInfo(false);
  };


  const handleAddBook = async (e) => {
    e.preventDefault();
    if (!db) return;

    if (userRole !== 'admin') {
      showMessage('You must be an administrator to add books.', 'error');
      return;
    }

    try {
      if (newBook.copies < 1 || newBook.available < 0 || newBook.available > newBook.copies) {
        showMessage('Invalid number of copies or availability.', 'error');
        return;
      }
      const existingBookQuery = query(collection(db, 'artifacts', appId, 'books'), where('isbn', '==', newBook.isbn)); // Corrected path
      const existingBookSnapshot = await getDocs(existingBookQuery);

      if (!existingBookSnapshot.empty) {
        showMessage('Book with this ISBN already exists.', 'error');
        return;
      }

      await addDoc(collection(db, 'artifacts', appId, 'books'), { // Corrected path
        ...newBook,
        copies: Number(newBook.copies),
        available: Number(newBook.available),
        createdAt: new Date(),
        coverUrl: fetchedCoverUrl || null, // Save the fetched cover URL
      });
      showMessage('Book added successfully!', 'success');
      setNewBook({ title: '', author: '', isbn: '', description: '', language: '', copies: 1, available: 1 });
      setIsbnToFetch('');
      setFetchedCoverUrl(null); // Clear after adding
    } catch (error) {
      console.error("Error adding book:", error);
      showMessage(`Error adding book: ${error.message}`, 'error');
    }
  };

  const handleEditBook = (book) => {
    setEditingBookId(book.id);
    setNewBook({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      description: book.description || '', // Load existing description
      language: book.language || '',      // Load existing language
      copies: book.copies,
      available: book.available
    });
    setFetchedCoverUrl(book.coverUrl || null); // Load existing cover for editing
    setIsbnToFetch(book.isbn); // Pre-fill ISBN for fetching if needed
  };

  const handleUpdateBook = async (e) => {
    e.preventDefault();
    if (!db || !editingBookId) return;

    if (userRole !== 'admin') {
      showMessage('You must be an administrator to update books.', 'error');
      return;
    }

    try {
      if (newBook.copies < 1 || newBook.available < 0 || newBook.available > newBook.copies) {
        showMessage('Invalid number of copies or availability.', 'error');
        return;
      }
      const bookRef = doc(db, 'artifacts', appId, 'books', editingBookId); // Corrected path
      await updateDoc(bookRef, {
        title: newBook.title,
        author: newBook.author,
        isbn: newBook.isbn,
        description: newBook.description, // Update description
        language: newBook.language,       // Update language
        copies: Number(newBook.copies),
        available: Number(newBook.available),
        coverUrl: fetchedCoverUrl || null, // Update with the new or existing cover URL
      });
      showMessage('Book updated successfully!', 'success');
      setEditingBookId(null);
      setNewBook({ title: '', author: '', isbn: '', description: '', language: '', copies: 1, available: 1 });
      setIsbnToFetch('');
      setFetchedCoverUrl(null); // Clear after updating
    } catch (error) {
      console.error("Error updating book:", error);
      showMessage(`Error updating book: ${error.message}`, 'error');
    }
  };

  const handleDeleteBook = async (bookId) => {
    if (!db) return;

    if (userRole !== 'admin') {
      showMessage('You must be an administrator to delete books.', 'error');
      return;
    }

    try {
      const loansQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), where('bookId', '==', bookId), where('returned', '==', false));
      const loansSnapshot = await getDocs(loansQuery);

      if (!loansSnapshot.empty) {
        showMessage('Cannot delete book: it has active loans.', 'error');
        return;
      }

      await deleteDoc(doc(db, 'artifacts', appId, 'books', bookId)); // Corrected path
      showMessage('Book deleted successfully!', 'success');
    } catch (error) {
      console.error("Error deleting book:", error);
      showMessage(`Error deleting book: ${error.message}`, 'error');
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading books..." />;
  }

  if (fetchError) {
    return (
      <div className="w-full text-center p-8 bg-red-100 rounded-lg shadow-md text-red-700">
        <h3 className="text-2xl font-playfair-display font-bold mb-4">Error Loading Books</h3>
        <p>There was an issue fetching book data.</p>
        <p className="mt-2 font-mono text-sm">Error: {fetchError.message}</p>
        <p className="mt-4 text-gray-600">This is often due to **missing or insufficient permissions** in your Firebase Security Rules or because the `books` collection is empty or inaccessible. Please verify your Firebase setup.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-3xl font-playfair-display font-bold text-gray-800 mb-6 text-center">Manage Books</h3>

      {userRole !== 'admin' && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Access Denied!</strong>
          <span className="block sm:inline"> You must be an administrator to manage books.</span>
          <span className="block sm:inline"> Please log in as an admin or use the "Make Me Admin" button.</span>
        </div>
      )}

      <div className="bg-blue-50 p-6 rounded-lg shadow-md mb-8">
        <h4 className="text-2xl font-playfair-display font-semibold text-gray-700 mb-4">Fetch Book Information by ISBN</h4>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            type="text"
            placeholder="Enter ISBN to fetch"
            value={isbnToFetch}
            onChange={(e) => setIsbnToFetch(e.target.value)}
            className="flex-1 p-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            disabled={userRole !== 'admin' || fetchingBookInfo}
          />
          <button
            onClick={fetchBookDetailsByISBN}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={userRole !== 'admin' || fetchingBookInfo || !isbnToFetch}
          >
            {fetchingBookInfo ? 'Fetching...' : 'Fetch Book Info'}
          </button>
        </div>
        {fetchedCoverUrl && (
          <div className="flex justify-center mb-4">
            <img src={fetchedCoverUrl} alt="Book Cover" className="w-32 h-auto rounded-md shadow-lg object-contain" onError={(e) => e.target.src = "https://placehold.co/128x192/E0E0E0/424242?text=No+Cover"} />
          </div>
        )}
      </div>

      <div className="bg-blue-50 p-6 rounded-lg shadow-md mb-8">
        <h4 className="text-2xl font-playfair-display font-semibold text-gray-700 mb-4">{editingBookId ? 'Edit Book' : 'Add New Book'}</h4>
        <form onSubmit={editingBookId ? handleUpdateBook : handleAddBook} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Title"
            value={newBook.title}
            onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
            required
            className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={userRole !== 'admin'}
          />
          <input
            type="text"
            placeholder="Author"
            value={newBook.author}
            onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
            required
            className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={userRole !== 'admin'}
          />
          <input
            type="text"
            placeholder="ISBN"
            value={newBook.isbn}
            onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
            required
            className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={userRole !== 'admin'}
          />
          <textarea
            placeholder="Description"
            value={newBook.description}
            onChange={(e) => setNewBook({ ...newBook, description: e.target.value })}
            className="col-span-1 md:col-span-2 p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
            disabled={userRole !== 'admin'}
          />
          <input
            type="text"
            placeholder="Language (e.g., en, fr)"
            value={newBook.language}
            onChange={(e) => setNewBook({ ...newBook, language: e.target.value })}
            className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={userRole !== 'admin'}
          />
          <input
            type="url"
            placeholder="Cover Photo URL (optional, overrides fetched)"
            value={fetchedCoverUrl || ''} // Display fetched URL or empty string
            onChange={(e) => setFetchedCoverUrl(e.target.value)} // Allow manual override
            className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={userRole !== 'admin'}
          />
          <input
            type="number"
            placeholder="Copies"
            value={newBook.copies}
            onChange={(e) => setNewBook({ ...newBook, copies: e.target.value })}
            required
            min="1"
            className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={userRole !== 'admin'}
          />
          <input
            type="number"
            placeholder="Available Copies"
            value={newBook.available}
            onChange={(e) => setNewBook({ ...newBook, available: e.target.value })}
            required
            min="0"
            max={newBook.copies}
            className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={userRole !== 'admin'}
          />
          <button
            type="submit"
            className="col-span-1 md:col-span-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            disabled={userRole !== 'admin'}
          >
            {editingBookId ? 'Update Book' : 'Add Book'}
          </button>
          {editingBookId && (
            <button
              type="button"
              onClick={() => {
                setEditingBookId(null);
                setNewBook({ title: '', author: '', isbn: '', description: '', language: '', copies: 1, available: 1 });
                setIsbnToFetch('');
                setFetchedCoverUrl(null);
              }}
              className="col-span-1 md:col-span-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              Cancel Edit
            </button>
          )}
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h4 className="text-2xl font-playfair-display font-semibold text-gray-700 mb-4">Book List</h4>
        {books.length === 0 ? (
          <p className="text-center text-gray-500">No books in the library yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cover</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ISBN</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Language</th> {/* Added Language Header */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Copies</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {books.map((book) => (
                  <tr key={book.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {book.coverUrl ? (
                        <img src={book.coverUrl} alt="Cover" className="w-12 h-auto rounded-md object-contain" onError={(e) => e.target.src = "https://placehold.co/48x72/E0E0E0/424242?text=No+Cover"}/>
                      ) : (
                        <img src="https://placehold.co/48x72/E0E0E0/424242?text=No+Cover" alt="No Cover" className="w-12 h-auto rounded-md object-contain"/>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{book.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.author}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.isbn}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.language || 'N/A'}</td> {/* Display Language */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.copies}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.available}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditBook(book)}
                        className="text-blue-600 hover:text-blue-900 mr-4 transition duration-300 ease-in-out transform hover:scale-110"
                        disabled={userRole !== 'admin'}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteBook(book.id)}
                        className="text-red-600 hover:text-red-900 transition duration-300 ease-in-out transform hover:scale-110"
                        disabled={userRole !== 'admin'}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// Manage Users Component (Admin)
const ManageUsers = () => {
  const { db, auth, showMessage, userRole, customAppId: appId } = useFirebase();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    cardPin: '',
    role: 'patron',
    name: '', // New field
    libraryCardId: '', // New field
    address: '' // New field
  });
  const [editingUserId, setEditingUserId] = useState(null); // ID of user being edited
  const [viewingUserId, setViewingUserId] = useState(null); // ID of user whose profile is being viewed (read-only)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserLoans, setSelectedUserLoans] = useState([]);
  const [loadingLoans, setLoadingLoans] = useState(false);

  useEffect(() => {
    if (!db) return;

    setFetchError(null);
    const usersCollectionRef = collection(db, 'artifacts', appId, 'users');
    const loansCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'loans');

    const unsubscribe = onSnapshot(usersCollectionRef, async (usersSnapshot) => {
      const usersDataPromises = usersSnapshot.docs.map(async (userDoc) => {
        const userData = { id: userDoc.id, ...userDoc.data() };

        // Fetch loans for this specific user
        const loansQuery = query(loansCollectionRef, where('userId', '==', userData.uid));
        const loansSnapshot = await getDocs(loansQuery);
        const userLoans = loansSnapshot.docs.map(loanDoc => ({ id: loanDoc.id, ...loanDoc.data() }));

        // Count currently loaned books
        const currentLoansCount = userLoans.filter(loan => !loan.returned).length;

        return { ...userData, currentLoansCount, allLoans: userLoans };
      });

      const usersWithLoans = await Promise.all(usersDataPromises);
      setUsers(usersWithLoans);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users or their loans:", error);
      showMessage(`Error fetching users or their loans: ${error.message}`, 'error');
      setFetchError(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, appId, showMessage]);

  const handleUpdateUserRole = async (userId, newRole) => {
    if (!db) return;
    if (userRole !== 'admin') {
      showMessage('You must be an administrator to update user roles.', 'error');
      return;
    }
    try {
      const userRef = doc(db, 'artifacts', appId, 'users', userId);
      await updateDoc(userRef, { role: newRole });
      showMessage('User role updated successfully!', 'success');
    } catch (error) {
      console.error("Error updating user role:", error);
      showMessage(`Error updating user role: ${error.message}`, 'error');
    }
  };

  const handleDeleteUser = async (userIdToDelete) => {
    if (!db) return;
    if (userRole !== 'admin') {
      showMessage('You must be an administrator to delete users.', 'error');
      return;
    }
    try {
      const loansQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), where('userId', '==', userIdToDelete), where('returned', '==', false));
      const loansSnapshot = await getDocs(loansQuery);

      if (!loansSnapshot.empty) {
        showMessage('Cannot delete user: user has active loans.', 'error');
        return;
      }
      await deleteDoc(doc(db, 'artifacts', appId, 'users', userIdToDelete));
      showMessage('User deleted successfully!', 'success');
    } catch (error) {
      console.error("Error deleting user:", error);
      showMessage(`Error deleting user: ${error.message}`, 'error');
    }
  };

  const handleAddUserByAdmin = async (e) => {
    e.preventDefault();
    if (!auth || !db) {
      showMessage('Firebase services not available.', 'error');
      return;
    }
    if (userRole !== 'admin') {
      showMessage('You must be an administrator to add users.', 'error');
      return;
    }

    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, newUser.email, newUser.password);
      const user = userCredential.user;

      // Save user details to Firestore
      const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid);
      await setDoc(userDocRef, {
        email: newUser.email,
        role: newUser.role,
        uid: user.uid,
        createdAt: new Date(),
        cardPin: newUser.cardPin,
        name: newUser.name, // Save new field
        libraryCardId: newUser.libraryCardId, // Save new field
        address: newUser.address, // Save new field
        loans: [] // Initialize loans array
      });

      showMessage(`${newUser.role.charAt(0).toUpperCase() + newUser.role.slice(1)} "${newUser.email}" added successfully!`, 'success');
      setNewUser({ email: '', password: '', cardPin: '', role: 'patron', name: '', libraryCardId: '', address: '' }); // Clear form
    } catch (error) {
      console.error("Error adding user:", error);
      showMessage(`Error adding user: ${error.message}`, 'error');
    }
  };

  const handleViewProfile = (user) => {
    setViewingUserId(user.id);
    setEditingUserId(null); // Ensure not in edit mode
    setNewUser({ // Pre-fill newUser state for display in profile or future edit
      email: user.email || '',
      cardPin: user.cardPin || '',
      role: user.role || 'patron',
      name: user.name || '',
      libraryCardId: user.libraryCardId || '',
      address: user.address || ''
    });
    setSelectedUserLoans(user.allLoans || []); // Set all loans for the selected user
  };

  const handleEditUserClick = (user) => {
    setEditingUserId(user.id);
    setViewingUserId(null); // Ensure not just viewing
    setNewUser({ // Pre-fill the form with current user data
      email: user.email || '',
      password: '', // Password is not editable directly here, keep it empty
      cardPin: user.cardPin || '',
      role: user.role || 'patron',
      name: user.name || '',
      libraryCardId: user.libraryCardId || '',
      address: user.address || ''
    });
    setSelectedUserLoans(user.allLoans || []); // Keep loans in state for history display if needed
  };


  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!db || !editingUserId) return;
    if (userRole !== 'admin') {
      showMessage('You must be an administrator to update users.', 'error');
      return;
    }

    try {
      const userRef = doc(db, 'artifacts', appId, 'users', editingUserId);
      await updateDoc(userRef, {
        email: newUser.email,
        cardPin: newUser.cardPin,
        role: newUser.role,
        name: newUser.name,
        libraryCardId: newUser.libraryCardId,
        address: newUser.address,
      });
      showMessage('User updated successfully!', 'success');
      setEditingUserId(null);
      setViewingUserId(null); // Go back to main list after update
      setNewUser({ email: '', password: '', cardPin: '', role: 'patron', name: '', libraryCardId: '', address: '' }); // Clear form
      setSelectedUserLoans([]); // Clear loan history
    } catch (error) {
      console.error("Error updating user:", error);
      showMessage(`Error updating user: ${error.message}`, 'error');
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setViewingUserId(null); // Go back to main list
    setNewUser({ email: '', password: '', cardPin: '', role: 'patron', name: '', libraryCardId: '', address: '' });
    setSelectedUserLoans([]); // Clear loan history
  };

  const handleBackToUserList = () => {
    setViewingUserId(null);
    setEditingUserId(null);
    setNewUser({ email: '', password: '', cardPin: '', role: 'patron', name: '', libraryCardId: '', address: '' });
    setSearchTerm(''); // Clear search when going back
    setSelectedUserLoans([]); // Clear loan history
  };

  const filteredUsers = users.filter(user => {
    const term = searchTerm.toLowerCase();
    return (
      (user.email && user.email.toLowerCase().includes(term)) ||
      (user.role && user.role.toLowerCase().includes(term)) ||
      (user.name && user.name.toLowerCase().includes(term)) ||
      (user.libraryCardId && user.libraryCardId.toLowerCase().includes(term)) ||
      (user.address && user.address.toLowerCase().includes(term)) ||
      (user.uid && user.uid.toLowerCase().includes(term))
    );
  });

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };


  if (loading) {
    return <LoadingSpinner text="Loading users..." />;
  }

  if (fetchError) {
    return (
      <div className="w-full text-center p-8 bg-red-100 rounded-lg shadow-md text-red-700">
        <h3 className="text-2xl font-playfair-display font-bold mb-4">Error Loading Users</h3>
        <p>There was an issue fetching user data.</p>
        <p className="mt-2 font-mono text-sm">Error: {fetchError.message}</p>
        <p className="mt-4 text-gray-600">This is often due to **missing or insufficient permissions** in your Firebase Security Rules for the `users` collection, or because the collection is empty. Please verify your Firebase setup.</p>
      </div>
    );
  }

  // Find the user object if we are viewing or editing one
  const targetUser = users.find(u => u.id === (viewingUserId || editingUserId));

  return (
    <div className="w-full">
      <h3 className="text-3xl font-playfair-display font-bold text-gray-800 mb-6 text-center">Manage Users</h3>

      {userRole !== 'admin' && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Access Denied!</strong>
          <span className="block sm:inline"> You must be an administrator to manage users.</span>
          <span className="block sm:inline"> Please log in as an admin or use the "Make Me Admin" button.</span>
        </div>
      )}

      {/* Conditional rendering for Add/Edit Form, User Profile, or User List */}
      {(editingUserId || viewingUserId) && (
        <button
          onClick={handleBackToUserList}
          className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 mb-4"
        >
          &larr; Back to User List
        </button>
      )}

      {!viewingUserId && !editingUserId && (
        <>
          <div className="bg-blue-50 p-6 rounded-lg shadow-md mb-8">
            <h4 className="text-2xl font-playfair-display font-semibold text-gray-700 mb-4">Add New User</h4>
            <form onSubmit={handleAddUserByAdmin} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="email"
                placeholder="User Email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                required
                className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                disabled={userRole !== 'admin'}
              />
              <input
                type="password"
                placeholder="Password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
                className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                disabled={userRole !== 'admin'}
              />
              <input
                type="text"
                placeholder="Full Name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                disabled={userRole !== 'admin'}
              />
              <input
                type="text"
                placeholder="Library Card ID"
                value={newUser.libraryCardId}
                onChange={(e) => setNewUser({ ...newUser, libraryCardId: e.target.value })}
                className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                disabled={userRole !== 'admin'}
              />
              <input
                type="text"
                placeholder="Address"
                value={newUser.address}
                onChange={(e) => setNewUser({ ...newUser, address: e.target.value })}
                className="col-span-1 md:col-span-2 p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                disabled={userRole !== 'admin'}
              />
              <input
                type="password"
                placeholder="Card PIN (for Patrons)"
                value={newUser.cardPin}
                onChange={(e) => setNewUser({ ...newUser, cardPin: e.target.value })}
                required={newUser.role === 'patron'}
                className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                disabled={userRole !== 'admin'}
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                disabled={userRole !== 'admin'}
              >
                <option value="patron">Patron</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="submit"
                className="col-span-1 md:col-span-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                disabled={userRole !== 'admin'}
              >
                Add User
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h4 className="text-2xl font-playfair-display font-semibold text-gray-700 mb-4">User List</h4>
            <input
              type="text"
              placeholder="Search users by any field..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 mb-4"
            />
            {filteredUsers.length === 0 ? (
              <p className="text-center text-gray-500">No users match your search or no users registered yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lib. Card ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Loans</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr></thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        onClick={() => handleViewProfile(user)} // Make row clickable for profile view
                        className="cursor-pointer hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.email || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.libraryCardId || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.currentLoansCount}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {/* The 'Edit' button here would now be for direct edit, if desired, or can be removed */}
                          {/* <button
                            onClick={(e) => { e.stopPropagation(); handleEditUserClick(user); }}
                            className="text-indigo-600 hover:text-indigo-900 mr-4 transition duration-300 ease-in-out transform hover:scale-110"
                            disabled={userRole !== 'admin'}
                          >
                            Edit
                          </button> */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteUser(user.id); }} // Stop propagation to prevent profile view
                            className="text-red-600 hover:text-red-900 transition duration-300 ease-in-out transform hover:scale-110"
                            disabled={userRole !== 'admin'}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* User Profile View (Read-Only) */}
      {viewingUserId && !editingUserId && targetUser && (
        <div className="w-full bg-white p-6 rounded-lg shadow-md">
          <h4 className="text-2xl font-playfair-display font-semibold text-gray-700 mb-4">User Profile: {targetUser.name || targetUser.email}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <p className="p-3 bg-gray-50 rounded-md"><strong>Email:</strong> {targetUser.email || 'N/A'}</p>
            <p className="p-3 bg-gray-50 rounded-md"><strong>Name:</strong> {targetUser.name || 'N/A'}</p>
            <p className="p-3 bg-gray-50 rounded-md"><strong>Library Card ID:</strong> {targetUser.libraryCardId || 'N/A'}</p>
            <p className="p-3 bg-gray-50 rounded-md"><strong>Role:</strong> {targetUser.role || 'N/A'}</p>
            <p className="col-span-1 md:col-span-2 p-3 bg-gray-50 rounded-md"><strong>Address:</strong> {targetUser.address || 'N/A'}</p>
            <p className="p-3 bg-gray-50 rounded-md"><strong>Firebase UID:</strong> {targetUser.uid}</p>
            <p className="p-3 bg-gray-50 rounded-md"><strong>Current Loans:</strong> {targetUser.currentLoansCount}</p>
          </div>
          <button
            onClick={() => handleEditUserClick(targetUser)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
            disabled={userRole !== 'admin'}
          >
            Edit User Details
          </button>

          <div className="bg-yellow-50 p-6 rounded-lg shadow-md mb-8 border border-yellow-200 w-full">
            <h4 className="text-2xl font-playfair-display font-semibold text-gray-700 mb-4">Loan History</h4>
            {selectedUserLoans.length === 0 ? (
              <p className="text-center text-gray-500">This user has no loan history.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Book Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr></thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedUserLoans.map((loan) => (
                      <tr key={loan.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{loan.bookTitle}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(loan.loanDate)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {loan.returned ? formatDate(loan.returnDate) : 'Still out'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {loan.status === 'on-loan' && !loan.returned && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              On Loan
                            </span>
                          )}
                          {loan.status === 'pending-return' && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              Pending Return
                            </span>
                          )}
                          {loan.returned && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Returned
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Edit Form */}
      {editingUserId && targetUser && (
        <div className="bg-blue-50 p-6 rounded-lg shadow-md mb-8">
          <h4 className="text-2xl font-playfair-display font-semibold text-gray-700 mb-4">Edit User: {targetUser.name || targetUser.email}</h4>
          <form onSubmit={handleUpdateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="email"
              placeholder="User Email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              required
              className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={userRole !== 'admin'}
            />
            <input
              type="text"
              placeholder="Full Name"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={userRole !== 'admin'}
            />
            <input
              type="text"
              placeholder="Library Card ID"
              value={newUser.libraryCardId}
              onChange={(e) => setNewUser({ ...newUser, libraryCardId: e.target.value })}
              className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={userRole !== 'admin'}
            />
            <input
              type="text" // Changed to text as PIN is often numeric but not a number for input type
              placeholder="Card PIN (for Patrons)"
              value={newUser.cardPin}
              onChange={(e) => setNewUser({ ...newUser, cardPin: e.target.value })}
              required={newUser.role === 'patron'}
              className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={userRole !== 'admin'}
            />
            <input
              type="text"
              placeholder="Address"
              value={newUser.address}
              onChange={(e) => setNewUser({ ...newUser, address: e.target.value })}
              className="col-span-1 md:col-span-2 p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={userRole !== 'admin'}
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={userRole !== 'admin'}
            >
              <option value="patron">Patron</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              className="col-span-1 md:col-span-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              disabled={userRole !== 'admin'}
            >
              Update User
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="col-span-1 md:col-span-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              Cancel Edit
            </button>
          </form>
          {/* Loan history displayed here if desired in edit mode */}
          {selectedUserLoans.length > 0 && (
             <div className="bg-yellow-50 p-6 rounded-lg shadow-md mb-8 border border-yellow-200 w-full mt-8">
             <h4 className="text-2xl font-playfair-display font-semibold text-gray-700 mb-4">Loan History for {newUser.name || newUser.email || newUser.uid}</h4>
             <div className="overflow-x-auto">
               <table className="min-w-full divide-y divide-gray-200">
                 <thead className="bg-gray-50"><tr>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Book Title</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Date</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return Date</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                 </tr></thead>
                 <tbody className="bg-white divide-y divide-gray-200">
                   {selectedUserLoans.map((loan) => (
                     <tr key={loan.id}>
                       <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{loan.bookTitle}</td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(loan.loanDate)}</td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                         {loan.returned ? formatDate(loan.returnDate) : 'Still out'}
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm">
                         {loan.status === 'on-loan' && !loan.returned && (
                           <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                             On Loan
                           </span>
                         )}
                         {loan.status === 'pending-return' && (
                           <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                             Pending Return
                           </span>
                         )}
                         {loan.returned && (
                           <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                             Returned
                           </span>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
          )}
        </div>
      )}
    </div>
  );
};

// Lend Books Component (Admin) - Renamed from LendReturnBooks
const LendBooks = () => {
  const { db, showMessage, userRole, customAppId: appId } = useFirebase();
  const [isbnInput, setIsbnInput] = useState('');
  const [libraryCardIdInput, setLibraryCardIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [operationError, setOperationError] = useState(null);

  const handleLendBook = async () => {
    if (!db) return;
    if (userRole !== 'admin') {
      showMessage('You must be an administrator to lend books.', 'error');
      return;
    }
    setLoading(true);
    setOperationError(null);

    try {
      // Find the book by ISBN
      const bookQuery = query(collection(db, 'artifacts', appId, 'books'), where('isbn', '==', isbnInput));
      const bookSnapshot = await getDocs(bookQuery);

      if (bookSnapshot.empty) {
        showMessage('Book not found with this ISBN.', 'error');
        setLoading(false);
        return;
      }
      const bookDoc = bookSnapshot.docs[0];
      const bookData = { id: bookDoc.id, ...bookDoc.data() };

      // Find the user by Library Card ID
      const userQuery = query(collection(db, 'artifacts', appId, 'users'), where('libraryCardId', '==', libraryCardIdInput));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        showMessage('User not found with this Library Card ID.', 'error');
        setLoading(false);
        return;
      }
      const userDoc = userSnapshot.docs[0];
      const userData = { id: userDoc.id, ...userDoc.data() }; // userData.id will be the Firebase UID

      if (bookData.available <= 0) {
        showMessage('No copies of this book are currently available for lending.', 'error');
        setLoading(false);
        return;
      }

      const existingLoanQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'loans'),
        where('bookId', '==', bookData.id),
        where('userId', '==', userData.id), // Use the actual Firebase UID from the user doc
        where('returned', '==', false)
      );
      const existingLoanSnapshot = await getDocs(existingLoanQuery);

      if (!existingLoanSnapshot.empty) {
        showMessage('This user already has this book on loan.', 'error');
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), {
        bookId: bookData.id,
        bookTitle: bookData.title,
        userId: userData.id, // Store Firebase UID
        userEmail: userData.email || 'N/A',
        loanDate: new Date(),
        returnDate: null,
        returned: false,
        status: 'on-loan' // Initial status
      });

      await updateDoc(doc(db, 'artifacts', appId, 'books', bookData.id), {
        available: bookData.available - 1,
      });

      showMessage(`"${bookData.title}" lent to ${userData.name || userData.email || userData.id} successfully!`, 'success');

      setIsbnInput('');
      setLibraryCardIdInput(''); // Clear Library Card ID input
    } catch (error) {
      console.error(`Error during lend operation:`, error);
      showMessage(`Operation failed: ${error.message}`, 'error');
      setOperationError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <h3 className="text-3xl font-playfair-display font-bold text-gray-800 mb-6 text-center">Lend Books</h3>

      {userRole !== 'admin' && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Access Denied!</strong>
          <span className="block sm:inline"> You must be an administrator to lend books.</span>
          <span className="block sm:inline"> Please log in as an admin or use the "Make Me Admin" button.</span>
        </div>
      )}

      <div className="bg-blue-50 p-6 rounded-lg shadow-md mb-8">
        <h4 className="text-2xl font-playfair-display font-semibold text-gray-700 mb-4">Lend Book Operation</h4>
        <div className="space-y-4">
          <p className="text-center text-gray-600">Simulate Barcode/NFC Scan:</p>
          <div>
            <label htmlFor="isbnInput" className="block text-sm font-medium text-gray-700">
              Book ISBN (simulated scan)
            </label>
            <input
              id="isbnInput"
              type="text"
              value={isbnInput}
              onChange={(e) => setIsbnInput(e.target.value)}
              placeholder="Enter Book ISBN"
              className="mt-1 block w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="libraryCardIdInput" className="block text-sm font-medium text-gray-700">
              User Library Card ID (simulated card scan)
            </label>
            <input
              id="libraryCardIdInput"
              type="text"
              value={libraryCardIdInput}
              onChange={(e) => setLibraryCardIdInput(e.target.value)}
              placeholder="Enter User Library Card ID"
              className="mt-1 block w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleLendBook}
            disabled={loading || !isbnInput || !libraryCardIdInput || userRole !== 'admin'}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Lend Book'}
          </button>
        </div>
      </div>
      {operationError && (
        <div className="w-full text-center p-4 bg-red-100 rounded-lg shadow-md text-red-700 mt-4">
          <p className="font-medium">Operation failed: {operationError.message}.</p>
          <p className="text-sm text-gray-600">This is likely due to **missing or insufficient permissions** in your Firebase Security Rules for `loans` or `books` collections. Please verify your Firebase setup.</p>
        </div>
      )}
    </div>
  );
};

// Admin Process Returns Component - NEW
const AdminProcessReturns = () => {
  const { db, showMessage, userRole, customAppId: appId } = useFirebase();
  const [activeLoans, setActiveLoans] = useState([]);
  const [selectedLoans, setSelectedLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    if (!db) return;

    setFetchError(null);
    // Fetch all active loans (not yet returned)
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), where('returned', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loansData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      loansData.sort((a, b) => b.loanDate.toDate() - a.loanDate.toDate()); // Sort by most recent loan
      setActiveLoans(loansData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching active loans:", error);
      showMessage(`Error fetching active loans: ${error.message}`, 'error');
      setFetchError(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, appId, showMessage]);

  const handleToggleLoanSelection = (loanId) => {
    setSelectedLoans(prevSelected =>
      prevSelected.includes(loanId)
        ? prevSelected.filter(id => id !== loanId)
        : [...prevSelected, loanId]
    );
  };

  const handleProcessSelectedReturns = async () => {
    if (!db) return;
    if (userRole !== 'admin') {
      showMessage('You must be an administrator to process returns.', 'error');
      return;
    }
    if (selectedLoans.length === 0) {
      showMessage('Please select at least one loan to process.', 'info');
      return;
    }

    setLoading(true);
    try {
      for (const loanId of selectedLoans) {
        const loan = activeLoans.find(l => l.id === loanId);
        if (!loan) continue; // Should not happen if data is consistent

        // 1. Mark the loan as returned
        const loanRef = doc(db, 'artifacts', appId, 'public', 'data', 'loans', loanId);
        await updateDoc(loanRef, {
          returnDate: new Date(),
          returned: true,
          status: 'returned'
        });

        // 2. Increment available copies of the book
        const bookRef = doc(db, 'artifacts', appId, 'books', loan.bookId);
        const bookSnap = await getDoc(bookRef);
        if (bookSnap.exists()) {
          const bookData = bookSnap.data();
          await updateDoc(bookRef, { available: bookData.available + 1 });
        } else {
          console.warn(`Book with ID ${loan.bookId} not found. Could not update available copies.`);
        }
      }
      showMessage(`Successfully processed ${selectedLoans.length} return(s)!`, 'success');
      setSelectedLoans([]); // Clear selection after processing
    } catch (error) {
      console.error("Error processing returns:", error);
      showMessage(`Failed to process returns: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <LoadingSpinner text="Loading active loans..." />;
  }

  if (fetchError) {
    return (
      <div className="w-full text-center p-8 bg-red-100 rounded-lg shadow-md text-red-700">
        <h3 className="text-2xl font-playfair-display font-bold mb-4">Error Loading Loans</h3>
        <p>There was an issue fetching active loan data.</p>
        <p className="mt-2 font-mono text-sm">Error: {fetchError.message}</p>
        <p className="mt-4 text-gray-600">This is often due to **missing or insufficient permissions** in your Firebase Security Rules for the `loans` collection, or because the collection is empty. Please verify your Firebase setup.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-3xl font-playfair-display font-bold text-gray-800 mb-6 text-center">Process Returns</h3>

      {userRole !== 'admin' && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Access Denied!</strong>
          <span className="block sm:inline"> You must be an administrator to process returns.</span>
          <span className="block sm:inline"> Please log in as an admin or use the "Make Me Admin" button.</span>
        </div>
      )}

      <div className="bg-blue-50 p-6 rounded-lg shadow-md mb-8">
        <h4 className="text-2xl font-playfair-display font-semibold text-gray-700 mb-4">Active Loans to Process</h4>
        <button
          onClick={handleProcessSelectedReturns}
          disabled={selectedLoans.length === 0 || loading || userRole !== 'admin'}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
        >
          {loading ? 'Processing...' : `Process Selected Returns (${selectedLoans.length})`}
        </button>

        {activeLoans.length === 0 ? (
          <p className="text-center text-gray-500">No books are currently on loan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Book Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Email/ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Date</th>
              </tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeLoans.map((loan) => (
                  <tr key={loan.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedLoans.includes(loan.id)}
                        onChange={() => handleToggleLoanSelection(loan.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        disabled={userRole !== 'admin'}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{loan.bookTitle}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{loan.userEmail || loan.userId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(loan.loanDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};


// Manage Returns Component (Admin) - for patron requests
const ManageReturns = () => {
  const { db, showMessage, userRole, customAppId: appId } = useFirebase();
  const [returnRequests, setReturnRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    if (!db) return;

    setFetchError(null);
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'returnRequests'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requestsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      requestsData.sort((a, b) => b.requestDate.toDate() - a.requestDate.toDate()); // Sort by most recent
      setReturnRequests(requestsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching return requests:", error);
      showMessage(`Error fetching return requests: ${error.message}`, 'error');
      setFetchError(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, appId, showMessage]);

  const handleApproveReturn = async (request) => {
    if (!db) return;
    if (userRole !== 'admin') {
      showMessage('You must be an administrator to approve returns.', 'error');
      return;
    }

    setLoading(true);
    try {
      // 1. Mark the original loan as returned
      const loanRef = doc(db, 'artifacts', appId, 'public', 'data', 'loans', request.loanId);
      await updateDoc(loanRef, {
        returnDate: new Date(),
        returned: true,
        status: 'returned',
      });

      // 2. Increment available copies of the book
      const bookRef = doc(db, 'artifacts', appId, 'books', request.bookId);
      const bookSnap = await getDoc(bookRef);
      if (bookSnap.exists()) {
        const bookData = bookSnap.data();
        await updateDoc(bookRef, { available: bookData.available + 1 });
      } else {
        console.warn("Book not found for return request, availability not updated:", request.bookId);
        showMessage('Book not found, availability not updated. Please check manually.', 'warn');
      }

      // 3. Delete the return request
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'returnRequests', request.id));

      showMessage(`Return for "${request.bookTitle}" by ${request.userEmail} approved!`, 'success');
    } catch (error) {
      console.error("Error approving return:", error);
      showMessage(`Failed to approve return: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <LoadingSpinner text="Loading return requests..." />;
  }

  if (fetchError) {
    return (
      <div className="w-full text-center p-8 bg-red-100 rounded-lg shadow-md text-red-700">
        <h3 className="text-2xl font-playfair-display font-bold mb-4">Error Loading Return Requests</h3>
        <p>There was an issue fetching return requests.</p>
        <p className="mt-2 font-mono text-sm">Error: {fetchError.message}</p>
        <p className="mt-4 text-gray-600">This is often due to **missing or insufficient permissions** in your Firebase Security Rules for `returnRequests` collection. Please verify your Firebase setup.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-3xl font-playfair-display font-bold text-gray-800 mb-6 text-center">Manage Pending Returns</h3>

      {userRole !== 'admin' && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Access Denied!</strong>
          <span className="block sm:inline"> You must be an administrator to manage return requests.</span>
          <span className="block sm:inline"> Please log in as an admin or use the "Make Me Admin" button.</span>
        </div>
      )}

      {returnRequests.length === 0 ? (
        <p className="text-center text-gray-500">No pending return requests.</p>
      ) : (
        <div className="overflow-x-auto bg-white p-6 rounded-lg shadow-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Book Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested By (Email)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr></thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {returnRequests.map((request) => (
                <tr key={request.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{request.bookTitle}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.userEmail}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(request.requestDate)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleApproveReturn(request)}
                      disabled={userRole !== 'admin' || loading}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Approve Return
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Admin Settings Component (NEW)
const AdminSettings = () => {
  const { db, showMessage, userRole, customAppId: appId, logoUrl, loadingText } = useFirebase();
  const [newLogoUrl, setNewLogoUrl] = useState(logoUrl);
  const [newLoadingText, setNewLoadingText] = useState(loadingText);
  const [saving, setSaving] = useState(false);

  // Sync internal state with props when they change (e.g., after initial fetch)
  useEffect(() => {
    setNewLogoUrl(logoUrl);
    setNewLoadingText(loadingText);
  }, [logoUrl, loadingText]);

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    if (!db || userRole !== 'admin') {
      showMessage('You must be an administrator to update settings.', 'error');
      return;
    }

    setSaving(true);
    try {
      const settingsDocRef = doc(db, 'artifacts', appId, 'settings', 'appSettings');
      await setDoc(settingsDocRef, {
        logoUrl: newLogoUrl,
        loadingText: newLoadingText,
      }, { merge: true });
      showMessage('Application settings updated successfully!', 'success');
    } catch (error) {
      console.error("Error updating settings:", error);
      showMessage(`Failed to update settings: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (userRole !== 'admin') {
    return (
      <div className="w-full text-center p-8 bg-red-100 rounded-lg shadow-md text-red-700">
        <strong className="font-bold">Access Denied!</strong>
        <span className="block sm:inline"> You must be an administrator to access settings.</span>
      </div>
    );
  }

  return (
    <div className="w-full bg-blue-50 p-6 rounded-lg shadow-md">
      <h3 className="text-3xl font-playfair-display font-bold text-gray-800 mb-6 text-center">Application Settings</h3>
      <form onSubmit={handleUpdateSettings} className="space-y-4">
        <div>
          <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700">
            Application Logo URL
          </label>
          <input
            id="logoUrl"
            type="url"
            value={newLogoUrl}
            onChange={(e) => setNewLogoUrl(e.target.value)}
            placeholder="Enter URL for application logo"
            className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
          {newLogoUrl && (
            <div className="mt-2 flex justify-center">
              <img src={newLogoUrl} alt="Current Logo Preview" className="h-20 w-20 object-contain" onError={(e) => e.target.src = "https://placehold.co/80x80/E0E0E0/424242?text=Invalid+URL"} />
            </div>
          )}
        </div>
        <div>
          <label htmlFor="loadingText" className="block text-sm font-medium text-gray-700">
            Loading Screen Text
          </label>
          <input
            id="loadingText"
            type="text"
            value={newLoadingText}
            onChange={(e) => setNewLoadingText(e.target.value)}
            placeholder="Enter text for loading screen"
            className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
};


// Patron Dashboard Component
const PatronDashboard = () => {
  const [activeTab, setActiveTab] = useState('browse'); // 'browse', 'loan-history'

  return (
    <div className="w-full flex flex-col items-center">
      <h2 className="text-4xl font-playfair-display font-extrabold text-gray-800 mb-8 mt-4 text-center">
        Patron Dashboard
      </h2>
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-md p-2 flex justify-center space-x-2 mb-6">
        <button
          onClick={() => setActiveTab('browse')}
          className={`flex-1 py-2 px-4 rounded-md font-semibold transition duration-300 ${activeTab === 'browse' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Browse Catalogue
        </button>
        <button
          onClick={() => setActiveTab('loan-history')}
          className={`flex-1 py-2 px-4 rounded-md font-semibold transition duration-300 ${activeTab === 'loan-history' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          My Loan History
        </button>
      </div>

      <div className="w-full max-w-4xl p-4">
        {activeTab === 'browse' && <BrowseCatalogue />}
        {activeTab === 'loan-history' && <MyLoanHistory />}
      </div>
    </div>
  );
};

// Browse Catalogue Component (Patron)
const BrowseCatalogue = () => {
  const { db, showMessage, userId, customAppId: appId } = useFirebase();
  const [books, setBooks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // QuaggaJS states
  const [isScanning, setIsScanning] = useState(false);
  const [scannedISBN, setScannedISBN] = useState('');
  const [cameraError, setCameraError] = useState(null);

  useEffect(() => {
    if (!window.Quagga) {
      console.warn("QuaggaJS not loaded. Ensure the script tag is present.");
      return;
    }

    const startScanner = () => {
      setCameraError(null); // Clear previous errors
      window.Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: document.querySelector('#interactive.viewport'),
          constraints: {
            facingMode: "environment" // Use rear camera on mobile
          },
        },
        decoder: {
          readers: ["ean_reader", "ean_8_reader", "code_39_reader", "code_39_vin_reader", "codabar_reader", "upc_reader", "upc_e_reader", "i2of5_reader"]
        },
        locate: true, // Enable detection indicator
      }, function (err) {
        if (err) {
          console.error(err);
          setCameraError(`Failed to start camera: ${err.message}. Please check camera permissions.`);
          showMessage(`Camera error: ${err.message}. Please ensure camera is allowed.`, 'error');
          setIsScanning(false);
          return;
        }
        console.log("QuaggaJS initialization finished. Starting...");
        window.Quagga.start();
        showMessage('Camera scanning started. Point at an ISBN barcode.', 'success');
      });

      window.Quagga.onDetected(onDetected);
      window.Quagga.onProcessed(onProcessed);
    };

    const stopScanner = () => {
      if (window.Quagga && isScanning) {
        window.Quagga.stop();
        window.Quagga.offDetected(onDetected);
        window.Quagga.offProcessed(onProcessed);
        console.log("QuaggaJS stopped.");
      }
    };

    const onDetected = (result) => {
      if (result && result.codeResult && result.codeResult.code) {
        const code = result.codeResult.code;
        setScannedISBN(code);
        showMessage(`ISBN detected: ${code}`, 'success');
        setIsScanning(false); // Stop scanning after first successful detection
        handleScanBookDetails(code); // Trigger book lookup with the scanned ISBN
        stopScanner(); // Ensure scanner stops
      }
    };

    const onProcessed = (result) => {
      // Optional: Add visual feedback for processing
      var drawingCtx = window.Quagga.canvas.ctx.overlay,
          drawingCanvas = window.Quagga.canvas.dom.overlay;

      if (result) {
        if (result.boxes) {
          drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.width), parseInt(drawingCanvas.height));
          result.boxes.filter(function (box) {
            return box !== result.box;
          }).forEach(function (box) {
            window.Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, '#00F', 2);
          });
        }

        if (result.box) {
          window.Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, '#0F0', 2);
        }

        if (result.codeResult && result.codeResult.code) {
          window.Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, '#F00', 3);
        }
      }
    };

    if (isScanning) {
      startScanner();
    } else {
      stopScanner();
    }

    // Cleanup on unmount
    return () => {
      stopScanner();
    };
  }, [isScanning, showMessage]); // Rerun when isScanning changes or showMessage ref changes

  // Books fetching logic
  useEffect(() => {
    if (!db) return;

    setFetchError(null);
    const q = collection(db, 'artifacts', appId, 'books');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const booksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort books by author's name
      booksData.sort((a, b) => {
        const authorA = a.author || '';
        const authorB = b.author || '';
        return authorA.localeCompare(authorB);
      });
      console.log("BrowseCatalogue - Fetched books data:", booksData);
      setBooks(booksData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching books:", error);
      showMessage(`Error fetching books: ${error.message}`, 'error');
      setFetchError(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, appId, showMessage]);

  const filteredBooks = books.filter(book => {
    // Add null/undefined checks before calling toLowerCase()
    const title = book.title || '';
    const author = book.author || '';
    const isbn = book.isbn || '';
    const description = book.description || '';
    const language = book.language || '';
    const term = searchTerm.toLowerCase();

    return (
      title.toLowerCase().includes(term) ||
      author.toLowerCase().includes(term) ||
      isbn.toLowerCase().includes(term) ||
      description.toLowerCase().includes(term) ||
      language.toLowerCase().includes(term)
    );
  });

  const handleViewBookDetails = (book) => {
    setSelectedBook(book);
    showMessage(`Details for "${book.title}" loaded.`, 'success');
  };

  const handleScanBookDetails = (isbn) => {
    const book = books.find(b => b.isbn === isbn);
    if (book) {
      setSelectedBook(book);
      showMessage(`Details for "${book.title}" loaded.`, 'success');
      setScannedISBN(''); // Clear scanned ISBN after using it
    } else {
      setSelectedBook(null);
      showMessage('No book found with that ISBN.', 'error');
    }
  };

  const handleBorrowBook = async (book) => {
    if (!db || !userId) {
      showMessage('You must be logged in to borrow books.', 'error');
      return;
    }

    if (book.available <= 0) {
      showMessage('No copies of this book are currently available for lending.', 'error');
      return;
    }

    try {
      const existingLoanQuery = query(
        collection(db, 'artifacts', appId, 'public', 'data', 'loans'),
        where('bookId', '==', book.id),
        where('userId', '==', userId),
        where('returned', '==', false)
      );
      const existingLoanSnapshot = await getDocs(existingLoanQuery);

      if (!existingLoanSnapshot.empty) {
        showMessage('You already have this copy of this book on loan.', 'error');
        return;
      }

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), {
        bookId: book.id,
        bookTitle: book.title,
        userId: userId,
        loanDate: new Date(),
        returnDate: null,
        returned: false,
        status: 'on-loan' // Initial status
      });

      const bookRef = doc(db, 'artifacts', appId, 'books', book.id); // Corrected path
      await updateDoc(bookRef, { available: book.available - 1 });

      showMessage(`"${book.title}" borrowed successfully!`, 'success');
    } catch (error) {
      console.error("Error borrowing book:", error);
      showMessage(`Error borrowing book: ${error.message}`, 'error');
    }
  };


  if (loading) {
    return <LoadingSpinner text="Loading catalogue..." />;
  }

  if (fetchError) {
    return (
      <div className="w-full text-center p-8 bg-red-100 rounded-lg shadow-md text-red-700">
        <h3 className="text-2xl font-playfair-display font-bold mb-4">Error Loading Catalogue</h3>
        <p>There was an issue fetching book catalogue data.</p>
        <p className="mt-2 font-mono text-sm">Error: {fetchError.message}</p>
        <p className="mt-4 text-gray-600">This is often due to **missing or insufficient permissions** in your Firebase Security Rules for `books` collection, or because the collection is empty. Please verify your Firebase setup.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-3xl font-playfair-display font-bold text-gray-800 mb-6 text-center">Browse Catalogue</h3>

      <div className="bg-blue-50 p-6 rounded-lg shadow-md mb-8">
        <input
          type="text"
          placeholder="Search by title, author, ISBN, description, or language"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 mb-4"
        />
        <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
          <input
            type="text"
            placeholder="Scanned ISBN will appear here, or enter manually"
            value={scannedISBN || ''} // Display scanned ISBN
            onChange={(e) => setScannedISBN(e.target.value)} // Allow manual entry/correction
            className="w-full md:w-1/2 p-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={() => handleScanBookDetails(scannedISBN)} // Use scannedISBN for lookup
            className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          >
            Lookup Scanned/Entered ISBN
          </button>
        </div>

        <div className="mt-6 text-center">
          {!isScanning ? (
            <button
              onClick={() => setIsScanning(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
            >
              Start ISBN Camera Scan
            </button>
          ) : (
            <button
              onClick={() => setIsScanning(false)}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
            >
              Stop Scan
            </button>
          )}
          {cameraError && <p className="text-red-500 mt-2 text-sm">{cameraError}</p>}
        </div>

        {isScanning && (
          <div className="mt-6 flex flex-col items-center">
            <p className="text-gray-700 mb-2">Scanning for ISBNs...</p>
            <div id="interactive" className="viewport w-full max-w-sm h-64 bg-gray-200 rounded-lg overflow-hidden relative">
              {/* QuaggaJS will render the video stream here */}
              <video className="w-full h-full object-cover"></video>
            </div>
          </div>
        )}
      </div>

      {selectedBook && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setSelectedBook(null)}
              className="absolute top-3 right-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-2 text-sm font-semibold transition duration-200"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <h4 className="text-2xl font-playfair-display font-semibold text-gray-800 mb-4 pr-10">Book Details</h4>
            {selectedBook.coverUrl && (
              <div className="flex justify-center mb-4">
                <img src={selectedBook.coverUrl} alt="Book Cover" className="w-48 h-auto rounded-md shadow-lg object-contain" onError={(e) => e.target.src = "https://placehold.co/192x288/E0E0E0/424242?text=No+Cover"} />
              </div>
            )}
            <p className="mb-2"><span className="font-medium">Title:</span> {selectedBook.title}</p>
            <p className="mb-2"><span className="font-medium">Author:</span> {selectedBook.author}</p>
            <p className="mb-2"><span className="font-medium">ISBN:</span> {selectedBook.isbn}</p>
            <p className="mb-2"><span className="font-medium">Language:</span> {selectedBook.language || 'N/A'}</p>
            <p className="mb-2"><span className="font-medium">Copies:</span> {selectedBook.copies}</p>
            <p className="mb-4"><span className="font-medium">Available:</span> {selectedBook.available} {selectedBook.available > 0 ? '✅' : '❌'}</p>
            <p className="text-gray-700 text-sm"><span className="font-medium">Description:</span> {selectedBook.description || 'N/A'}</p>
            <button
              onClick={() => handleBorrowBook(selectedBook)}
              disabled={selectedBook.available <= 0 || !userId}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selectedBook.available > 0 ? 'Borrow This Book' : 'Not Available'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h4 className="text-2xl font-playfair-display font-semibold text-gray-700 mb-4">Available Books</h4>
        {filteredBooks.length === 0 ? (
          <p className="text-center text-gray-500">No books match your search. Use the "Populate Catalogue" button in the Admin Dashboard to add some sample books!</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredBooks.map((book) => (
              <div
                key={book.id}
                onClick={() => handleViewBookDetails(book)}
                className="flex flex-col items-center p-3 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer bg-gray-50"
              >
                {book.coverUrl ? (
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    className="w-full h-auto max-h-[180px] object-contain rounded-md mb-2"
                    onError={(e) => e.target.src = "https://placehold.co/128x192/E0E0E0/424242?text=No+Cover"}
                  />
                ) : (
                  <img
                    src="https://placehold.co/128x192/E0E0E0/424242?text=No+Cover"
                    alt="No Cover"
                    className="w-full h-auto max-h-[180px] object-contain rounded-md mb-2"
                  />
                )}
                <p className="text-sm font-medium text-gray-800 text-center line-clamp-2">{book.title}</p>
                <p className="text-xs text-gray-600 text-center line-clamp-1">by {book.author}</p>
                <p className={`mt-1 text-xs font-semibold ${book.available > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {book.available > 0 ? 'Available' : 'Out'}
                </p>
                {/* Removed borrow button from grid view */}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// My Loan History Component (Patron)
const MyLoanHistory = () => {
  const { db, userId, currentUser, showMessage, customAppId: appId } = useFirebase();
  const [loanHistory, setLoanHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    if (!db || !userId) return;

    setFetchError(null);
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const historyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      historyData.sort((a, b) => b.loanDate.toDate() - a.loanDate.toDate());
      setLoanHistory(historyData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching loan history:", error);
      showMessage(`Error fetching loan history: ${error.message}`, 'error');
      setFetchError(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, userId, appId, showMessage]);

  const handleRequestReturn = async (loan) => {
    if (!db || !userId || !currentUser) {
      showMessage('You must be logged in to request a return.', 'error');
      return;
    }

    if (loan.status === 'pending-return') {
      showMessage('Return request already pending for this book.', 'info');
      return;
    }

    try {
      // Create a new return request in a dedicated collection
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'returnRequests'), {
        loanId: loan.id,
        bookId: loan.bookId,
        bookTitle: loan.bookTitle,
        userId: userId,
        userEmail: currentUser.email || 'N/A',
        requestDate: new Date(),
      });

      // Update the loan status to indicate pending return
      const loanRef = doc(db, 'artifacts', appId, 'public', 'data', 'loans', loan.id);
      await updateDoc(loanRef, { status: 'pending-return' });

      showMessage(`Return request for "${loan.bookTitle}" sent to admin.`, 'success');
    } catch (error) {
      console.error("Error requesting return:", error);
      showMessage(`Failed to request return: ${error.message}`, 'error');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <LoadingSpinner text="Loading loan history..." />;
  }

  if (fetchError) {
    return (
      <div className="w-full text-center p-8 bg-red-100 rounded-lg shadow-md text-red-700">
        <h3 className="text-2xl font-playfair-display font-bold mb-4">Error Loading Loan History</h3>
        <p>There was an issue fetching your loan history.</p>
        <p className="mt-2 font-mono text-sm">Error: {fetchError.message}</p>
        <p className="mt-4 text-gray-600">This is often due to **missing or insufficient permissions** in your Firebase Security Rules for `loans` collection, or because the collection is empty. Please verify your Firebase setup.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-3xl font-playfair-display font-bold text-gray-800 mb-6 text-center">My Loan History</h3>

      <div className="bg-white p-6 rounded-lg shadow-md">
        {loanHistory.length === 0 ? (
          <p className="text-center text-gray-500">You have no loan history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Book Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loanHistory.map((loan) => (
                  <tr key={loan.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{loan.bookTitle}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(loan.loanDate)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {loan.returned ? formatDate(loan.returnDate) : 'Still out'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {loan.status === 'on-loan' && !loan.returned && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          On Loan
                        </span>
                      )}
                      {loan.status === 'pending-return' && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Pending Return
                        </span>
                      )}
                      {loan.returned && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Returned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {loan.status === 'on-loan' && !loan.returned && (
                        <button
                          onClick={() => handleRequestReturn(loan)}
                          className="text-blue-600 hover:text-blue-900 transition duration-300 ease-in-out transform hover:scale-110"
                        >
                          Request Return
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
