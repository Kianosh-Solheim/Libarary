import React, { useState, useEffect } from 'react';
import { useFirebase } from '../../App';
import { FiEdit2, FiLock, FiUnlock } from 'react-icons/fi';
console.log('BookList render');

const editBtnStyle = {
  position: 'absolute',
  top: 12,
  right: 12,
  background: '#fff',
  border: '1px solid #cbd5e1',
  borderRadius: '50%',
  padding: 7,
  boxShadow: '0 2px 8px rgba(59,130,246,0.10)',
  cursor: 'pointer',
  zIndex: 2,
  transition: 'opacity 0.2s',
  pointerEvents: 'auto',
};
const editBtnVisible = { opacity: 1 };

const BookList = ({ books, onBookClick, onEditBook, onFetchAllCovers }) => {
  const [view, setView] = useState('grid'); // 'grid' or 'list'
  const [editMode, setEditMode] = useState(false); // lock/unlock state
  const { currentUser, isAuthReady } = useFirebase();
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [authorModal, setAuthorModal] = useState({ show: false, author: null });
  const [tagSelectorOpen, setTagSelectorOpen] = useState(false);

  // Collect all unique tags
  const allTags = Array.from(new Set(
    books.flatMap(book => (book.tags ? book.tags.split(',').map(t => t.trim()).filter(Boolean) : []))
  ));

  // Filter books by search and selected tag
  const filteredBooks = books.filter(book => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term ||
      (book.title && book.title.toLowerCase().includes(term)) ||
      (book.author && book.author.toLowerCase().includes(term)) ||
      (book.genre && book.genre.toLowerCase().includes(term));
    const matchesTag = !selectedTag || (book.tags && book.tags.split(',').map(t => t.trim()).includes(selectedTag));
    return matchesSearch && matchesTag;
  });

  // Books by selected author
  const booksByAuthor = authorModal.author
    ? books.filter(b => b.author && b.author.toLowerCase() === authorModal.author.toLowerCase())
    : [];

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
    <div style={{ padding: 40, background: '#f3f4f6', minHeight: '100vh' }}>
      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div style={{ marginBottom: 16, position: 'relative', minHeight: 32 }}>
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
              onBlur={() => setTagSelectorOpen(false)}
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
      <div style={{ maxWidth: 400, margin: '0 auto 24px auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
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
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 24, gap: 8 }}>
        <button
          onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
          style={{
            background: '#fff',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            padding: '8px 18px',
            fontWeight: 600,
            color: '#3b82f6',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(59,130,246,0.06)',
            marginRight: 8,
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          {view === 'grid' ? 'List View' : 'Grid View'}
        </button>
        <button
          onClick={onFetchAllCovers}
          style={{
            background: '#e0e7ff',
            color: '#3730a3',
            border: 'none',
            borderRadius: 8,
            padding: '8px 18px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(59,130,246,0.06)',
            marginRight: 8,
            transition: 'background 0.2s, color 0.2s',
          }}
          title="Try to fetch covers for all books"
        >
          Fetch Covers
        </button>
        <button
          onClick={() => {
            if (isAuthReady) setEditMode(em => !em);
          }}
          disabled={!isAuthReady}
          style={{
            background: editMode ? '#fbbf24' : '#fff',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            padding: '8px 12px',
            fontWeight: 600,
            color: editMode ? '#fff' : '#64748b',
            cursor: !isAuthReady ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(59,130,246,0.06)',
            transition: 'background 0.2s, color 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: !isAuthReady ? 0.6 : 1,
          }}
          title={
            !isAuthReady ? 'Checking authentication...' :
            (editMode ? 'Edit Mode: Click to lock (view only)' : 'View Mode: Click to unlock (edit on click)')
          }
        >
          {!isAuthReady ? (
            <span className="animate-spin" style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid #cbd5e1', borderTop: '2px solid #3b82f6', borderRadius: '50%' }}></span>
          ) : (
            editMode ? <FiUnlock size={18} /> : <FiLock size={18} />
          )}
          {editMode && isAuthReady ? 'Edit Unlocked' : 'Edit Locked'}
        </button>
      </div>
      {view === 'grid' ? (
        <div
          className="grid gap-7 justify-center items-stretch"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            willChange: 'transform, opacity',
          }}
        >
          {filteredBooks.map((book, idx) => (
            <div
              key={book.id}
              className="relative group"
              style={{ '--fade-delay': `${idx * 60}ms` }}
            >
              <div
                className="cursor-pointer transition-all duration-300 rounded-2xl overflow-visible bg-gradient-to-br from-white via-blue-50 to-blue-100 shadow-lg border border-slate-100 hover:scale-105 hover:ring-2 hover:ring-blue-300 book-card-hover-group flex flex-col items-center relative"
                style={{
                  boxShadow: '0 6px 24px rgba(59,130,246,0.10)',
                  border: 'none',
                  padding: 18,
                  position: 'relative',
                  overflow: 'visible',
                  width: '100%',
                  height: '100%',
                  minWidth: 0,
                  maxWidth: '100%',
                }}
                onClick={e => {
                  if (editMode && currentUser?.role === 'admin') {
                    console.log('[BookList] Book clicked in EDIT MODE:', book);
                    onEditBook(book);
                  } else {
                    console.log('[BookList] Book clicked in VIEW MODE:', book);
                    onBookClick(book);
                  }
                }}
                onContextMenu={e => {
                  console.log('onContextMenu fired', book);
                  if (currentUser?.role === 'admin') {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('ADMIN RIGHT CLICK - edit', book);
                    if (e.currentTarget) {
                      e.currentTarget.style.border = '2px solid red';
                      setTimeout(() => { if (e.currentTarget) e.currentTarget.style.border = ''; }, 300);
                    } else {
                      console.log('currentTarget is null');
                    }
                    onEditBook(book);
                  } else {
                    e.preventDefault();
                  }
                }}
              >
                <div style={{ width: '100%', height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                    <img
                      src={book.coverUrl || 'https://placehold.co/120x180/3b82f6/ffffff?text=📚'}
                      alt={`Cover of ${book.title || 'Book'}`}
                      style={{ width: 120, height: 180, objectFit: 'cover', borderRadius: 10, marginBottom: 16, boxShadow: '0 2px 8px rgba(59,130,246,0.08)' }}
                      onError={e => { e.target.src = 'https://placehold.co/120x180/3b82f6/ffffff?text=📚'; }}
                    />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6, textAlign: 'center', color: '#1e293b', minHeight: 44 }}>{book.title || 'Untitled Book'}</div>
                  <div style={{ color: '#64748b', fontSize: 14, marginBottom: 8, textAlign: 'center', minHeight: 20 }}>
                    {book.author ? (
                      <span
                        style={{ color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={e => {
                          e.stopPropagation();
                          setAuthorModal({ show: true, author: book.author });
                        }}
                        title={`See more about ${book.author}`}
                      >
                        {book.author}
                      </span>
                    ) : 'Unknown Author'}
                  </div>
                  {/* Genre/Tag chip */}
                  {book.genre && (
                    <span style={{
                      display: 'inline-block',
                      background: '#e0e7ff',
                      color: '#3730a3',
                      borderRadius: 8,
                      fontSize: 12,
                      padding: '2px 10px',
                      marginBottom: 10,
                      fontWeight: 500,
                    }}>{book.genre}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {filteredBooks.map((book, idx) => (
            <div
              key={book.id}
              className="relative group"
              style={{ '--fade-delay': `${idx * 60}ms` }}
            >
              <div
                className="flex items-center bg-white rounded-2xl shadow-lg transition-all duration-300 cursor-pointer relative"
                style={{
                  borderRadius: 14,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  marginBottom: 18,
                  padding: 16,
                  border: 'none',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                }}
                onClick={e => {
                  if (editMode && currentUser?.role === 'admin') {
                    console.log('[BookList] Book clicked in EDIT MODE:', book);
                    onEditBook(book);
                  } else {
                    console.log('[BookList] Book clicked in VIEW MODE:', book);
                    onBookClick(book);
                  }
                }}
                onContextMenu={e => {
                  console.log('onContextMenu fired', book);
                  if (currentUser?.role === 'admin') {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('ADMIN RIGHT CLICK - edit', book);
                    if (e.currentTarget) {
                      e.currentTarget.style.border = '2px solid red';
                      setTimeout(() => { if (e.currentTarget) e.currentTarget.style.border = ''; }, 300);
                    } else {
                      console.log('currentTarget is null');
                    }
                    onEditBook(book);
                  } else {
                    e.preventDefault();
                  }
                }}
              >
                <img
                  src={book.coverUrl || 'https://placehold.co/60x90/3b82f6/ffffff?text=📚'}
                  alt={`Cover of ${book.title || 'Book'}`}
                  style={{ width: 60, height: 90, objectFit: 'cover', borderRadius: 6, marginRight: 18, boxShadow: '0 1px 4px rgba(59,130,246,0.08)' }}
                  onError={e => { e.target.src = 'https://placehold.co/60x90/3b82f6/ffffff?text=📚'; }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', marginBottom: 2 }}>{book.title || 'Untitled Book'}</div>
                  <div style={{ color: '#64748b', fontSize: 13, marginBottom: 2 }}>
                    {book.author ? (
                      <span
                        style={{ color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={e => {
                          e.stopPropagation();
                          setAuthorModal({ show: true, author: book.author });
                        }}
                        title={`See more about ${book.author}`}
                      >
                        {book.author}
                      </span>
                    ) : 'Unknown Author'}
                  </div>
                  {book.genre && (
                    <span style={{
                      display: 'inline-block',
                      background: '#e0e7ff',
                      color: '#3730a3',
                      borderRadius: 8,
                      fontSize: 12,
                      padding: '2px 10px',
                      marginTop: 2,
                      fontWeight: 500,
                    }}>{book.genre}</span>
                  )}
                </div>
                <span style={{
                  background: book.available > 0 ? '#10b981' : '#ef4444',
                  color: '#fff',
                  borderRadius: 10,
                  fontSize: 12,
                  padding: '2px 10px',
                  fontWeight: 600,
                  marginLeft: 16,
                  minWidth: 60,
                  textAlign: 'center',
                }}>{book.available > 0 ? 'Available' : 'Out'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Author modal */}
      {authorModal.show && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setAuthorModal({ show: false, author: null })}
        >
          <div
            style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 320, maxWidth: 480, boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#1e293b' }}>{authorModal.author}</h3>
            <div style={{ color: '#64748b', marginBottom: 16 }}>Books by this author in your library:</div>
            <ul style={{ marginBottom: 16 }}>
              {booksByAuthor.length > 0 ? booksByAuthor.map(b => (
                <li key={b.id} style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>{b.title}</span> <span style={{ color: '#64748b', fontSize: 13 }}>({b.isbn})</span>
                </li>
              )) : <li style={{ color: '#64748b' }}>No other books found.</li>}
            </ul>
            <button
              onClick={() => setAuthorModal({ show: false, author: null })}
              style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(BookList); 