import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useFirebase } from '../App';
import formatDate from './formatDate';
import BookList from './admin/BookList';
import UserList from './admin/UserList';
import ActiveLoansTable from './admin/ActiveLoansTable';
import EditUserModal from './admin/EditUserModal';
import updateUser from './admin/updateUser';
import BookEditModal from './admin/BookEditModal';
import AddLoanModal from './admin/AddLoanModal';
import LocationLoanPage from './admin/LocationLoanPage';
import AppSettingsForm from './admin/AppSettingsForm';
import Modal from 'react-modal';
import SimpleModal from './SimpleModal';

Modal.setAppElement('#root');

const fetchAllCoverOptions = async (isbn) => {
  // Returns an array of all possible cover URLs for a given ISBN
  const urls = [];
  // 1. Open Library
  try {
    const olRes = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
    if (olRes.ok) {
      const data = await olRes.json();
      if (data.covers && data.covers.length > 0) {
        urls.push(`https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`);
      }
    }
  } catch {}
  // 2. Google Books
  try {
    const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    if (gbRes.ok) {
      const data = await gbRes.json();
      if (data.items && data.items.length > 0) {
        const img = data.items[0].volumeInfo?.imageLinks?.thumbnail;
        if (img) urls.push(img);
      }
    }
  } catch {}
  // 3. LibraryThing
  try {
    const url = `https://covers.librarything.com/devkey/large/isbn/${isbn}`;
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
      urls.push(url);
    }
  } catch {}
  // 4. WorldCat (OCLC)
  try {
    const url = `https://covers.oclc.org/bib/isbn/${isbn}-L.jpg`;
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
      urls.push(url);
    }
  } catch {}
  // 5. Archive.org
  try {
    const url = `https://archive.org/services/img/isbn_${isbn}`;
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
      urls.push(url);
    }
  } catch {}
  // Remove duplicates
  return Array.from(new Set(urls));
};

