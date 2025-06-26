import React, { useState } from 'react';
import ScanLibraryCard from '../ScanLibraryCard';
import { X, Plus } from 'lucide-react';
import { useFirebase } from '../../App';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

const AddLoanModal = ({ show, onClose, users, books }) => {
  const { db, customAppId: appId, currentUser, showMessage } = useFirebase();
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [bookSearch, setBookSearch] = useState('');
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  // Filter users by name/email/card
  const filteredUsers = userSearch
    ? users.filter(u =>
        (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase())) ||
        (u.cardNumber && u.cardNumber.toLowerCase().includes(userSearch.toLowerCase()))
      )
    : users;

  // Filter books by title/author/isbn and available > 0
  const filteredBooks = bookSearch
    ? books.filter(b =>
        (b.title && b.title.toLowerCase().includes(bookSearch.toLowerCase())) ||
        (b.author && b.author.toLowerCase().includes(bookSearch.toLowerCase())) ||
        (b.isbn && b.isbn.toLowerCase().includes(bookSearch.toLowerCase()))
      ).filter(b => b.available > 0 && !selectedBooks.some(sb => sb.id === b.id))
    : books.filter(b => b.available > 0 && !selectedBooks.some(sb => sb.id === b.id));

  const handleLoanOut = async () => {
    console.log('handleLoanOut called', { db, appId, currentUser, selectedUser, selectedBooks });
    if (!db || !appId || !currentUser || !selectedUser || selectedBooks.length === 0) {
      console.log('Missing required data for loan creation');
      return;
    }
    setLoading(true);
    try {
      for (const book of selectedBooks) {
        // Create loan
        console.log('Creating loan for', book);
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), {
          userId: selectedUser.id,
          bookId: book.id,
          loanDate: serverTimestamp(),
          returned: false,
          createdBy: currentUser.uid,
          updatedAt: serverTimestamp(),
        });
        // Decrement available count
        const bookRef = doc(db, 'artifacts', appId, 'books', book.id);
        await updateDoc(bookRef, {
          available: Math.max(0, (book.available || 1) - 1),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid
        });
      }
      showMessage && showMessage('Loan(s) created successfully!', 'success');
      setSelectedBooks([]);
      setSelectedUser(null);
      setBookSearch('');
      setUserSearch('');
      onClose && onClose();
    } catch (error) {
      console.error('Loan creation error:', error);
      showMessage && showMessage('Failed to create loan(s): ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"><X size={24} /></button>
        <div className="p-6 space-y-6">
          <h3 className="text-xl font-bold text-gray-800 mb-2">Add New Loan</h3>

          {/* Step 1: User search/scan */}
          {!selectedUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Find User</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search by name, email, or card number"
                />
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="p-2 bg-blue-100 hover:bg-blue-200 rounded-full flex items-center justify-center"
                  title="Scan Library Card"
                >
                  <Plus size={20} className="text-blue-600" />
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto mt-2">
                {filteredUsers.slice(0, 10).map(u => (
                  <div key={u.id} className="p-2 hover:bg-blue-50 rounded cursor-pointer" onClick={() => setSelectedUser(u)}>
                    <div className="font-medium">{u.name || u.displayName}</div>
                    <div className="text-xs text-gray-500">{u.email} • {u.cardNumber}</div>
                  </div>
                ))}
                {filteredUsers.length === 0 && <div className="text-gray-400 text-sm p-2">No users found.</div>}
              </div>
            </div>
          )}

          {/* Step 2: Book search/add */}
          {selectedUser && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="font-medium">User: {selectedUser.name || selectedUser.displayName}</div>
                  <div className="text-xs text-gray-500">{selectedUser.email} • {selectedUser.cardNumber}</div>
                </div>
                <button className="text-xs text-blue-600 hover:underline" onClick={() => setSelectedUser(null)}>Change</button>
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Add Book(s) to Loan</label>
              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  value={bookSearch}
                  onChange={e => setBookSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search for available books by title, author, or ISBN"
                />
              </div>
              <div className="max-h-32 overflow-y-auto mb-2">
                {filteredBooks.slice(0, 10).map(b => (
                  <div key={b.id} className="flex items-center justify-between p-2 hover:bg-blue-50 rounded cursor-pointer">
                    <div>
                      <div className="font-medium">{b.title}</div>
                      <div className="text-xs text-gray-500">{b.author} • {b.isbn}</div>
                    </div>
                    <button className="p-1 bg-blue-100 hover:bg-blue-200 rounded-full" onClick={() => setSelectedBooks([...selectedBooks, b])}>
                      <Plus size={18} className="text-blue-600" />
                    </button>
                  </div>
                ))}
                {filteredBooks.length === 0 && <div className="text-gray-400 text-sm p-2">No available books found.</div>}
              </div>
              {/* Selected books */}
              {selectedBooks.length > 0 && (
                <div className="mb-2">
                  <div className="font-medium mb-1">Books to Loan:</div>
                  <ul className="list-disc pl-5">
                    {selectedBooks.map(b => (
                      <li key={b.id} className="flex items-center justify-between">
                        <span>{b.title} <span className="text-xs text-gray-500">({b.author})</span></span>
                        <button className="text-xs text-red-500 hover:underline ml-2" onClick={() => setSelectedBooks(selectedBooks.filter(sb => sb.id !== b.id))}>Remove</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mt-2 disabled:opacity-50"
                disabled={selectedBooks.length === 0 || loading}
                onClick={handleLoanOut}
              >
                {loading ? 'Processing...' : 'Loan Out'}
              </button>
            </div>
          )}

          {/* Scanner modal */}
          {showScanner && (
            <ScanLibraryCard
              onScan={code => {
                setUserSearch(code);
                setShowScanner(false);
              }}
              onClose={() => setShowScanner(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AddLoanModal; 