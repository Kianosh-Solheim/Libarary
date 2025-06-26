import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

const updateUser = async (db, appId, userId, form, currentUser) => {
  if (!db || !appId || !userId) throw new Error('Missing required parameters');
  const userRef = doc(db, 'artifacts', appId, 'users', userId);
  await updateDoc(userRef, {
    name: form.name ?? null,
    displayName: form.displayName ?? form.name ?? null,
    email: form.email ?? null,
    role: form.role ?? null,
    cardNumber: form.cardNumber ?? null,
    cardPin: form.cardPin ?? null,
    address: form.address ?? null,
    phone: form.phone ?? null,
    isLocked: form.isLocked ?? null,
    libraryCardId: form.libraryCardId ?? form.cardNumber ?? null,
    loans: form.loans ?? null,
    uid: form.uid ?? userId,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser?.uid || 'admin'
  });
};

export default updateUser; 