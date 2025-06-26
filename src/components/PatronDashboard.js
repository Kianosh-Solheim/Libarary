import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebase } from '../App';
import formatDate from './formatDate';
import BookGrid from './patron/BookGrid';
import LoanList from './patron/LoanList';
import ReviewList from './patron/ReviewList';
import returnLoan from './patron/returnLoan';
import { Star, StarIcon, StarHalf } from 'lucide-react';

const PatronDashboard = () => {
  const [activeTab, setActiveTab] = useState('browse');
  const [searchTerm, setSearchTerm] = useState('');
  const [books, setBooks] = useState([]);
  const [myLoans, setMyLoans] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [showBookModal, setShowBookModal] = useState(false);
  const [isBorrowing, setIsBorrowing] = useState(false);
  const [myReviews, setMyReviews] = useState([]);
  const [bookReviews, setBookReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editingReviewText, setEditingReviewText] = useState('');
  const [editingReviewRating, setEditingReviewRating] = useState(0);
  const [savingReview, setSavingReview] = useState(false);
  const { currentUser, db, customAppId: appId, loanPeriodDays, renewPeriodDays } = useFirebase();
  const [selectedTag, setSelectedTag] = useState(null);
  const [tagSelectorOpen, setTagSelectorOpen] = useState(false);
  const [sortBy, setSortBy] = useState('title');
  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(0);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [bookRatings, setBookRatings] = useState({});
  const [showBorrowedModal, setShowBorrowedModal] = useState(false);

  const tabs = [
    { id: 'browse', label: 'Browse Books', icon: '📚' },
    { id: 'my-loans', label: 'My Loans', icon: '📖' },
    { id: 'reviews', label: 'Reviews', icon: '⭐' }
  ];

  const ratingLabels = ['Terrible', 'Bad', 'Okay', 'Good', 'Excellent'];
  const [hoveredRating, setHoveredRating] = useState(0);

  // Collect all unique tags
  const allTags = Array.from(new Set(
    books.flatMap(book => (book.tags ? book.tags.split(',').map(t => t.trim()).filter(Boolean) : []))
  ));

  // Helper functions for author name sorting
  function getAuthorFirstName(author) {
    if (!author) return '';
    return author.split(' ')[0].toLowerCase();
  }
  function getAuthorLastName(author) {
    if (!author) return '';
    const parts = author.trim().split(' ');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : parts[0].toLowerCase();
  }

  // Fetch books
  const fetchBooks = async () => {
    if (!db || !appId) return;
    try {
      const booksRef = collection(db, 'artifacts', appId, 'books');
      const q = query(booksRef);
      const querySnapshot = await getDocs(q);
      const booksData = [];
      querySnapshot.forEach((doc) => {
        booksData.push({ id: doc.id, ...doc.data() });
      });
      setBooks(booksData);
    } catch (error) {
      // handle error
    }
  };

  // Fetch loans
  useEffect(() => {
    if (activeTab === 'my-loans' && db && currentUser) {
      const loansRef = collection(db, 'artifacts', appId, 'public', 'data', 'loans');
      const q = query(loansRef, where('userId', '==', currentUser.uid));
      getDocs(q)
        .then((querySnapshot) => {
          const loansData = [];
          querySnapshot.forEach((doc) => {
            loansData.push({ id: doc.id, ...doc.data() });
          });
          setMyLoans(loansData);
        })
        .catch(() => {});
    }
  }, [activeTab, db, appId, currentUser]);

  // Fetch reviews
  const fetchMyReviews = async () => {
    if (!db || !appId || !currentUser) return;
    try {
      const reviewsRef = collection(db, 'artifacts', appId, 'public', 'data', 'reviews');
      const q = query(reviewsRef, where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      const reviewsData = [];
      querySnapshot.forEach((doc) => {
        reviewsData.push({ id: doc.id, ...doc.data() });
      });
      setMyReviews(reviewsData);
    } catch (error) {}
  };

  // Fetch reviews for selected book
  useEffect(() => {
    if (!db || !appId || !selectedBook) {
      setBookReviews([]);
      return;
    }
    setLoadingReviews(true);
    const fetchReviews = async () => {
      try {
        const reviewsRef = collection(db, 'artifacts', appId, 'public', 'data', 'reviews');
        const q = query(reviewsRef, where('bookId', '==', selectedBook.id));
        const snap = await getDocs(q);
        const reviews = [];
        snap.forEach(doc => reviews.push({ id: doc.id, ...doc.data() }));
        setBookReviews(reviews);
      } catch {
        setBookReviews([]);
      } finally {
        setLoadingReviews(false);
      }
    };
    fetchReviews();
  }, [db, appId, selectedBook]);

  // Fetch all reviews and compute average ratings for each book
  useEffect(() => {
    if (!db || !appId) return;
    const fetchAllReviews = async () => {
      try {
        const reviewsRef = collection(db, 'artifacts', appId, 'public', 'data', 'reviews');
        const q = query(reviewsRef);
        const snap = await getDocs(q);
        const ratingsMap = {};
        snap.forEach(doc => {
          const r = doc.data();
          if (!r.bookId || typeof r.rating !== 'number') return;
          if (!ratingsMap[r.bookId]) ratingsMap[r.bookId] = [];
          ratingsMap[r.bookId].push(r.rating);
        });
        const avgMap = {};
        Object.entries(ratingsMap).forEach(([bookId, ratings]) => {
          const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
          avgMap[bookId] = Math.round(avg * 10) / 10;
        });
        setBookRatings(avgMap);
      } catch {}
    };
    fetchAllReviews();
  }, [db, appId]);

  useEffect(() => { if (activeTab === 'browse' && db) fetchBooks(); }, [activeTab, db, appId]);
  useEffect(() => { if (activeTab === 'reviews' && db && currentUser) fetchMyReviews(); }, [activeTab, db, appId, currentUser]);

  // Filter books by search term and selected tag for browse
  let filteredBooks = books.filter(book => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term ||
      (book.title && book.title.toLowerCase().includes(term)) ||
      (book.author && book.author.toLowerCase().includes(term)) ||
      (book.genre && book.genre.toLowerCase().includes(term));
    const matchesTag = !selectedTag || (book.tags && book.tags.split(',').map(t => t.trim()).includes(selectedTag));
    return matchesSearch && matchesTag;
  });
  // Attach average rating to each book
  filteredBooks = filteredBooks.map(book => ({
    ...book,
    rating: bookRatings[book.id] || null
  }));
  // Sort books
  filteredBooks = [...filteredBooks].sort((a, b) => {
    if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
    if (sortBy === 'authorFirst') return getAuthorFirstName(a.author).localeCompare(getAuthorFirstName(b.author));
    if (sortBy === 'authorLast') return getAuthorLastName(a.author).localeCompare(getAuthorLastName(b.author));
    if (sortBy === 'genre') return (a.genre || '').localeCompare(b.genre || '');
    if (sortBy === 'available') return (b.available || 0) - (a.available || 0);
    return 0;
  });

  // Book actions
  const handleBookClick = (book) => { setSelectedBook(book); setShowBookModal(true); };
  const handleBorrowBook = async (book) => {
    if (!db || !appId || !currentUser || !book || book.available <= 0) return;
    setIsBorrowing(true);
    try {
      // 1. Create a new loan
      const loansRef = collection(db, 'artifacts', appId, 'public', 'data', 'loans');
      await addDoc(loansRef, {
        userId: currentUser.uid,
        bookId: book.id,
        bookTitle: book.title || '',
        loanDate: new Date(),
        returned: false,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      // 2. Decrement book availability
      const bookRef = doc(db, 'artifacts', appId, 'books', book.id);
      await updateDoc(bookRef, {
        available: (book.available || 1) - 1
      });
      // 3. Update UI
      setBooks(prev => prev.map(b => b.id === book.id ? { ...b, available: (b.available || 1) - 1 } : b));
      setShowBorrowedModal(true);
    } catch (error) {
      alert('Failed to borrow book: ' + (error.message || error));
    } finally {
      setIsBorrowing(false);
    }
  };
  // Loan actions
  const handleReturnBook = async (loan) => {
    try {
      await returnLoan(db, appId, currentUser, loan);
      setMyLoans((prev) => prev.map(l => l.id === loan.id ? { ...l, returned: true, returnDate: new Date() } : l));
      // Update available count in UI
      if (loan.bookId) {
        setBooks(prev => prev.map(b => b.id === loan.bookId ? { ...b, available: (b.available || 0) + 1 } : b));
      }
    } catch (error) {
      alert(
        "Permission denied. Please contact your administrator. This might be due to incorrect collection paths or security rules."
      );
    }
  };
  const handleRenewLoan = async (loan) => {
    if (loan.renewed || loan.status === 'renewed') return; // Already renewed
    try {
      const loanRef = doc(db, 'artifacts', appId, 'public', 'data', 'loans', loan.id);
      await updateDoc(loanRef, { status: 'renewed', renewed: true });
      setMyLoans((prev) => prev.map(l => l.id === loan.id ? { ...l, status: 'renewed', renewed: true } : l));
    } catch (error) {
      alert('Failed to renew loan: ' + (error.message || error));
    }
  };

  // Render
  const renderTabContent = () => {
    switch (activeTab) {
      case 'browse':
        return <>
          <div style={{ maxWidth: 700, margin: '0 auto 24px auto', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by title, author, or genre..."
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 16,
                outline: 'none',
                boxShadow: '0 1px 4px rgba(59,130,246,0.06)',
                background: '#fff',
              }}
            />
            {allTags.length > 0 && (
              <div style={{ position: 'relative', minHeight: 32 }}>
                {!tagSelectorOpen ? (
                  <button
                    onClick={() => setTagSelectorOpen(true)}
                    style={{
                      background: '#e0e7ff',
                      color: '#3730a3',
                      border: 'none',
                      borderRadius: 8,
                      padding: '4px 16px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      minWidth: 120,
                    }}
                  >
                    {selectedTag ? `Tag: ${selectedTag}` : 'Filter by tag'}
                  </button>
                ) : (
                  <div
                    className="tag-selector-dropdown"
                    style={{
                      position: 'absolute',
                      zIndex: 10,
                      background: '#fff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 10,
                      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
                      padding: 12,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      minWidth: 220,
                    }}
                    tabIndex={-1}
                  >
                    <button
                      onClick={() => {
                        setSelectedTag(null);
                        setTagSelectorOpen(false);
                      }}
                      style={{
                        background: !selectedTag ? '#3b82f6' : '#e0e7ff',
                        color: !selectedTag ? '#fff' : '#3730a3',
                        border: 'none',
                        borderRadius: 8,
                        padding: '4px 12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      All
                    </button>
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => {
                          setSelectedTag(tag);
                          setTagSelectorOpen(false);
                        }}
                        style={{
                          background: selectedTag === tag ? '#3b82f6' : '#e0e7ff',
                          color: selectedTag === tag ? '#fff' : '#3730a3',
                          border: 'none',
                          borderRadius: 8,
                          padding: '4px 12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Sort by dropdown */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '8px 12px',
                fontWeight: 600,
                color: '#3730a3',
                cursor: 'pointer',
                minWidth: 120,
              }}
              title="Sort books by..."
            >
              <option value="title">Title (A-Z)</option>
              <option value="authorFirst">Author Firstname (A-Z)</option>
              <option value="authorLast">Author Lastname (A-Z)</option>
              <option value="genre">Genre (A-Z)</option>
              <option value="available">Available (most first)</option>
            </select>
          </div>
          <BookGrid books={filteredBooks} isBorrowing={isBorrowing} onBookClick={handleBookClick} onBorrowBook={handleBorrowBook} gridClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" />
        </>;
      case 'my-loans':
        return <LoanList myLoans={myLoans} onRenewLoan={handleRenewLoan} onReturnBook={handleReturnBook} onBrowse={() => setActiveTab('browse')} loanPeriodDays={loanPeriodDays} renewPeriodDays={renewPeriodDays} />;
      case 'reviews':
        return <ReviewList myReviews={myReviews} onBrowse={() => setActiveTab('browse')} />;
      default:
        return <div>Select a tab to view content</div>;
    }
  };

  // Add a click handler to close the tag selector when clicking outside
  useEffect(() => {
    if (!tagSelectorOpen) return;
    const handleClick = (e) => {
      if (!e.target.closest('.tag-selector-dropdown')) {
        setTagSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [tagSelectorOpen]);

  return (
    <div className="w-full">
      <h2 className="text-4xl font-extrabold text-gray-800 mb-8 text-center">Patron Dashboard</h2>
      <div className="bg-blue-50 rounded-lg p-4 mb-6">
        <p className="text-blue-800">Welcome back, {currentUser?.email || 'Patron'}! Ready to discover your next great read?</p>
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
      <div className="min-h-96">{renderTabContent()}</div>
      {/* Book Details Modal for patrons */}
      {showBookModal && selectedBook && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4" onClick={() => setShowBookModal(false)}>
          <div className="bg-white rounded-lg max-w-xl w-full shadow-lg relative" style={{ maxHeight: '90vh', width: '100%', overflowY: 'visible', overflowX: 'visible', display: 'flex', flexDirection: 'column', wordBreak: 'break-word' }} onClick={e => e.stopPropagation()}>
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
                {/* Average rating display */}
                <div className="flex items-center mb-2">
                  {typeof bookRatings[selectedBook.id] === 'number' ? (
                    <span className="flex items-center">
                      {[1,2,3,4,5].map(i => {
                        if (bookRatings[selectedBook.id] >= i) {
                          return <Star key={i} size={18} className="text-yellow-400 fill-yellow-400 mr-0.5" fill="#facc15" />;
                        } else if (bookRatings[selectedBook.id] >= i - 0.5) {
                          return <StarHalf key={i} size={18} className="text-yellow-400 fill-yellow-400 mr-0.5" fill="#facc15" />;
                        } else {
                          return <Star key={i} size={18} className="text-gray-300 mr-0.5" />;
                        }
                      })}
                      <span className="text-xs text-gray-600 ml-1">{bookRatings[selectedBook.id].toFixed(1)}/5</span>
                    </span>
                  ) : (
                    <span className="text-sm text-gray-600">No rating</span>
                  )}
                </div>
                {/* Reviews section */}
                <div className="mt-2">
                  <div className="font-semibold text-slate-700 mb-1">Reviews</div>
                  {loadingReviews ? (
                    <div className="text-xs text-gray-400">Loading reviews...</div>
                  ) : bookReviews.length === 0 ? (
                    <div className="text-xs text-gray-400">No reviews yet for this book.</div>
                  ) : (
                    <div className="space-y-2 pr-1" style={{ maxWidth: '100%', wordBreak: 'break-word' }}>
                      {bookReviews.map(r => (
                        <div key={r.id} className="bg-slate-50 rounded p-2 shadow-inner" style={{ maxWidth: '100%', wordBreak: 'break-word' }}>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-xs text-blue-700">{r.userName || 'Anonymous'}</span>
                            <span className="flex flex-row items-center gap-1" style={{ maxWidth: '100%' }}>
                              {[1,2,3,4,5].map(i => (
                                <button
                                  key={i}
                                  type="button"
                                  className="group/star p-0.5 rounded-full focus:outline-none"
                                  style={{ cursor: savingReview ? 'not-allowed' : 'pointer', background: 'transparent', border: 'none' }}
                                  onClick={() => setEditingReviewRating(i)}
                                  onMouseEnter={() => setHoveredRating(i)}
                                  onMouseLeave={() => setHoveredRating(0)}
                                  disabled={savingReview}
                                >
                                  {(hoveredRating ? i <= hoveredRating : i <= editingReviewRating)
                                    ? <StarIcon size={22} className="text-yellow-400 transition-colors duration-150" />
                                    : <Star size={22} className="text-gray-300 transition-colors duration-150" />
                                  }
                                </button>
                              ))}
                            </span>
                            <span className="text-xs text-gray-400 ml-2">{r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toLocaleDateString() : ''}</span>
                            {currentUser && r.userId === currentUser.uid && (
                              editingReviewId === r.id ? null : (
                                <button
                                  className="ml-2 text-xs text-blue-600 hover:underline"
                                  onClick={() => {
                                    setEditingReviewId(r.id);
                                    setEditingReviewText(r.reviewText || '');
                                    setEditingReviewRating(r.rating || 0);
                                  }}
                                >Edit</button>
                              )
                            )}
                          </div>
                          {editingReviewId === r.id ? (
                            <div className="mt-1 space-y-1 p-2 bg-white rounded shadow max-w-full" style={{ boxSizing: 'border-box', wordBreak: 'break-word' }}>
                              <textarea
                                className="w-full text-xs border rounded p-1 resize-none"
                                style={{ minHeight: 48, maxHeight: 96, maxWidth: '100%' }}
                                rows={2}
                                value={editingReviewText}
                                onChange={e => setEditingReviewText(e.target.value)}
                                disabled={savingReview}
                              />
                              <div className="flex flex-row items-center gap-2">
                                <span className="text-xs">Rating:</span>
                                <div className="flex flex-row items-center gap-1" style={{ maxWidth: '100%' }}>
                                  {[1,2,3,4,5].map(i => (
                                    <button
                                      key={i}
                                      type="button"
                                      className="group/star p-0.5 rounded-full focus:outline-none"
                                      style={{ cursor: savingReview ? 'not-allowed' : 'pointer', background: 'transparent', border: 'none' }}
                                      onClick={() => setEditingReviewRating(i)}
                                      onMouseEnter={() => setHoveredRating(i)}
                                      onMouseLeave={() => setHoveredRating(0)}
                                      disabled={savingReview}
                                    >
                                      {(hoveredRating ? i <= hoveredRating : i <= editingReviewRating)
                                        ? <StarIcon size={22} className="text-yellow-400 transition-colors duration-150" />
                                        : <Star size={22} className="text-gray-300 transition-colors duration-150" />
                                      }
                                    </button>
                                  ))}
                                  <span className="ml-2 text-xs text-gray-500" style={{ maxWidth: '100%', wordBreak: 'break-word' }}>
                                    {hoveredRating ? ratingLabels[hoveredRating-1] : (editingReviewRating ? ratingLabels[editingReviewRating-1] : '')}
                                  </span>
                                </div>
                                <button
                                  className="ml-2 px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                  disabled={savingReview || !editingReviewText.trim()}
                                  onClick={async () => {
                                    if (!db || !appId || !selectedBook) return;
                                    setSavingReview(true);
                                    try {
                                      const reviewRef = doc(db, 'artifacts', appId, 'public', 'data', 'reviews', r.id);
                                      await updateDoc(reviewRef, {
                                        reviewText: editingReviewText,
                                        rating: editingReviewRating,
                                        updatedAt: serverTimestamp(),
                                      });
                                      setBookReviews(prev => prev.map(rv => rv.id === r.id ? { ...rv, reviewText: editingReviewText, rating: editingReviewRating } : rv));
                                      setEditingReviewId(null);
                                    } catch (err) {
                                      alert('Failed to update review: ' + (err.message || err));
                                    } finally {
                                      setSavingReview(false);
                                    }
                                  }}
                                >Save</button>
                                <button
                                  className="px-2 py-0.5 text-xs bg-gray-200 rounded hover:bg-gray-300 ml-1"
                                  onClick={() => setEditingReviewId(null)}
                                  disabled={savingReview}
                                >Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-700 whitespace-pre-line">{r.reviewText}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Add review form for all books */}
                  {currentUser && !bookReviews.some(r => r.userId === currentUser.uid) && (
                    <div className="mt-3 p-2 bg-slate-50 rounded shadow-inner">
                      <div className="font-semibold text-xs mb-1">Add your review</div>
                      <textarea
                        className="w-full text-xs border rounded p-1 resize-none mb-2"
                        style={{ minHeight: 48, maxHeight: 96, maxWidth: '100%' }}
                        rows={2}
                        value={newReviewText}
                        onChange={e => setNewReviewText(e.target.value)}
                        placeholder="Write your review..."
                        disabled={submittingReview}
                      />
                      <div className="flex flex-row items-center gap-2 mb-2">
                        <span className="text-xs">Rating:</span>
                        <div className="flex flex-row items-center gap-1">
                          {[1,2,3,4,5].map(i => (
                            <button
                              key={i}
                              type="button"
                              className="group/star p-0.5 rounded-full focus:outline-none"
                              style={{ cursor: submittingReview ? 'not-allowed' : 'pointer', background: 'transparent', border: 'none' }}
                              onClick={() => setNewReviewRating(i)}
                              disabled={submittingReview}
                            >
                              {i <= newReviewRating
                                ? <StarIcon size={22} className="text-yellow-400 transition-colors duration-150" />
                                : <Star size={22} className="text-gray-300 transition-colors duration-150" />
                              }
                            </button>
                          ))}
                        </div>
                        <span className="ml-2 text-xs text-gray-500">{newReviewRating ? ratingLabels[newReviewRating-1] : ''}</span>
                      </div>
                      <button
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        disabled={submittingReview || !newReviewText.trim() || !newReviewRating}
                        onClick={async () => {
                          if (!db || !appId || !selectedBook) return;
                          setSubmittingReview(true);
                          try {
                            const reviewsRef = collection(db, 'artifacts', appId, 'public', 'data', 'reviews');
                            const docRef = await addDoc(reviewsRef, {
                              userId: currentUser.uid,
                              userName: currentUser.displayName || currentUser.email || 'Anonymous',
                              bookId: selectedBook.id,
                              bookTitle: selectedBook.title || '',
                              reviewText: newReviewText,
                              rating: newReviewRating,
                              createdAt: serverTimestamp(),
                            });
                            setBookReviews(prev => [...prev, {
                              id: docRef.id,
                              userId: currentUser.uid,
                              userName: currentUser.displayName || currentUser.email || 'Anonymous',
                              bookId: selectedBook.id,
                              bookTitle: selectedBook.title || '',
                              reviewText: newReviewText,
                              rating: newReviewRating,
                              createdAt: new Date(),
                            }]);
                            setMyReviews(prev => [...prev, {
                              id: docRef.id,
                              userId: currentUser.uid,
                              userName: currentUser.displayName || currentUser.email || 'Anonymous',
                              bookId: selectedBook.id,
                              bookTitle: selectedBook.title || '',
                              reviewText: newReviewText,
                              rating: newReviewRating,
                              createdAt: new Date(),
                            }]);
                            setNewReviewText('');
                            setNewReviewRating(0);
                          } catch (err) {
                            alert('Failed to submit review: ' + (err.message || err));
                          } finally {
                            setSubmittingReview(false);
                          }
                        }}
                      >Submit Review</button>
                    </div>
                  )}
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
        </div>
      )}
      {/* Borrowed confirmation modal */}
      {showBorrowedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4" onClick={() => setShowBorrowedModal(false)}>
          <div className="bg-white rounded-lg max-w-sm w-full shadow-lg relative p-6 flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Book Added to Loans</h3>
            <p className="text-gray-700 text-center mb-4">The book has been added to your loans and is <b>awaiting confirmation from the library</b>. This will be granted when the book is handed out to you by a librarian.</p>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
              onClick={() => setShowBorrowedModal(false)}
            >OK</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatronDashboard;