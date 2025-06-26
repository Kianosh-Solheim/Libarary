import React, { useState, useRef } from 'react';
import { Home, Trash2 } from 'lucide-react';
import { useFirebase } from '../App';
import { doc, updateDoc } from 'firebase/firestore';
import LoadingSpinner from './LoadingSpinner';

const UserAccount = () => {
  const { currentUser, db, userId, customAppId: appId, showMessage, isAuthReady } = useFirebase();
  const initialLoaded = !!(currentUser && (currentUser.displayName || currentUser.name));
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    name: currentUser?.displayName || currentUser?.name || '',
    phone: currentUser?.phone || '',
    address: currentUser?.address || '',
    email: currentUser?.email || '',
    cardPin: currentUser?.cardPin || ''
  });
  const [loading, setLoading] = useState(false);
  const [hasLoadedUser, setHasLoadedUser] = useState(initialLoaded);
  const lastKnownName = useRef(currentUser?.displayName || currentUser?.name || '');
  const lastKnownEmail = useRef(currentUser?.email || '');
  const lastKnownPhone = useRef(currentUser?.phone || '');
  const lastKnownAddress = useRef(currentUser?.address || '');
  const lastKnownPin = useRef(currentUser?.cardPin || '');

  React.useEffect(() => {
    if (currentUser && (currentUser.displayName || currentUser.name)) {
      setHasLoadedUser(true);
      lastKnownName.current = currentUser.displayName || currentUser.name;
      lastKnownEmail.current = currentUser.email || '';
      lastKnownPhone.current = currentUser.phone || '';
      lastKnownAddress.current = currentUser.address || '';
      lastKnownPin.current = currentUser.cardPin || '';
    }
  }, [currentUser]);

  React.useEffect(() => {
    console.log('UserAccount currentUser:', currentUser);
  }, [currentUser]);

  const handleEdit = () => {
    setForm({
      name: lastKnownName.current,
      email: lastKnownEmail.current,
      phone: lastKnownPhone.current,
      address: lastKnownAddress.current,
      cardPin: lastKnownPin.current
    });
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!db || !appId || !userId) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'artifacts', appId, 'users', userId);
      await updateDoc(userRef, {
        name: form.name,
        displayName: form.name,
        phone: form.phone,
        address: form.address,
        email: form.email,
        cardPin: form.cardPin
      });
      showMessage && showMessage('Account updated!', 'success');
      setEditMode(false);
    } catch (error) {
      showMessage && showMessage('Failed to update account: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthReady) {
    return <div className="max-w-lg mx-auto bg-white rounded-lg shadow p-8 mt-8 text-gray-500">Loading account...</div>;
  }
  if (!currentUser) {
    return <div className="max-w-lg mx-auto bg-white rounded-lg shadow p-8 mt-8 text-gray-500">No user information available.</div>;
  }
  if (!hasLoadedUser) {
    return <div className="max-w-lg mx-auto bg-white rounded-lg shadow p-8 mt-8">
      <div className="space-y-4">
        <div className="h-8 w-1/2 bg-gray-200 rounded animate-pulse mb-4"></div>
        <div className="h-6 w-1/3 bg-gray-200 rounded animate-pulse mb-2"></div>
        <div className="h-6 w-2/3 bg-gray-200 rounded animate-pulse mb-2"></div>
        <div className="h-6 w-1/2 bg-gray-200 rounded animate-pulse mb-2"></div>
        <div className="h-6 w-1/4 bg-gray-200 rounded animate-pulse mb-2"></div>
        <div className="h-6 w-1/4 bg-gray-200 rounded animate-pulse mb-2"></div>
        <div className="h-10 w-full bg-gray-200 rounded animate-pulse mt-4"></div>
      </div>
    </div>;
  }

  return (
    <div className="max-w-lg mx-auto bg-white rounded-lg shadow p-8 mt-8">
      <h2 className="text-2xl font-bold mb-4">My Account</h2>
      {editMode ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            {!hasLoadedUser ? (
              <span className="inline-block w-full h-10 bg-gray-200 rounded animate-pulse"></span>
            ) : (
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            {!hasLoadedUser ? (
              <span className="inline-block w-full h-10 bg-gray-200 rounded animate-pulse"></span>
            ) : (
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            {!hasLoadedUser ? (
              <span className="inline-block w-full h-10 bg-gray-200 rounded animate-pulse"></span>
            ) : (
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            {!hasLoadedUser ? (
              <span className="inline-block w-full h-10 bg-gray-200 rounded animate-pulse"></span>
            ) : (
              <input
                type="text"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PIN Code</label>
            {!hasLoadedUser ? (
              <span className="inline-block w-full h-10 bg-gray-200 rounded animate-pulse"></span>
            ) : (
              <input
                type="password"
                value={form.cardPin}
                onChange={e => setForm({ ...form, cardPin: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="new-password"
                placeholder="Enter PIN Code"
              />
            )}
          </div>
          <div className="flex space-x-2 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              disabled={loading || !hasLoadedUser}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <span className="font-semibold">Name:</span>{' '}
            {lastKnownName.current}
          </div>
          <div><span className="font-semibold">Email:</span> {lastKnownEmail.current}</div>
          <div><span className="font-semibold">Phone:</span> {lastKnownPhone.current}</div>
          <div><span className="font-semibold">Address:</span> {lastKnownAddress.current}</div>
          <div><span className="font-semibold">Role:</span> {currentUser.role || 'patron'}</div>
          <div><span className="font-semibold">UID:</span> {currentUser.uid}</div>
          <button
            onClick={handleEdit}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Edit My Info
          </button>
        </div>
      )}
    </div>
  );
};

export default UserAccount; 