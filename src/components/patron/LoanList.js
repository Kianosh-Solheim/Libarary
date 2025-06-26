import React, { useEffect, useState } from 'react';
import formatDate from '../formatDate';

// Helper to get due date (loanPeriodDays or renewPeriodDays after loanDate)
const getDueDate = (loan, loanPeriodDays, renewPeriodDays) => {
  const date = loan.loanDate?.toDate ? loan.loanDate.toDate() : new Date(loan.loanDate);
  const days = loan.renewed || loan.status === 'renewed' ? renewPeriodDays : loanPeriodDays;
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
};

// Helper to format countdown
const formatCountdown = (ms) => {
  const absMs = Math.abs(ms);
  const days = Math.floor(absMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((absMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((absMs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((absMs % (60 * 1000)) / 1000);
  return `${days}d ${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
};

const LoanList = ({ myLoans, onRenewLoan, onReturnBook, onBrowse, loanPeriodDays = 14, renewPeriodDays = 14 }) => {
  // Sort: active (not returned) first, then returned
  const sortedLoans = [...myLoans].sort((a, b) => {
    if (a.returned === b.returned) return 0;
    return a.returned ? 1 : -1;
  });

  // State for countdowns
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {sortedLoans.length > 0 ? (
        <div className="space-y-4">
          {sortedLoans.map((loan) => {
            const dueDate = getDueDate(loan, loanPeriodDays, renewPeriodDays);
            const msLeft = dueDate - now;
            const showCountdown = !loan.returned && loan.status !== 'pending' && (loan.status === 'active' || loan.status === 'renewed');
            return (
              <div key={loan.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-800">{loan.bookTitle || 'Unknown Book'}</h4>
                    <p className="text-sm text-gray-500">Borrowed: {formatDate(loan.loanDate)}</p>
                    {loan.returnDate && (
                      <p className="text-sm text-gray-500">Returned: {formatDate(loan.returnDate)}</p>
                    )}
                    {showCountdown && (
                      <p className={`text-sm font-semibold mt-1 ${msLeft < 0 ? 'text-red-600' : 'text-blue-700'}`}
                         title={`Due date: ${dueDate.toLocaleString()}`}>
                        {msLeft >= 0
                          ? `Due in ${formatCountdown(msLeft)}`
                          : `Overdue by ${formatCountdown(msLeft)}`}
                      </p>
                    )}
                    {!loan.returned && loan.status !== 'pending' && (
                      <p className="text-xs text-gray-500 mt-1">To return a book, please visit the library desk.</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs ${
                      loan.returned ? 'bg-gray-100 text-gray-800' :
                      loan.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      loan.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {loan.returned ? 'Returned' :
                       loan.status === 'pending' ? 'Pending' :
                       loan.status === 'active' ? 'Active' :
                       loan.status === 'renewed' ? 'Renewed' : 'Overdue'}
                    </span>
                    <div className="mt-2">
                      {!loan.returned && loan.status !== 'pending' && (
                        <>
                          <button
                            className={
                              loan.renewed || loan.status === 'renewed'
                                ? 'text-gray-400 bg-gray-100 cursor-not-allowed text-sm mr-3 px-2 py-1 rounded'
                                : 'text-blue-600 hover:text-blue-800 text-sm mr-3'
                            }
                            onClick={() => {
                              if (!(loan.renewed || loan.status === 'renewed')) onRenewLoan(loan);
                            }}
                            disabled={loan.renewed || loan.status === 'renewed'}
                          >
                            {loan.renewed || loan.status === 'renewed' ? 'Can only be renewed once' : 'Renew'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">You don't have any active loans.</p>
          <button 
            onClick={onBrowse}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Browse Books
          </button>
        </div>
      )}
    </div>
  );
};

export default LoanList; 