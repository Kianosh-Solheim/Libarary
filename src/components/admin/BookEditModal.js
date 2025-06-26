import React, { useState } from 'react';
import { Camera, Search } from 'lucide-react';
import ScanLibraryCard from '../ScanLibraryCard';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirebase } from '../../App';

const fetchOpenLibrary = async (isbn) => {
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title || '',
      author: Array.isArray(data.authors) && data.authors.length > 0 ? data.authors[0].name || '' : '',
      isbn: isbn,
      language: Array.isArray(data.languages) && data.languages.length > 0 ? data.languages[0].key.replace('/languages/', '') : '',
      description: typeof data.description === 'string' ? data.description : (data.description?.value || ''),
      coverUrl: data.covers && data.covers.length > 0 ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg` : '',
      available: 1,
      copies: 1
    };
  } catch {
    return null;
  }
};

const fetchGoogleBooks = async (isbn) => {
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.items || !data.items.length) return null;
    const book = data.items[0].volumeInfo;
    return {
      title: book.title || '',
      author: Array.isArray(book.authors) ? book.authors.join(', ') : '',
      isbn: isbn,
      language: book.language || '',
      description: book.description || '',
      coverUrl: book.imageLinks?.thumbnail || '',
      available: 1,
      copies: 1
    };
  } catch {
    return null;
  }
};

// Utility to fetch cover image from multiple sources
const fetchCoverImage = async (isbn) => {
  // 1. Open Library
  try {
    const olRes = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
    if (olRes.ok) {
      const data = await olRes.json();
      if (data.covers && data.covers.length > 0) {
        return `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`;
      }
    }
  } catch {}
  // 2. Google Books
  try {
    const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    if (gbRes.ok) {
      const data = await gbRes.json();
      if (data.items && data.items.length > 0) {
        const img = data.items[0].volumeInfo?.imageLinks?.thumbnail;
        if (img) return img;
      }
    }
  } catch {}
  // 3. LibraryThing
  try {
    // LibraryThing covers: https://covers.librarything.com/devkey/{devkey}/large/isbn/{isbn}
    // But requires a devkey. We'll use their public cover proxy:
    // https://covers.librarything.com/devkey/large/isbn/{isbn}
    // We'll use a placeholder devkey, but this may not always work.
    const url = `https://covers.librarything.com/devkey/large/isbn/${isbn}`;
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
      return url;
    }
  } catch {}
  // 4. WorldCat (OCLC)
  try {
    // WorldCat cover proxy: https://covers.oclc.org/bib/isbn/{isbn}-L.jpg
    const url = `https://covers.oclc.org/bib/isbn/${isbn}-L.jpg`;
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
      return url;
    }
  } catch {}
  // 5. Archive.org
  try {
    // Archive.org: https://archive.org/services/img/isbn_{isbn}
    const url = `https://archive.org/services/img/isbn_${isbn}`;
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
      return url;
    }
  } catch {}
  // 6. Nasjonalbiblioteket (NO)
  try {
    const url = `https://www.nb.no/services/image/resolver?identifier=isbn:${isbn.replace(/-/g, '')}&width=400`;
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
      return url;
    }
  } catch {}
  // 7. ARK.no
  try {
    const ark1 = `https://www.ark.no/cover/${isbn.replace(/-/g, '')}`;
    const ark2 = `https://www.ark.no/cover/isbn/${isbn.replace(/-/g, '')}`;
    for (const url of [ark1, ark2]) {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
        return url;
      }
    }
  } catch {}
  // 8. Norli.no
  try {
    const cleanIsbn = isbn.replace(/-/g, '');
    if (cleanIsbn.length === 13) {
      const part1 = cleanIsbn.slice(0, 3);
      const part2 = cleanIsbn.slice(3, 6);
      const part3 = cleanIsbn.slice(6);
      const norliUrl = `https://www.norli.no/media/catalog/product/${part1}/${part2}/${part3}/${cleanIsbn}_xxl.jpg`;
      const res = await fetch(norliUrl, { method: 'HEAD' });
      if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
        return norliUrl;
      }
    }
  } catch {}
  // 9. Fallback
  return 'https://placehold.co/120x180/3b82f6/ffffff?text=📚';
};

