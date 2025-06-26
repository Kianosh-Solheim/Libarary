import React, { useRef, useEffect, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

export const PersistentCameraContext = React.createContext();

export function PersistentCameraProvider({ children }) {
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const controlsRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState(null);
  const [error, setError] = useState('');

  // Initialize ZXing instance once
  useEffect(() => {
    codeReaderRef.current = new BrowserMultiFormatReader();
    return () => {
      if (controlsRef.current && typeof controlsRef.current.stop === 'function') {
        controlsRef.current.stop();
      }
      if (codeReaderRef.current && typeof codeReaderRef.current.reset === 'function') {
        codeReaderRef.current.reset();
      }
    };
  }, []);

  // Start scanning (camera stays on)
  const startScan = useCallback(() => {
    setError('');
    setScanning(true);
    BrowserMultiFormatReader.listVideoInputDevices().then(devices => {
      const deviceId = devices[0]?.deviceId;
      if (!deviceId) {
        setError('No camera found.');
        setScanning(false);
        return;
      }
      if (codeReaderRef.current && videoRef.current) {
        codeReaderRef.current.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, err, controls) => {
            controlsRef.current = controls;
            if (result) {
              setLastScanResult(result.getText());
              // Optionally stop after first scan:
              // controls.stop();
              // setScanning(false);
            } else if (err && err.name !== 'NotFoundException') {
              setError('Camera error: ' + err.message);
              setScanning(false);
              controls.stop();
            }
          }
        );
      }
    });
  }, []);

  // Stop scanning (but keep camera stream alive)
  const stopScan = useCallback(() => {
    setScanning(false);
    if (controlsRef.current && typeof controlsRef.current.stop === 'function') {
      controlsRef.current.stop();
    }
  }, []);

  return (
    <PersistentCameraContext.Provider value={{
      videoRef,
      lastScanResult,
      scanning,
      startScan,
      stopScan,
      error,
      setLastScanResult
    }}>
      <video
        ref={videoRef}
        style={{ position: 'fixed', left: 0, top: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', zIndex: -1 }}
        autoPlay
        muted
        playsInline
      />
      {children}
    </PersistentCameraContext.Provider>
  );
} 