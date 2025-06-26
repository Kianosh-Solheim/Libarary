import React from 'react';
import { Star } from 'lucide-react';
import formatDate from '../formatDate';

const ReviewList = ({ myReviews, onBrowse }) => (
  <div className="bg-white rounded-lg shadow p-6">
    {myReviews.length > 0 ? (
      <div className="space-y-4">
        {myReviews.map((review) => (
          <div key={review.id} className="border rounded-lg p-4 hover:bg-gray-50">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-800">{review.bookTitle || 'Unknown Book'}</span>
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`text-sm ${star <= review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-xs text-gray-500">{formatDate(review.createdAt)}</span>
            </div>
            <p className="text-gray-700">{review.reviewText}</p>
          </div>
        ))}
      </div>
    ) : (
      <div className="text-center py-8">
        <Star size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500 mb-4">You haven't written any reviews yet.</p>
        <button 
          onClick={onBrowse}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Browse Books to Review
        </button>
      </div>
    )}
  </div>
);

export default ReviewList; 