const fetchAllCoverOptions = async (isbn) => {
  const urls = [];
  // 1. Open Library
  try {
    const olRes = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
    if (olRes.ok) {
      const data = await olRes.json();
      if (data.covers && data.covers.length > 0) {
        urls.push({ url: `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`, source: 'Open Library' });
      }
    }
  } catch {}
  // 2. Google Books
  try {
    const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    if (gbRes.ok) {
      const data = await gbRes.json();
      if (data.items && data.items.length > 0) {
        const img = data.items[0].volumeInfo?.imageLinks?.thumbnail;
        if (img) urls.push({ url: img, source: 'Google Books' });
      }
    }
  } catch {}
  // 3. LibraryThing
  try {
    const url = `https://covers.librarything.com/devkey/large/isbn/${isbn}`;
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
      urls.push({ url, source: 'LibraryThing' });
    }
  } catch {}
  // 4. WorldCat (OCLC)
  try {
    const url = `https://covers.oclc.org/bib/isbn/${isbn}-L.jpg`;
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
      urls.push({ url, source: 'WorldCat' });
    }
  } catch {}
  // 5. Archive.org
  try {
    const url = `https://archive.org/services/img/isbn_${isbn}`;
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
      urls.push({ url, source: 'Archive.org' });
    }
  } catch {}
  // 6. Nasjonalbiblioteket (NO)
  try {
    const url = `https://www.nb.no/services/image/resolver?identifier=isbn:${isbn.replace(/-/g, '')}&width=400`;
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
      urls.push({ url, source: 'Nasjonalbiblioteket (NO)' });
    }
  } catch {}
  // 7. ARK.no
  try {
    const ark1 = `https://www.ark.no/cover/${isbn.replace(/-/g, '')}`;
    const ark2 = `https://www.ark.no/cover/isbn/${isbn.replace(/-/g, '')}`;
    for (const url of [ark1, ark2]) {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
        urls.push({ url, source: 'ARK.no' });
      }
    }
  } catch {}
  // 8. Norli.no
  try {
    const cleanIsbn = isbn.replace(/-/g, '');
    if (cleanIsbn.length === 13) {
      const part1 = cleanIsbn.slice(0, 3);
      const part2 = cleanIsbn.slice(3, 6);
      const part3 = cleanIsbn.slice(6);
      const norliUrl = `https://www.norli.no/media/catalog/product/${part1}/${part2}/${part3}/${cleanIsbn}_xxl.jpg`;
      const res = await fetch(norliUrl, { method: 'HEAD' });
      if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
        urls.push({ url: norliUrl, source: 'Norli.no' });
      }
    }
  } catch {}
  // Remove duplicates by url
  const seen = new Set();
  return urls.filter(opt => {
    if (seen.has(opt.url)) return false;
    seen.add(opt.url);
    return true;
  });
};

