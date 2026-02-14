'use client';

import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        aspectRatio: 1.0,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        scanner.clear();
        onScan(decodedText);
      },
      () => {}
    );

    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-white/20">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-white font-bold text-xl">📷 Escanear QR</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition text-2xl"
          >
            ✕
          </button>
        </div>

        <div id="qr-reader" className="rounded-xl overflow-hidden" />

        <p className="text-gray-400 text-sm text-center mt-4">
          Apunta la cámara al código QR de tu membresía
        </p>

        <button
          onClick={onClose}
          className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}