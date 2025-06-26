import React from 'react';
import { Star, StarHalf, Star as StarFilled } from 'lucide-react';

const BookGrid = ({ books, isBorrowing, onBookClick, onBorrowBook, gridClassName }) => (
  <div className={gridClassName || "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"}>
    {books.length > 0 ? (
      books.map((book, idx) => (
        <div
          key={book.id}
          className="group cursor-pointer transition-all duration-300 rounded-2xl overflow-visible fade-up bg-gradient-to-br from-white via-blue-50 to-blue-100 shadow-lg border border-slate-100 hover:scale-105 hover:ring-2 hover:ring-blue-300"
          style={{
            boxShadow: '0 6px 24px rgba(59,130,246,0.10)',
            border: 'none',
            '--fade-delay': `${idx * 60}ms`,
          }}
          onClick={() => onBookClick(book)}
        >
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: 18 }}>
            <img
              src={book.coverUrl || "https://placehold.co/120x180/3b82f6/ffffff?text=📚"}
              alt={`Cover of ${book.title || 'Book'}`}
              style={{ width: 120, height: 180, objectFit: 'cover', borderRadius: 10, marginBottom: 16, boxShadow: '0 2px 8px rgba(59,130,246,0.08)' }}
              onError={e => { e.target.src = "https://placehold.co/120x180/3b82f6/ffffff?text=📚"; }}
            />
          </div>
          <div className="p-3 pt-0">
            <h4 className="font-semibold text-gray-800 text-base leading-tight line-clamp-2 mb-1 text-center">
              {book.title || 'Untitled Book'}
            </h4>
            <p className="text-xs text-gray-600 line-clamp-1 mb-2 text-center">
              by {book.author || 'Unknown Author'}
            </p>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                {/* Star rating display with half stars */}
                {typeof book.rating === 'number' ? (
                  <span className="flex items-center">
                    {[1,2,3,4,5].map(i => {
                      if (book.rating >= i) {
                        // Filled star
                        return <StarFilled key={i} size={12} className="text-yellow-400 fill-yellow-400 mr-0.5" fill="#facc15" />;
                      } else if (book.rating >= i - 0.5) {
                        // Filled half star
                        return <StarHalf key={i} size={12} className="text-yellow-400 fill-yellow-400 mr-0.5" fill="#facc15" />;
                      } else {
                        // Hollow/gray star
                        return <Star key={i} size={12} className="text-gray-300 mr-0.5" />;
                      }
                    })}
                    <span className="text-xs text-gray-600 ml-1">{book.rating.toFixed(1)}/5</span>
                  </span>
                ) : (
                  <span className="text-sm text-gray-600">No rating</span>
                )}
              </div>
              {book.genre && (
                <span className="text-xs text-gray-500">{book.genre}</span>
              )}
            </div>
            <button
              className={`w-full py-2 rounded-lg transition-colors text-xs font-medium ${
                book.available > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              disabled={book.available <= 0 || isBorrowing}
              onClick={e => { e.stopPropagation(); if (book.available > 0) onBorrowBook(book); }}
            >
              {isBorrowing ? 'Borrowing...' : (book.available > 0 ? 'Borrow' : 'Unavailable')}
            </button>
          </div>
        </div>
      ))
    ) : (
      <div className="col-span-full text-center py-8">
        <p className="text-gray-500 mb-4">No books available in the library.</p>
        <p className="text-sm text-gray-400">Check back later for new additions!</p>
      </div>
    )}
  </div>
);

export default BookGrid; 