const BookEditModal = ({ show, book, form, setForm, onSave, onClose, books = [] }) => {
  console.log('BookEditModal rendered', book);
  const [showScanner, setShowScanner] = useState(false);
  const [showExistsDialog, setShowExistsDialog] = useState(false);
  const [existingBook, setExistingBook] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const { db, customAppId: appId } = useFirebase();
  const [coverOptions, setCoverOptions] = useState([]);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [coverLoading, setCoverLoading] = useState(false);

  // When opening in edit mode, fetch all cover options
  React.useEffect(() => {
    if (show && book && book.id && form.isbn) {
      setCoverLoading(true);
      fetchAllCoverOptions(form.isbn).then(opts => {
        setCoverOptions(opts);
        setCoverLoading(false);
      });
    } else {
      setCoverOptions([]);
    }
  }, [show, book, form.isbn]);

  // Handler for picking a cover
  const handlePickCover = async (url) => {
    setForm(f => ({ ...f, coverUrl: url }));
    setShowCoverPicker(false);
    if (db && appId && book && book.id) {
      const bookRef = doc(db, 'artifacts', appId, 'books', book.id);
      await updateDoc(bookRef, { coverUrl: url });
    }
  };

  if (!show || !book) return null;
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      style={{
        zIndex: 99999, // force on top
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        pointerEvents: 'auto'
      }}
    >
      <div className="bg-white rounded-lg max-w-lg w-full">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold text-gray-800">Edit Book</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Book title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
              <input
                type="text"
                value={form.author}
                onChange={e => setForm({ ...form, author: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Author name"
              />
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                <input
                  type="text"
                  value={form.isbn}
                  onChange={e => setForm({ ...form, isbn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ISBN number"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="p-2 bg-blue-100 hover:bg-blue-200 rounded-full flex items-center justify-center mt-6"
                title="Scan ISBN barcode"
              >
                <Camera size={20} className="text-blue-600" />
              </button>
              <button
                type="button"
                disabled={searchLoading}
                onClick={async () => {
                  const found = books.find(b => b.isbn && b.isbn === form.isbn);
                  if (found) {
                    setExistingBook(found);
                    setShowExistsDialog(true);
                    // Try to fill missing info from online sources
                    setSearchLoading(true);
                    let openLib = await fetchOpenLibrary(form.isbn);
                    let google = null;
                    if (!openLib) google = await fetchGoogleBooks(form.isbn);
                    // Try new cover fallback if neither has a cover
                    let coverUrl = openLib?.coverUrl || google?.coverUrl;
                    if (!coverUrl) {
                      coverUrl = await fetchCoverImage(form.isbn);
                    }
                    setSearchLoading(false);
                    const online = openLib || google;
                    if (online) {
                      // Merge: fill only missing fields
                      const merged = { ...found };
                      Object.keys(online).forEach(key => {
                        if (!merged[key] || merged[key] === '' || merged[key] === undefined) {
                          merged[key] = online[key];
                        }
                      });
                      if (!merged.coverUrl) merged.coverUrl = coverUrl;
                      setForm(f => ({ ...f, ...merged }));
                    } else {
                      setForm(f => ({ ...f, ...found, coverUrl }));
                    }
                    return;
                  }
                  setSearchLoading(true);
                  let openLib = await fetchOpenLibrary(form.isbn);
                  let google = null;
                  if (!openLib) google = await fetchGoogleBooks(form.isbn);
                  // Try new cover fallback if neither has a cover
                  let coverUrl = openLib?.coverUrl || google?.coverUrl;
                  if (!coverUrl) {
                    coverUrl = await fetchCoverImage(form.isbn);
                  }
                  setSearchLoading(false);
                  if (openLib) {
                    setForm(f => ({ ...f, ...openLib, coverUrl: openLib.coverUrl || coverUrl }));
                  } else if (google) {
                    setForm(f => ({ ...f, ...google, coverUrl: google.coverUrl || coverUrl }));
                  } else {
                    setForm(f => ({ ...f, coverUrl }));
                    alert('No book found for this ISBN in Open Library or Google Books.');
                  }
                }}
                className={`p-2 bg-blue-100 hover:bg-blue-200 rounded-full flex items-center justify-center mt-6 ${searchLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Search ISBN in library and online"
              >
                <Search size={20} className="text-blue-600" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <input
                type="text"
                value={form.language}
                onChange={e => setForm({ ...form, language: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Language"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Book description"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cover URL</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  value={form.coverUrl}
                  onChange={e => setForm({ ...form, coverUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Cover image URL"
                />
                {book && book.id && (
                  <button
                    type="button"
                    onClick={() => setShowCoverPicker(true)}
                    style={{ background: '#e0e7ff', color: '#3730a3', border: 'none', borderRadius: 8, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}
                    title="Pick from available covers"
                  >
                    Pick Cover
                  </button>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Available</label>
                <input
                  type="number"
                  value={form.available}
                  onChange={e => setForm({ ...form, available: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Available copies"
                  min={0}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Copies</label>
                <input
                  type="number"
                  value={form.copies}
                  onChange={e => setForm({ ...form, copies: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Total copies"
                  min={1}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
              <input
                type="text"
                value={form.publisher || ''}
                onChange={e => setForm({ ...form, publisher: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Publisher"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Publish Date</label>
              <input
                type="text"
                value={form.publishDate || ''}
                onChange={e => setForm({ ...form, publishDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Publish Date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <input
                type="text"
                value={form.tags || ''}
                onChange={e => setForm({ ...form, tags: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tags (comma separated)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
              <input
                type="text"
                value={form.length || ''}
                onChange={e => setForm({ ...form, length: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Length (pages, minutes, etc.)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Added</label>
              <input
                type="text"
                value={form.added || ''}
                onChange={e => setForm({ ...form, added: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Date Added"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
          {showExistsDialog && (
            <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
              <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
                <h4 className="text-lg font-bold mb-2">This book is already in your library</h4>
                <p className="mb-4">Do you want to edit it?</p>
                <div className="flex justify-end space-x-2">
                  <button
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    onClick={() => setShowExistsDialog(false)}
                  >
                    No
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    onClick={() => {
                      setForm({
                        title: existingBook.title || '',
                        author: existingBook.author || '',
                        isbn: existingBook.isbn || '',
                        language: existingBook.language || '',
                        description: existingBook.description || '',
                        coverUrl: existingBook.coverUrl || '',
                        available: existingBook.available ?? 1,
                        copies: existingBook.copies ?? 1
                      });
                      setShowExistsDialog(false);
                    }}
                  >
                    Yes
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Cover picker modal */}
          {showCoverPicker && (
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
              onClick={() => setShowCoverPicker(false)}
            >
              <div
                style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 320, maxWidth: 600, boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
                onClick={e => e.stopPropagation()}
              >
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>Pick a Cover Image</h3>
                {coverLoading ? (
                  <div style={{ color: '#3b82f6', fontWeight: 600 }}>Loading covers...</div>
                ) : coverOptions.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                    {coverOptions.map(opt => (
                      <div key={opt.url} style={{ textAlign: 'center', minWidth: 110 }}>
                        <img src={opt.url} alt="cover option" style={{ width: 100, height: 150, objectFit: 'cover', borderRadius: 8, border: opt.url === form.coverUrl ? '3px solid #3b82f6' : '1px solid #cbd5e1', cursor: 'pointer', marginBottom: 6 }} onClick={() => handlePickCover(opt.url)} />
                        <div style={{ fontSize: 12, color: opt.url === form.coverUrl ? '#3b82f6' : '#64748b', fontWeight: opt.url === form.coverUrl ? 700 : 400 }}>{opt.url === form.coverUrl ? 'Selected' : 'Choose'}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{opt.source}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#64748b' }}>No covers found for this ISBN.</div>
                )}
                <button
                  onClick={() => setShowCoverPicker(false)}
                  style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: 'pointer', marginTop: 24 }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
        {showScanner && (
          <ScanLibraryCard
            onScan={code => {
              setForm(f => ({ ...f, isbn: typeof code === 'object' && code.getText ? code.getText() : String(code) }));
              setShowScanner(false);
            }}
            onClose={() => setShowScanner(false)}
          />
        )}
      </div>
    </div>
  );
};

export default BookEditModal; 