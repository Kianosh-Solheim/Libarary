import React, { useState } from 'react';
import { useFirebase } from '../App';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const AuthPage = ({ setCurrentPage }) => {
  const { auth, db, customAppId: appId, showMessage } = useFirebase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [libraryCard, setLibraryCard] = useState('');
  const [hasLibraryCard, setHasLibraryCard] = useState(false);
  const [showCardInput, setShowCardInput] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!auth) return;
    setLoading(true);
    try {
      if (isRegister) {
        // Submit membership request instead of creating user
        if (!db || !appId) throw new Error('Database not ready');
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'membershipRequests'), {
          email,
          password, // Optionally hash or omit for security
          fullName,
          phone,
          address,
          libraryCard: hasLibraryCard ? libraryCard : '',
          hasLibraryCard,
          createdAt: serverTimestamp(),
          status: 'pending'
        });
        showMessage && showMessage('Registration request submitted! An admin must approve your membership before you can log in.', 'success');
        setIsRegister(false);
        setEmail(''); setPassword(''); setFullName(''); setPhone(''); setAddress(''); setLibraryCard(''); setHasLibraryCard(false); setShowCardInput(false);
        return;
      } else {
        await import('firebase/auth').then(({ signInWithEmailAndPassword }) =>
          signInWithEmailAndPassword(auth, email, password)
        );
        showMessage && showMessage('Login successful!', 'success');
        setCurrentPage && setCurrentPage('patron');
      }
    } catch (error) {
      showMessage && showMessage(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h2 className="text-3xl font-bold mb-6">Welcome to My Library</h2>
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
        <input
          type="email"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        {isRegister && (
          <>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Full Name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
            />
            <input
              type="tel"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
            />
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              required
            />
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="hasLibraryCard"
                checked={hasLibraryCard}
                onChange={e => setHasLibraryCard(e.target.checked)}
              />
              <label htmlFor="hasLibraryCard" className="text-sm text-gray-700">
                I already have a library card
              </label>
            </div>
            {hasLibraryCard && (
              <div className="space-y-2">
                <button
                  type="button"
                  className="w-full py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200"
                  onClick={() => setShowCardInput(true)}
                >
                  {showCardInput ? 'Enter Card Number Below' : 'Click here to scan or enter your card number'}
                </button>
                {showCardInput && (
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Library Card Number"
                    value={libraryCard}
                    onChange={e => setLibraryCard(e.target.value)}
                    required
                  />
                )}
              </div>
            )}
          </>
        )}
        <button
          type="submit"
          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? (isRegister ? 'Submitting...' : 'Logging in...') : (isRegister ? 'Request Membership' : 'Login')}
        </button>
      </form>
      <button
        className="mt-4 text-blue-600 hover:underline"
        onClick={() => setIsRegister(r => !r)}
      >
        {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
      </button>
    </div>
  );
};

export default AuthPage; 