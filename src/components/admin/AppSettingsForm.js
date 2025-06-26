import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, addDoc, setDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const AppSettingsForm = ({ db, appId, showMessage }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appName, setAppName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [loanPeriodDays, setLoanPeriodDays] = useState(14);
  const [renewPeriodDays, setRenewPeriodDays] = useState(14);

  useEffect(() => {
    if (!db || !appId) return;
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const ref = doc(db, 'artifacts', appId, 'settings', 'appSettings');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setAppName(data.appName || 'My Library');
          setLogoUrl(data.logoUrl || 'https://placehold.co/60x60/3b82f6/ffffff?text=LIB');
          setLoanPeriodDays(data.loanPeriodDays ?? 14);
          setRenewPeriodDays(data.renewPeriodDays ?? 14);
        }
      } catch (e) {
        showMessage('Failed to load settings: ' + e.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [db, appId, showMessage]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!db || !appId) return;
    setSaving(true);
    try {
      const ref = doc(db, 'artifacts', appId, 'settings', 'appSettings');
      await updateDoc(ref, { appName, logoUrl, loanPeriodDays, renewPeriodDays });
      showMessage('App settings updated!', 'success');
    } catch (e) {
      showMessage('Failed to update settings: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Update headers for XLSX export and import
  const bookHeaders = [
    { label: 'Title', key: 'title' },
    { label: 'Author', key: 'author' },
    { label: 'ISBN', key: 'isbn' },
    { label: 'Language', key: 'language' },
    { label: 'Description', key: 'description' },
    { label: 'CoverUrl', key: 'coverUrl' },
    { label: 'Available', key: 'available' },
    { label: 'Copies', key: 'copies' },
    { label: 'Publisher', key: 'publisher' },
    { label: 'PublishDate', key: 'publishDate' },
    { label: 'Tags', key: 'tags' },
    { label: 'Length', key: 'length' },
    { label: 'Added', key: 'added' }
  ];

  // XLSX Export
  const handleExportXLSX = async () => {
    if (!db || !appId) return;
    try {
      const booksRef = collection(db, 'artifacts', appId, 'books');
      const querySnapshot = await getDocs(booksRef);
      const books = [];
      querySnapshot.forEach(docSnap => {
        books.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (books.length === 0) {
        showMessage('No books to export.', 'info');
        return;
      }
      // Prepare data for XLSX
      const data = [
        bookHeaders.map(h => h.label), // header row
        ...books.map(book => bookHeaders.map(h => book[h.key] ?? ''))
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Books');
      const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'library-books.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMessage('Books exported as XLSX!', 'success');
    } catch (e) {
      showMessage('Failed to export books: ' + e.message, 'error');
    }
  };

  // XLSX Import
  const handleImportXLSX = async (e) => {
    if (!db || !appId) return;
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (rows.length < 2) {
        showMessage('No data found in XLSX file.', 'error');
        return;
      }
      const headers = rows[0];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0 || row.every(cell => cell === undefined || cell === null || cell === '')) continue;
        const book = {};
        headers.forEach((h, idx) => {
          // Map only known headers to book fields
          const key = bookHeaders.find(bh => bh.label === h)?.key;
          if (key) book[key] = row[idx];
        });
        // Remove undefined values
        Object.keys(book).forEach(k => { if (book[k] === undefined) delete book[k]; });
        const bookId = book.id;
        delete book.id;
        // Upsert book
        if (bookId) {
          await setDoc(doc(db, 'artifacts', appId, 'books', bookId), book, { merge: true });
        } else {
          await addDoc(collection(db, 'artifacts', appId, 'books'), book);
        }
      }
      showMessage('Books imported from XLSX!', 'success');
    } catch (e) {
      showMessage('Failed to import books: ' + e.message, 'error');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading settings...</div>;

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto bg-white rounded-lg shadow p-8 mt-8 space-y-6">
      <h3 className="text-2xl font-bold mb-4 text-gray-800">App Settings</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">App Name</label>
        <input
          type="text"
          value={appName}
          onChange={e => setAppName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Library Name"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
        <input
          type="text"
          value={logoUrl}
          onChange={e => setLogoUrl(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Logo image URL"
        />
        <div className="mt-2">
          <img src={logoUrl} alt="Logo preview" className="h-16 w-16 rounded shadow border inline-block" onError={e => { e.target.src = 'https://placehold.co/60x60/3b82f6/ffffff?text=LIB'; }} />
        </div>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Loan Period (days)</label>
          <input
            type="number"
            min={1}
            value={loanPeriodDays}
            onChange={e => setLoanPeriodDays(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Loan period in days"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Renew Period (days)</label>
          <input
            type="number"
            min={1}
            value={renewPeriodDays}
            onChange={e => setRenewPeriodDays(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Renew period in days"
          />
        </div>
      </div>
      <div className="flex space-x-4 mt-6">
        <button type="button" onClick={handleExportXLSX} className="py-2 px-4 bg-green-700 text-white rounded-lg hover:bg-green-800">Export Books XLSX</button>
        <label className="py-2 px-4 bg-blue-700 text-white rounded-lg hover:bg-blue-800 cursor-pointer">
          Import Books XLSX
          <input type="file" accept=".xlsx" onChange={handleImportXLSX} className="hidden" />
        </label>
      </div>
      <button
        type="submit"
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-semibold disabled:opacity-50"
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
};

export default AppSettingsForm; 