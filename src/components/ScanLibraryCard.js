import React, { useContext, useEffect } from 'react';
import { PersistentCameraContext } from './PersistentCameraProvider';

// ScanLibraryCard component: Scans a library card barcode using zxing-js/browser
const ScanLibraryCard = ({ onScan, onClose, autoClose = true, clearScan, scannedCount, title, children }) => {
  const { videoRef, lastScanResult, scanning, startScan, stopScan, error } = useContext(PersistentCameraContext);

  useEffect(() => {
    startScan();
    return () => {
      stopScan();
    };
  }, [startScan, stopScan]);

  useEffect(() => {
    if (lastScanResult) {
      onScan && onScan(lastScanResult);
      if (autoClose) {
        stopScan();
        if (onClose) onClose();
      }
      // Do not restart scan here; let parent clear scan result
    }
  }, [lastScanResult, onScan, stopScan, onClose, autoClose]);

  // Allow parent to clear scan result
  useEffect(() => {
    if (clearScan) {
      clearScan();
    }
  }, [clearScan]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl">×</button>
        <h3 className="text-xl font-bold mb-4">{title || 'Scan Library Card'}</h3>
        {typeof scannedCount === 'number' && (
          <div className="mb-2 text-center text-sm text-gray-600 font-semibold">{scannedCount} book{scannedCount === 1 ? '' : 's'} scanned so far</div>
        )}
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <div className="w-full h-48 bg-black rounded mb-4 flex items-center justify-center overflow-hidden relative" style={{ position: 'relative', width: '100%', height: '192px', maxWidth: 480 }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover rounded"
            style={{ width: '100%', height: '100%', background: 'black', display: scanning ? 'block' : 'none' }}
            autoPlay
            muted
            playsInline
          />
          {!scanning && !error && (
            <span className="text-gray-400 animate-pulse z-10 absolute left-0 right-0 top-0 bottom-0 flex items-center justify-center">Starting camera...</span>
          )}
          {error && (
            <span className="text-gray-500 z-10 absolute left-0 right-0 top-0 bottom-0 flex items-center justify-center">Camera unavailable.</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-full py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        {children}
      </div>
    </div>
  );
};

export default ScanLibraryCard; 