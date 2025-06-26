import React, { useState, useContext } from 'react';
import { useFirebase } from '../../App';
import ScanLibraryCard from '../ScanLibraryCard';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { PersistentCameraContext } from '../PersistentCameraProvider';

const LocationLoanPage = ({ onClose, users, books, db, appId, showMessage, fetchActiveLoans }) => {
  const [mode, setMode] = useState(null); // 'loan' or 'return'
  const { appName, logoUrl } = useFirebase();

  // Loan flow state
  const [loanStep, setLoanStep] = useState(0); // 0: scan card, 1: enter pin, 2: scan books, 3: confirm
  const [loanUser, setLoanUser] = useState(null);
  const [loanPin, setLoanPin] = useState('');
  const [loanPinError, setLoanPinError] = useState('');
  const [loanBooks, setLoanBooks] = useState([]);
  const [loanLoading, setLoanLoading] = useState(false);
  const [loanError, setLoanError] = useState('');

  // Return flow state
  const [returnStep, setReturnStep] = useState(0); // 0: scan card, 1: show loans, 2: scan books
  const [returnUser, setReturnUser] = useState(null);
  const [returnLoans, setReturnLoans] = useState([]);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState('');

  const { lastScanResult, scanning, startScan, stopScan, error, videoRef, setLastScanResult } = useContext(PersistentCameraContext);

  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminPinError, setAdminPinError] = useState('');

  // Reset all state when mode changes
  React.useEffect(() => {
    setLoanStep(0); setLoanUser(null); setLoanPin(''); setLoanPinError(''); setLoanBooks([]); setLoanLoading(false); setLoanError('');
    setReturnStep(0); setReturnUser(null); setReturnLoans([]); setReturnLoading(false); setReturnError('');
  }, [mode]);

  // --- Loan Flow ---
  const handleLoanCardScan = async (cardNumber) => {
    setLoanLoading(true);
    setLoanError('');
    try {
      const q = query(collection(db, 'artifacts', appId, 'users'), where('cardNumber', '==', cardNumber));
      const snap = await getDocs(q);
      if (snap.empty) throw new Error('No user found for this card');
      const user = { id: snap.docs[0].id, ...snap.docs[0].data() };
      setLoanUser(user);
      if (setLastScanResult) setLastScanResult(null);
      setLoanStep(1);
    } catch (e) {
      setLoanError(e.message);
    } finally {
      setLoanLoading(false);
    }
  };
  const handleLoanPinSubmit = () => {
    if (!loanUser) return;
    if (loanUser.cardPin && loanUser.cardPin !== loanPin) {
      setLoanPinError('Incorrect PIN');
      return;
    }
    setLoanPinError('');
    setLoanStep(2);
  };
  const handleLoanBookScan = async (isbn) => {
    // Find book by ISBN
    const book = books.find(b => b.isbn === isbn);
    if (!book) {
      setLoanError('Book not found: ' + isbn);
      return;
    }
    if (loanBooks.some(b => b.id === book.id)) return; // Already added
    setLoanBooks([...loanBooks, book]);
    // Clear scan result to allow next scan
    if (setLastScanResult) setLastScanResult(null);
  };
  const handleLoanConfirm = async () => {
    setLoanLoading(true);
    try {
      for (const book of loanBooks) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), {
          userId: loanUser.id,
          bookId: book.id,
          loanDate: serverTimestamp(),
          returned: false,
          createdBy: loanUser.id,
          updatedAt: serverTimestamp(),
        });
        // Decrement available count
        const bookRef = doc(db, 'artifacts', appId, 'books', book.id);
        await updateDoc(bookRef, {
          available: Math.max(0, (book.available || 1) - 1),
          updatedAt: serverTimestamp(),
          updatedBy: loanUser.id
        });
      }
      showMessage && showMessage('Loan(s) created successfully!', 'success');
      setMode(null);
      fetchActiveLoans && fetchActiveLoans();
    } catch (e) {
      setLoanError('Failed to create loan(s): ' + e.message);
    } finally {
      setLoanLoading(false);
    }
  };

  // --- Return Flow ---
  const handleReturnCardScan = async (cardNumber) => {
    setReturnLoading(true);
    setReturnError('');
    try {
      const q = query(collection(db, 'artifacts', appId, 'users'), where('cardNumber', '==', cardNumber));
      const snap = await getDocs(q);
      if (snap.empty) throw new Error('No user found for this card');
      const user = { id: snap.docs[0].id, ...snap.docs[0].data() };
      setReturnUser(user);
      // Fetch active loans
      const loansQ = query(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), where('userId', '==', user.id), where('returned', '==', false));
      const loansSnap = await getDocs(loansQ);
      const loans = loansSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setReturnLoans(loans);
      setReturnStep(1);
    } catch (e) {
      setReturnError(e.message);
    } finally {
      setReturnLoading(false);
    }
  };
  const handleReturnBookScan = async (isbn) => {
    // Find loan by book ISBN
    const loan = returnLoans.find(l => {
      const book = books.find(b => b.id === l.bookId);
      return book && book.isbn === isbn;
    });
    if (!loan) {
      setReturnError('No active loan found for this book');
      return;
    }
    try {
      const loanRef = doc(db, 'artifacts', appId, 'public', 'data', 'loans', loan.id);
      await updateDoc(loanRef, {
        returned: true,
        returnDate: serverTimestamp(),
        returnedBy: returnUser.id,
        updatedAt: serverTimestamp(),
        updatedBy: returnUser.id
      });
      // Increment book availability
      const bookRef = doc(db, 'artifacts', appId, 'books', loan.bookId);
      await updateDoc(bookRef, {
        available: (books.find(b => b.id === loan.bookId)?.available || 0) + 1,
        updatedAt: serverTimestamp(),
        updatedBy: returnUser.id
      });
      setReturnLoans(returnLoans.filter(l => l.id !== loan.id));
      showMessage && showMessage('Book returned!', 'success');
      fetchActiveLoans && fetchActiveLoans();
    } catch (e) {
      setReturnError('Failed to return book: ' + e.message);
    }
  };

  const handleRequestClose = () => {
    setShowAdminPinModal(true);
    setAdminPin('');
    setAdminPinError('');
  };
  const handleAdminPinSubmit = (e) => {
    e.preventDefault();
    const admin = users && users.find(u => u.role === 'admin' && u.cardPin && String(u.cardPin) === String(adminPin));
    if (admin) {
      setShowAdminPinModal(false);
      setAdminPin('');
      setAdminPinError('');
      onClose && onClose();
    } else {
      setAdminPinError('Incorrect admin PIN.');
    }
  };

  // --- UI ---
  if (mode === null) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
        <button
          className="absolute top-6 right-8 text-white text-3xl font-bold hover:text-gray-300"
          onClick={handleRequestClose}
        >
          ×
        </button>
        {/* Admin PIN Modal */}
        {showAdminPinModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40">
            <form onSubmit={handleAdminPinSubmit} className="bg-white rounded-lg shadow-lg p-8 max-w-xs w-full flex flex-col items-center">
              <h3 className="text-xl font-bold mb-4 text-gray-800">Admin PIN Required</h3>
              <input
                type="password"
                value={adminPin}
                onChange={e => setAdminPin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                placeholder="Enter admin PIN"
                autoFocus
              />
              {adminPinError && <div className="text-red-600 mb-2">{adminPinError}</div>}
              <div className="flex space-x-2 mt-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Submit</button>
                <button type="button" className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400" onClick={() => setShowAdminPinModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}
        <div className="flex flex-col items-center w-full h-full">
          <div className="pt-20 pb-4">
            <img
              src={logoUrl}
              alt="App Logo"
              className="h-56 w-auto max-w-2xl mx-auto"
              style={{ filter: 'brightness(0) invert(1)' }}
              onError={e => { e.target.src = 'https://placehold.co/60x60/3b82f6/ffffff?text=LIB'; }}
            />
            <h2 className="text-white text-4xl font-extrabold mt-2 text-center">{appName || 'Location Loan'}</h2>
          </div>
          <div className="flex-grow flex items-center justify-center w-full -mt-60">
            <div className="flex flex-row space-x-8">
              <button
                className="w-40 h-20 bg-white text-black text-2xl font-semibold rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors duration-150"
                onClick={() => setMode('loan')}
              >
                Loan
              </button>
              <button
                className="w-40 h-20 bg-white text-black text-2xl font-semibold rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors duration-150"
                onClick={() => setMode('return')}
              >
                Return
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Loan Flow UI ---
  if (mode === 'loan') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
        <button className="absolute top-6 right-8 text-white text-3xl font-bold hover:text-gray-300" onClick={() => setMode(null)}>×</button>
        <div className="flex flex-col items-center w-full h-full">
          <div className="pt-20 pb-4">
            <img src={logoUrl} alt="App Logo" className="h-56 w-auto max-w-2xl mx-auto" style={{ filter: 'brightness(0) invert(1)' }} onError={e => { e.target.src = 'https://placehold.co/60x60/3b82f6/ffffff?text=LIB'; }} />
            <h2 className="text-white text-4xl font-extrabold mt-2 text-center">{appName || 'Loan'}</h2>
          </div>
          <div className="flex-grow flex flex-col items-center justify-center w-full -mt-60">
            {loanStep === 0 && (
              <>
                <div className="text-white text-2xl mb-6">Scan Library Card</div>
                {loanError && <div className="text-red-400 mb-2">{loanError}</div>}
                <ScanLibraryCard onScan={handleLoanCardScan} onClose={() => setMode(null)} autoClose={false} />
              </>
            )}
            {loanStep === 1 && loanUser && (
              <>
                <div className="text-white text-2xl mb-6">Enter PIN for {loanUser.name || loanUser.displayName}</div>
                <input
                  type="password"
                  value={loanPin}
                  onChange={e => setLoanPin(e.target.value)}
                  className="px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg mb-2"
                  placeholder="PIN"
                  autoFocus
                />
                {loanPinError && <div className="text-red-400 mb-2">{loanPinError}</div>}
                <div className="flex space-x-4 mt-4">
                  <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" onClick={handleLoanPinSubmit}>Continue</button>
                  <button className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400" onClick={() => setMode(null)}>Cancel</button>
                </div>
              </>
            )}
            {loanStep === 2 && loanUser && (
              <>
                <div className="text-white text-2xl mb-6">Scan Book(s) to Loan</div>
                {loanError && <div className="text-red-400 mb-2">{loanError}</div>}
                <div className="mt-6 w-full max-w-md">
                  <div className="text-white mb-2 font-semibold">Books to Loan:</div>
                  <table className="w-full bg-white rounded-lg mb-4">
                    <thead>
                      <tr>
                        <th className="px-2 py-1 text-left text-xs font-semibold text-gray-700">Title</th>
                        <th className="px-2 py-1 text-left text-xs font-semibold text-gray-700">Author</th>
                        <th className="px-2 py-1 text-left text-xs font-semibold text-gray-700">ISBN</th>
                        <th className="px-2 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {loanBooks.map(book => (
                        <tr key={book.id}>
                          <td className="px-2 py-1 text-sm text-gray-900">{book.title}</td>
                          <td className="px-2 py-1 text-sm text-gray-700">{book.author}</td>
                          <td className="px-2 py-1 text-sm text-gray-700">{book.isbn}</td>
                          <td className="px-2 py-1 text-right">
                            <button className="text-xs text-red-500 hover:underline ml-2" onClick={() => setLoanBooks(loanBooks.filter(b => b.id !== book.id))}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex space-x-4 mt-4">
                    <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" onClick={() => setLoanStep(3)} disabled={loanBooks.length === 0}>Continue</button>
                    <button className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400" onClick={() => setMode(null)}>Cancel</button>
                  </div>
                </div>
                {/* Modal overlay for scanning books */}
                {loanStep === 2 && (
                  <ScanLibraryCard
                    onScan={handleLoanBookScan}
                    onClose={() => setMode(null)}
                    autoClose={false}
                    clearScan={() => setLastScanResult && setLastScanResult(null)}
                    scannedCount={loanBooks.length}
                    title="Scan Book(s)"
                  >
                    <button
                      onClick={() => setLoanStep(4)}
                      className="w-full py-2 mt-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      disabled={loanBooks.length === 0}
                    >
                      Loan Book(s)
                    </button>
                  </ScanLibraryCard>
                )}
              </>
            )}
            {/* Step 4: Overview and receipt option */}
            {loanStep === 4 && loanUser && (
              <>
                <div className="text-white text-2xl mb-6">Loan Overview</div>
                <div className="w-full max-w-md bg-white rounded-lg p-4 mb-4">
                  <div className="font-semibold mb-2">User:</div>
                  <div className="mb-2">{loanUser.name || loanUser.displayName} ({loanUser.email})</div>
                  <div className="font-semibold mb-2">Books:</div>
                  <table className="w-full bg-white rounded-lg mb-4">
                    <thead>
                      <tr>
                        <th className="px-2 py-1 text-left text-xs font-semibold text-gray-700">Title</th>
                        <th className="px-2 py-1 text-left text-xs font-semibold text-gray-700">Author</th>
                        <th className="px-2 py-1 text-left text-xs font-semibold text-gray-700">ISBN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loanBooks.map(book => (
                        <tr key={book.id}>
                          <td className="px-2 py-1 text-sm text-gray-900">{book.title}</td>
                          <td className="px-2 py-1 text-sm text-gray-700">{book.author}</td>
                          <td className="px-2 py-1 text-sm text-gray-700">{book.isbn}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="font-semibold mb-2">Do you have any more books that you want to loan?</div>
                  <div className="flex space-x-4 mt-2">
                    <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" onClick={() => setLoanStep(2)}>Yes</button>
                    <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700" onClick={handleLoanConfirm} disabled={loanLoading}>{loanLoading ? 'Processing...' : 'No, loan these books'}</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Return Flow UI ---
  if (mode === 'return') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
        <button className="absolute top-6 right-8 text-white text-3xl font-bold hover:text-gray-300" onClick={() => setMode(null)}>×</button>
        <div className="flex flex-col items-center w-full h-full">
          <div className="pt-20 pb-4">
            <img src={logoUrl} alt="App Logo" className="h-56 w-auto max-w-2xl mx-auto" style={{ filter: 'brightness(0) invert(1)' }} onError={e => { e.target.src = 'https://placehold.co/60x60/3b82f6/ffffff?text=LIB'; }} />
            <h2 className="text-white text-4xl font-extrabold mt-2 text-center">{appName || 'Return'}</h2>
          </div>
          <div className="flex-grow flex flex-col items-center justify-center w-full -mt-60">
            {returnStep === 0 && (
              <>
                <div className="text-white text-2xl mb-6">Scan Library Card</div>
                {returnError && <div className="text-red-400 mb-2">{returnError}</div>}
                {/* Only show ScanLibraryCard if returnUser is not set */}
                {!returnUser && (
                  <ScanLibraryCard onScan={handleReturnCardScan} onClose={() => setMode(null)} autoClose={false} />
                )}
              </>
            )}
            {returnStep === 1 && returnUser && (
              <>
                <div className="text-white text-xl mb-2">Active Loans</div>
                {returnLoans.length === 0 ? (
                  <>
                    <div className="text-green-400 mb-4">You have no active loans. Thank you for returning your books.</div>
                    <button className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400" onClick={() => setMode(null)}>Logout</button>
                  </>
                ) : (
                  <>
                    <ul className="bg-white rounded-lg p-4 space-y-2 w-full max-w-md mb-4">
                      {returnLoans.map(loan => {
                        const book = books.find(b => b.id === loan.bookId);
                        return (
                          <li key={loan.id} className="flex justify-between items-center">
                            <span>{book ? book.title : 'Unknown Book'} <span className="text-xs text-gray-500">({book ? book.author : ''})</span></span>
                          </li>
                        );
                      })}
                    </ul>
                    {returnError && <div className="text-red-400 mb-2">{returnError}</div>}
                    <ScanLibraryCard
                      onScan={handleReturnBookScan}
                      onClose={() => setMode(null)}
                      autoClose={false}
                      title={`Hi, ${returnUser.name || returnUser.displayName}! (Library Card ID: ${returnUser.cardNumber || 'N/A'})\nScan book(s) you wish to return`}
                    />
                    <div className="flex space-x-4 mt-4">
                      <button className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400" onClick={() => setMode(null)}>Done</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default LocationLoanPage; 