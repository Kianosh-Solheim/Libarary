import React from 'react';
import formatDate from '../formatDate';
import ScanLibraryCard from '../ScanLibraryCard';
import { Plus } from 'lucide-react';

const ActiveLoansTable = ({ filteredLoans, loadingActiveLoans, searchTerm, setSearchTerm, onRefresh, onOpenScanner, onScanCard, onForceReturn, showScanner, setShowScanner, onAddLoan, onConfirmPending }) => {
  const pendingLoans = filteredLoans.filter(loan => loan.status === 'pending');
  const activeLoans = filteredLoans.filter(loan => loan.status !== 'pending');
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-gray-800">Active Loans</h3>
        <div className="flex space-x-2">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or card number"
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={onRefresh}
            disabled={loadingActiveLoans}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh active loans"
          >
            {loadingActiveLoans ? 'Refreshing...' : '🔄'}
          </button>
          <button
            onClick={onOpenScanner}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Scan Library Card
          </button>
          <button
            onClick={onAddLoan}
            className="p-2 bg-blue-100 hover:bg-blue-200 rounded-full flex items-center justify-center"
            title="Add New Loan"
          >
            <Plus size={20} className="text-blue-600" />
          </button>
        </div>
      </div>
      {/* Pending Loans Section */}
      <div className="bg-yellow-50 rounded-lg shadow p-6 mb-6">
        <h4 className="text-lg font-bold text-yellow-800 mb-4">Pending Loans</h4>
        {pendingLoans.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left">Book</th>
                <th className="py-2 text-left">User</th>
                <th className="py-2 text-left">Email</th>
                <th className="py-2 text-left">Card #</th>
                <th className="py-2 text-left">Loan Date</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingLoans.map((loan) => (
                <tr key={loan.id} className="border-b hover:bg-yellow-100">
                  <td className="py-2">{loan.book?.title || 'N/A'}</td>
                  <td className="py-2">{loan.user?.name || loan.user?.displayName || 'N/A'}</td>
                  <td className="py-2">{loan.user?.email || 'N/A'}</td>
                  <td className="py-2">{loan.user?.cardNumber || 'N/A'}</td>
                  <td className="py-2">{formatDate(loan.loanDate)}</td>
                  <td className="py-2">
                    <span className="px-2 py-1 rounded text-xs bg-yellow-200 text-yellow-900">Pending</span>
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => onConfirmPending && onConfirmPending(loan)}
                      className="px-2 py-1 rounded text-xs bg-green-600 text-white hover:bg-green-700"
                    >
                      Confirm
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-4 text-yellow-700">No pending loans.</div>
        )}
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        {loadingActiveLoans ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading active loans...</p>
          </div>
        ) : filteredLoans.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left">Book</th>
                <th className="py-2 text-left">User</th>
                <th className="py-2 text-left">Email</th>
                <th className="py-2 text-left">Card #</th>
                <th className="py-2 text-left">Loan Date</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeLoans.map((loan) => (
                <tr key={loan.id} className="border-b hover:bg-gray-50">
                  <td className="py-2">{loan.book?.title || 'N/A'}</td>
                  <td className="py-2">{loan.user?.name || loan.user?.displayName || 'N/A'}</td>
                  <td className="py-2">{loan.user?.email || 'N/A'}</td>
                  <td className="py-2">{loan.user?.cardNumber || 'N/A'}</td>
                  <td className="py-2">{formatDate(loan.loanDate)}</td>
                  <td className="py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      loan.forceReturnedBy ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {loan.forceReturnedBy ? 'Force Returned' : 'Active'}
                    </span>
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => onForceReturn(loan)}
                      disabled={loan.forceReturnedBy}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        loan.forceReturnedBy 
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                      title={loan.forceReturnedBy ? 'Already force returned' : 'Force return this book'}
                    >
                      {loan.forceReturnedBy ? 'Force Returned' : 'Force Return'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No active loans found.</p>
          </div>
        )}
      </div>
      {/* Barcode Scanner Modal */}
      {showScanner && (
        <ScanLibraryCard
          onScan={cardNumber => {
            if (onScanCard) onScanCard(cardNumber);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
};

export default ActiveLoansTable; 