import React from 'react';

const UserList = ({ users, loading, onEditUser, onDeleteUser }) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h3 className="text-2xl font-bold text-gray-800">User Management</h3>
      <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
        Add User
      </button>
    </div>
    <div className="bg-white rounded-lg shadow p-6">
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading users...</p>
        </div>
      ) : users.length > 0 ? (
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Name</th>
              <th className="text-left py-2">Email</th>
              <th className="text-left py-2">Role</th>
              <th className="text-left py-2">Status</th>
              <th className="text-left py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="py-2">{user.name || user.displayName || 'N/A'}</td>
                <td className="py-2">{user.email || 'N/A'}</td>
                <td className="py-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    user.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {user.role === 'admin' ? 'Administrator' : 'Patron'}
                  </span>
                </td>
                <td className="py-2">
                  <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                    Active
                  </span>
                </td>
                <td className="py-2">
                  <button 
                    onClick={() => onEditUser(user)}
                    className="text-blue-600 hover:text-blue-800 text-sm mr-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteUser(user)}
                    className={`text-red-600 hover:text-red-800 text-sm ${user.isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!!user.isLocked}
                    title={user.isLocked ? 'Cannot delete a locked account. Unlock the account first.' : 'Delete'}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No users found.</p>
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Add First User
          </button>
        </div>
      )}
    </div>
  </div>
);

export default UserList; 