import { doc, updateDoc, getDoc } from 'firebase/firestore';

const returnLoan = async (db, appId, currentUser, loan) => {
  if (!db || !appId || !currentUser) throw new Error('Missing required parameters');
  const loanRef = doc(db, 'artifacts', appId, 'public', 'data', 'loans', loan.id);
  await updateDoc(loanRef, {
    returned: true,
    returnDate: new Date(),
    returnedBy: currentUser.uid
  });
  // Increment book availability
  if (loan.bookId) {
    const bookRef = doc(db, 'artifacts', appId, 'books', loan.bookId);
    // Get current available value
    const bookSnap = await getDoc(bookRef);
    const currentAvailable = bookSnap.exists() ? (bookSnap.data().available || 0) : 0;
    await updateDoc(bookRef, {
      available: currentAvailable + 1
    });
  }
};

export default returnLoan; 