const AdminDashboard = () => {
  console.log('AdminDashboard render');
  const [activeTab, setActiveTab] = useState('books');
  const { db, showMessage, customAppId: appId, currentUser, isAuthReady } = useFirebase();
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [showBookModal, setShowBookModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    email: '',
    role: 'patron',
    cardNumber: '',
    phone: '',
    address: '',
    libraryCardId: '',
    cardPin: '',
    isLocked: false
  });
  const [activeLoans, setActiveLoans] = useState([]);
  const [filteredLoans, setFilteredLoans] = useState([]);
  const [loadingActiveLoans, setLoadingActiveLoans] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showBookEditModal, setShowBookEditModal] = useState(false);
  const [editBookForm, setEditBookForm] = useState({
    title: '',
    author: '',
    isbn: '',
    language: '',
    description: '',
    coverUrl: '',
    available: 1,
    copies: 1,
    publisher: '',
    publishDate: '',
    tags: '',
    length: '',
    added: ''
  });
  const [membershipRequests, setMembershipRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [showAddLoanModal, setShowAddLoanModal] = useState(false);
  const [showLocationLoanPage, setShowLocationLoanPage] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [fetchingCovers, setFetchingCovers] = useState(false);

  const memoizedCurrentUser = useMemo(() => currentUser, [currentUser]);

  // Tabs
  const tabs = [
    { id: 'books', label: 'Books', icon: '📚' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'active-loans', label: 'Active Loans', icon: '🔄' },
    { id: 'process-returns', label: 'Returns', icon: '↩️' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'membership-requests', label: 'Membership Requests', icon: '📝' }
  ];

  // Fetch books
  const fetchBooks = async (isInitial = false) => {
    if (!db || !appId) return;
    try {
      if (isInitial) setLoading(true);
      const booksRef = collection(db, 'artifacts', appId, 'books');
      const q = query(booksRef);
      const querySnapshot = await getDocs(q);
      const booksData = [];
      querySnapshot.forEach((doc) => {
        booksData.push({ id: doc.id, ...doc.data() });
      });
      // Only update state if data is different
      setBooks(prevBooks => {
        const prevIds = prevBooks.map(b => b.id).join(',');
        const newIds = booksData.map(b => b.id).join(',');
        if (prevIds === newIds && JSON.stringify(prevBooks) === JSON.stringify(booksData)) {
          return prevBooks;
        }
        return booksData;
      });
    } catch (error) {
      showMessage('Error loading books: ' + error.message, 'error');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  // Fetch users
  const fetchUsers = async () => {
    if (!db || !appId) return;
    try {
      setLoadingUsers(true);
      const usersRef = collection(db, 'artifacts', appId, 'users');
      const q = query(usersRef);
      const querySnapshot = await getDocs(q);
      const usersData = [];
      querySnapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });
      setUsers(usersData);
    } catch (error) {
      showMessage('Error loading users: ' + error.message, 'error');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Edit user
  const handleEditUser = (user) => {
    setSelectedUser(user);
    setEditUserForm({
      name: user.name || user.displayName || '',
      email: user.email || '',
      role: user.role || 'patron',
      cardNumber: user.cardNumber || '',
      phone: user.phone || '',
      address: user.address || '',
      libraryCardId: user.libraryCardId || '',
      cardPin: user.cardPin || '',
      isLocked: !!user.isLocked
    });
    setShowEditUserModal(true);
  };
  const handleSaveUserEdit = async () => {
    if (!selectedUser || !db || !appId) return;
    try {
      await updateUser(db, appId, selectedUser.id, editUserForm, currentUser);
      await fetchUsers();
      setShowEditUserModal(false);
      setSelectedUser(null);
      showMessage('User updated successfully!', 'success');
    } catch (error) {
      showMessage('Failed to update user. Please try again.', 'error');
    }
  };

  // Fetch active loans
  const fetchActiveLoans = async () => {
    if (!db || !appId) return;
    setLoadingActiveLoans(true);
    try {
      const loansRef = collection(db, 'artifacts', appId, 'public', 'data', 'loans');
      const q = query(loansRef, where('returned', '==', false));
      const loanSnap = await getDocs(q);
      const loans = [];
      for (const docSnap of loanSnap.docs) {
        const loan = { id: docSnap.id, ...docSnap.data() };
        let user = null;
        try {
          const userRef = doc(db, 'artifacts', appId, 'users', loan.userId);
          const userSnap = await getDoc(userRef);
          user = userSnap.exists() ? userSnap.data() : null;
        } catch {}
        let book = null;
        try {
          const bookRef = doc(db, 'artifacts', appId, 'books', loan.bookId);
          const bookSnap = await getDoc(bookRef);
          book = bookSnap.exists() ? bookSnap.data() : null;
        } catch {}
        loans.push({ ...loan, user, book });
      }
      setActiveLoans(loans);
      setFilteredLoans(loans);
    } catch (error) {
      showMessage('Error loading active loans: ' + error.message, 'error');
    } finally {
      setLoadingActiveLoans(false);
    }
  };

  // Filter loans by search term
  useEffect(() => {
    if (activeTab !== 'active-loans') return;
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      setFilteredLoans(activeLoans);
      return;
    }
    setFilteredLoans(
      activeLoans.filter((loan) => {
        const user = loan.user || {};
        return (
          (user.name && user.name.toLowerCase().includes(term)) ||
          (user.email && user.email.toLowerCase().includes(term)) ||
          (user.cardNumber && user.cardNumber.toLowerCase().includes(term))
        );
      })
    );
  }, [searchTerm, activeLoans, activeTab]);

  // Tab data fetching
  useEffect(() => {
    if (activeTab === 'books' && db) {
      if (books.length === 0) {
        fetchBooks(true); // show spinner only if no books loaded
      } else {
        fetchBooks(false); // background update, no spinner
      }
    }
  }, [activeTab, db, appId]);
  useEffect(() => { if (activeTab === 'users' && db) fetchUsers(); }, [activeTab, db, appId]);
  useEffect(() => { if (activeTab === 'active-loans' && db && appId && !loadingActiveLoans) fetchActiveLoans(); }, [activeTab, db, appId]);
  useEffect(() => { if (activeTab === 'membership-requests' && db && appId) fetchMembershipRequests(); }, [activeTab, db, appId]);

  // Book actions
  const handleBookClick = useCallback((book) => {
    setSelectedBook(book);
    setShowBookModal(true);
  }, []);
  const handleEditBook = useCallback((book) => {
    setShowBookEditModal(false);
    setSelectedBook(null);
    setTimeout(() => {
      setSelectedBook(book);
      setEditBookForm({
        title: book.title || '',
        author: book.author || '',
        isbn: book.isbn || '',
        language: book.language || '',
        description: book.description || '',
        coverUrl: book.coverUrl || '',
        available: book.available ?? 1,
        copies: book.copies ?? 1,
        publisher: book.publisher || '',
        publishDate: book.publishDate || '',
        tags: book.tags || '',
        length: book.length || '',
        added: book.added || ''
      });
      setShowBookEditModal(true);
    }, 50);
  }, []);
  const handleSaveBookEdit = async () => {
    if (!db || !appId) return;
    try {
      if (selectedBook && selectedBook.id) {
        // Edit existing book
        const bookRef = doc(db, 'artifacts', appId, 'books', selectedBook.id);
        await updateDoc(bookRef, {
          ...editBookForm,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.uid || 'admin'
        });
        showMessage('Book updated successfully!', 'success');
      } else {
        // Add new book
        const booksRef = collection(db, 'artifacts', appId, 'books');
        await addDoc(booksRef, {
          ...editBookForm,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.uid || 'admin'
        });
        showMessage('Book added successfully!', 'success');
      }
      setShowBookEditModal(false);
      setSelectedBook(null);
      setTimeout(() => fetchBooks(), 1000);
    } catch (error) {
      showMessage('Failed to save book. Please try again.', 'error');
    }
  };
  const fixBookAvailability = async () => { /* TODO: Implement fix availability logic */ };

  // Active loans actions
  const handleForceReturn = async (loan) => {
    if (!db || !appId || !currentUser || !loan?.id) return;
    try {
      // Mark loan as force returned
      const loanRef = doc(db, 'artifacts', appId, 'public', 'data', 'loans', loan.id);
      await updateDoc(loanRef, {
        returned: true,
        forceReturnedBy: currentUser.uid,
        returnDate: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid
      });
      // Increment book availability
      if (loan.bookId) {
        const bookRef = doc(db, 'artifacts', appId, 'books', loan.bookId);
        await updateDoc(bookRef, {
          available: (loan.book?.available || 0) + 1,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid
        });
      }
      showMessage('Loan force returned successfully!', 'success');
      fetchActiveLoans();
    } catch (error) {
      showMessage('Failed to force return loan: ' + error.message, 'error');
    }
  };
  const handleScanCard = () => { setShowScanner(true); };
  const handleScanCardResult = (cardNumber) => {
    let value = cardNumber;
    if (cardNumber && typeof cardNumber === 'object') {
      if (typeof cardNumber.getText === 'function') {
        value = cardNumber.getText();
      } else if ('text' in cardNumber) {
        value = cardNumber.text;
      } else {
        value = '';
      }
    }
    setSearchTerm(value ? String(value) : '');
    setShowScanner(false);
  };

  // Membership requests actions
  const fetchMembershipRequests = async () => {
    if (!db || !appId) return;
    setLoadingRequests(true);
    try {
      const reqRef = collection(db, 'artifacts', appId, 'public', 'data', 'membershipRequests');
      const q = query(reqRef);
      const snap = await getDocs(q);
      const reqs = [];
      snap.forEach(doc => reqs.push({ id: doc.id, ...doc.data() }));
      setMembershipRequests(reqs);
    } catch (error) {
      showMessage('Error loading membership requests: ' + error.message, 'error');
    } finally {
      setLoadingRequests(false);
    }
  };
  const handleApproveRequest = async (req) => {
    if (!db || !appId) return;
    try {
      // Create user doc
      const usersRef = collection(db, 'artifacts', appId, 'users');
      await addDoc(usersRef, {
        name: req.fullName,
        displayName: req.fullName,
        email: req.email,
        role: 'patron',
        cardNumber: req.libraryCard,
        phone: req.phone,
        address: req.address,
        createdAt: serverTimestamp(),
        isLocked: false
      });
      // Remove request
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'membershipRequests', req.id));
      showMessage('Membership approved and user created!', 'success');
      fetchMembershipRequests();
      fetchUsers();
    } catch (error) {
      showMessage('Failed to approve membership: ' + error.message, 'error');
    }
  };
  const handleRejectRequest = async (req) => {
    if (!db || !appId) return;
    if (!window.confirm('Are you sure you want to reject this membership request?')) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'membershipRequests', req.id));
      showMessage('Membership request rejected.', 'success');
      fetchMembershipRequests();
    } catch (error) {
      showMessage('Failed to reject membership: ' + error.message, 'error');
    }
  };

  // Delete user
  const handleDeleteUser = async (user) => {
    if (user.isLocked) {
      showMessage('Cannot delete a locked account. Unlock the account first.', 'error');
      return;
    }
    if (!db || !appId) return;
    if (!window.confirm(`Are you sure you want to delete user ${user.email || user.name || user.id}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.id));
      showMessage('User deleted.', 'success');
      fetchUsers();
    } catch (error) {
      showMessage('Failed to delete user: ' + error.message, 'error');
    }
  };

  // Fetch covers for all books
  const onFetchAllCovers = async () => {
    if (!db || !appId) return;
    setFetchingCovers(true);
    try {
      for (const book of books) {
        if (!book.isbn) continue;
        const coverOptions = await fetchAllCoverOptions(book.isbn);
        if (coverOptions.length > 0 && coverOptions[0] !== book.coverUrl) {
          // Update with the first found cover (or you could prompt user for each, but that's slow)
          const bookRef = doc(db, 'artifacts', appId, 'books', book.id);
          await updateDoc(bookRef, { coverUrl: coverOptions[0] });
        }
      }
      showMessage('Covers updated for all books!', 'success');
      fetchBooks();
    } catch (e) {
      showMessage('Failed to update covers: ' + e.message, 'error');
    } finally {
      setFetchingCovers(false);
    }
  };

  // Restore BookList to renderTabContent for correct tab switching
  const renderTabContent = () => {
    switch (activeTab) {
      case 'books':
        return <BookList books={books} loading={loading} onBookClick={handleBookClick} onEditBook={handleEditBook} onFixAvailability={fixBookAvailability} onAddBook={() => {
          setEditBookForm({
            title: '',
            author: '',
            isbn: '',
            language: '',
            description: '',
            coverUrl: '',
            available: 1,
            copies: 1
          });
          setShowBookEditModal(true);
        }} onFetchAllCovers={onFetchAllCovers} />;
      case 'users':
        return <UserList users={users} loading={loadingUsers} onEditUser={handleEditUser} onDeleteUser={handleDeleteUser} />;
      case 'active-loans':
        return <>
          <ActiveLoansTable
            filteredLoans={filteredLoans}
            loadingActiveLoans={loadingActiveLoans}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onRefresh={fetchActiveLoans}
            onOpenScanner={openScanner}
            onScanCard={handleScanCardResult}
            onForceReturn={handleForceReturn}
            showScanner={showScanner}
            setShowScanner={setShowScanner}
            onAddLoan={() => setShowAddLoanModal(true)}
            onConfirmPending={handleConfirmPending}
          />
          <div className="flex justify-center mt-8">
            <button
              className="px-8 py-4 bg-black text-white text-2xl rounded-lg shadow-lg hover:bg-gray-900 transition-colors"
              onClick={() => setShowLocationLoanPage(true)}
            >
              Location Loan
            </button>
          </div>
        </>;
      case 'membership-requests':
        return (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Membership Requests</h3>
            {loadingRequests ? (
              <div className="text-center py-8">Loading requests...</div>
            ) : membershipRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No pending requests.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Name</th>
                    <th className="py-2 text-left">Email</th>
                    <th className="py-2 text-left">Phone</th>
                    <th className="py-2 text-left">Address</th>
                    <th className="py-2 text-left">Library Card</th>
                    <th className="py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {membershipRequests.map(req => (
                    <tr key={req.id} className="border-b hover:bg-gray-50">
                      <td className="py-2">{req.fullName}</td>
                      <td className="py-2">{req.email}</td>
                      <td className="py-2">{req.phone}</td>
                      <td className="py-2">{req.address}</td>
                      <td className="py-2">{req.libraryCard}</td>
                      <td className="py-2">
                        <button
                          onClick={() => handleApproveRequest(req)}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req)}
                          className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs ml-2"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      case 'settings':
        return <AppSettingsForm db={db} appId={appId} showMessage={showMessage} />;
      default:
        return <div>Select a tab to view content</div>;
    }
  };

  const openScanner = () => setShowScanner(true);

  useEffect(() => {
    if (showAddLoanModal) fetchUsers();
  }, [showAddLoanModal]);

  const EditButton = React.memo(({ onClick }) => (
    <button
      onClick={onClick}
      className="text-blue-600 hover:text-blue-800 text-xs font-semibold border border-blue-200 rounded px-2 py-1 mr-1 bg-blue-50"
      style={{ lineHeight: 1 }}
    >
      Edit
    </button>
  ));

  const handleConfirmPending = async (loan) => {
    if (!db || !appId || !loan?.id) return;
    try {
      const loanRef = doc(db, 'artifacts', appId, 'public', 'data', 'loans', loan.id);
      await updateDoc(loanRef, { status: 'active', updatedAt: serverTimestamp(), updatedBy: currentUser?.uid || 'admin' });
      showMessage('Loan confirmed!', 'success');
      fetchActiveLoans();
    } catch (error) {
      showMessage('Failed to confirm loan: ' + error.message, 'error');
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-4xl font-extrabold text-gray-800 mb-8 text-center">Admin Dashboard</h2>
      <div className="bg-blue-50 rounded-lg p-4 mb-6">
        <p className="text-blue-800">Welcome back, {currentUser?.email || 'Administrator'}! Manage your library efficiently.</p>
      </div>
      <div className="bg-white rounded-lg shadow-md p-2 mb-6">
        <div className="flex flex-wrap justify-center space-x-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg transition-colors ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <span className="mr-2">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      </div>
      {/* Wrap BookList in a fixed-height container to prevent layout jumps */}
      {activeTab === 'books' && (
        <div style={{ minHeight: '800px', background: 'white' }}>
          {fetchingCovers && (
            <div style={{ textAlign: 'center', padding: 16, color: '#3b82f6', fontWeight: 600 }}>Fetching covers for all books...</div>
          )}
          <BookList
            books={books}
            onBookClick={handleBookClick}
            onEditBook={handleEditBook}
            onFixAvailability={fixBookAvailability}
            onAddBook={() => {
              setEditBookForm({
                title: '',
                author: '',
                isbn: '',
                language: '',
                description: '',
                coverUrl: '',
                available: 1,
                copies: 1
              });
              setShowBookEditModal(true);
            }}
            onFetchAllCovers={onFetchAllCovers}
          />
        </div>
      )}
      {/* Other tab content */}
      {activeTab !== 'books' && <div>{renderTabContent()}</div>}
      <EditUserModal show={showEditUserModal} user={selectedUser} form={editUserForm} setForm={setEditUserForm} onSave={handleSaveUserEdit} onClose={() => setShowEditUserModal(false)} />
      {showBookEditModal && selectedBook && (
        <BookEditModal
          show={true}
          book={selectedBook}
          form={editBookForm}
          setForm={setEditBookForm}
          onSave={handleSaveBookEdit}
          onClose={() => setShowBookEditModal(false)}
          books={books}
        />
      )}
      <AddLoanModal show={showAddLoanModal} onClose={() => { setShowAddLoanModal(false); fetchActiveLoans(); }} users={users} books={books} />
      {/* Book Details Modal using react-modal */}
      <Modal
        isOpen={showBookModal && !!selectedBook}
        onRequestClose={() => setShowBookModal(false)}
        contentLabel="Book Details"
        style={{
          overlay: { zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
          content: { maxWidth: 600, margin: 'auto', borderRadius: 8, padding: 0, background: '#f8fafc', border: 'none', boxShadow: '0 2px 8px rgba(59,130,246,0.08)', height: 'fit-content', maxHeight: '90vh', overflowY: 'auto', display: 'block' }
        }}
      >
        {selectedBook && isAuthReady ? (
          <div className="p-0 md:px-6 md:pt-2 md:pb-2" style={{ paddingBottom: 0, marginBottom: 0, height: 'auto' }}>
            <div className="flex justify-between items-start border-b border-slate-200 px-4 pt-2 pb-1">
              <h3 className="text-base font-bold text-slate-800 tracking-tight">Book Details</h3>
              <button
                onClick={() => setShowBookModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
                style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col md:flex-row gap-x-4 gap-y-1 px-4 py-2">
              <div className="flex flex-col items-center md:items-start">
                <img
                  src={selectedBook.coverUrl || 'https://placehold.co/100x150/3b82f6/ffffff?text=📚'}
                  alt={`Cover of ${selectedBook.title || 'Book'}`}
                  className="w-20 h-28 object-cover border mb-1"
                  onError={e => { e.target.src = 'https://placehold.co/100x150/3b82f6/ffffff?text=📚'; }}
                  style={{ maxHeight: 112 }}
                />
                <span className={`inline-block px-1 py-0.5 rounded-full text-xs font-semibold mb-0.5 ${selectedBook.available > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{selectedBook.available > 0 ? 'Available' : 'Out of Stock'}</span>
                {selectedBook.genre && (
                  <span className="inline-block bg-indigo-100 text-indigo-700 rounded-full px-1 py-0.5 text-xs font-semibold mb-0.5">{selectedBook.genre}</span>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="text-base font-bold text-slate-900 mb-0.5">{selectedBook.title || 'Untitled Book'}</div>
                <div className="text-xs text-slate-700 mb-0.5">by {selectedBook.author || 'Unknown Author'}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                  <div><span className="font-semibold text-slate-600">ISBN:</span> {selectedBook.isbn || 'N/A'}</div>
                  <div><span className="font-semibold text-slate-600">Language:</span> {selectedBook.language || 'N/A'}</div>
                  <div><span className="font-semibold text-slate-600">Publisher:</span> {selectedBook.publisher || 'N/A'}</div>
                  <div><span className="font-semibold text-slate-600">Publish Date:</span> {selectedBook.publishDate || 'N/A'}</div>
                  <div><span className="font-semibold text-slate-600">Available:</span> {selectedBook.available ?? 'N/A'}</div>
                  <div><span className="font-semibold text-slate-600">Total Copies:</span> {selectedBook.copies ?? 'N/A'}</div>
                </div>
                <div className="mt-1">
                  <div className="font-semibold text-slate-700 mb-0.5">Description</div>
                  <div className="text-slate-700 whitespace-pre-line text-xs bg-slate-50 rounded p-1 shadow-inner">{selectedBook.description || 'No description.'}</div>
                </div>
                {/* Tags at the bottom */}
                {selectedBook.tags && (
                  <div className="mt-1" style={{ marginBottom: 0 }}>
                    <span className="inline-block bg-blue-100 text-blue-700 rounded-full px-1 py-0.5 text-xs font-semibold" style={{ marginBottom: 0 }}>{selectedBook.tags}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-gray-500">Loading book info...</span>
          </div>
        )}
      </Modal>
      {/* Render LocationLoanPage as a full overlay if active */}
      {showLocationLoanPage && (
        <LocationLoanPage
          onClose={() => setShowLocationLoanPage(false)}
          users={users}
          books={books}
          db={db}
          appId={appId}
          showMessage={showMessage}
          fetchActiveLoans={fetchActiveLoans}
        />
      )}
    </div>
  );
};

export default AdminDashboard; 