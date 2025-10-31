
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DetectedFace, Gender } from './types';
import { detectFaces } from './services/geminiService';

const Spinner: React.FC = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const App: React.FC = () => {
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Fix: The return type of setInterval in browsers is `number`, not `NodeJS.Timeout`.
  const detectionIntervalRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  const stopDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsDetecting(false);
    setIsLoading(false);
    setDetectedFaces([]);
    clearCanvas();
  }, [clearCanvas]);
  
  const startDetection = useCallback(async () => {
    setError(null);
    setDetectedFaces([]);
    clearCanvas();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("ไม่รองรับ API กล้องในเบราว์เซอร์นี้");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: 'user' } 
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
            if (videoRef.current && canvasRef.current) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
            }
        };
      }
      setIsDetecting(true);

      detectionIntervalRef.current = setInterval(async () => {
        if (isProcessingRef.current || !videoRef.current || videoRef.current.paused || videoRef.current.ended) {
          return;
        }

        isProcessingRef.current = true;
        setIsLoading(true);

        try {
          const tempCanvas = document.createElement('canvas');
          if (!videoRef.current) return;
          
          tempCanvas.width = videoRef.current.videoWidth;
          tempCanvas.height = videoRef.current.videoHeight;
          const context = tempCanvas.getContext('2d');
          if (context) {
            context.drawImage(videoRef.current, 0, 0, tempCanvas.width, tempCanvas.height);
            const base64Image = tempCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            const faces = await detectFaces(base64Image);
            setDetectedFaces(faces);
            setError(null);
          }
        } catch (err) {
          setError("เกิดข้อผิดพลาดในการตรวจจับใบหน้า");
          console.error(err);
        } finally {
          setIsLoading(false);
          isProcessingRef.current = false;
        }
      }, 2000);
    } catch (err) {
      setError("ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบการอนุญาต");
      console.error(err);
      setIsDetecting(false);
    }
  }, [clearCanvas]);

  const handleToggleDetection = useCallback(() => {
    if (isDetecting) {
      stopDetection();
    } else {
      startDetection();
    }
  }, [isDetecting, startDetection, stopDetection]);

  useEffect(() => {
    return () => { // Cleanup on unmount
      stopDetection();
    };
  }, [stopDetection]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const context = canvas.getContext('2d');
    if (!context) return;
    
    clearCanvas();

    detectedFaces.forEach(face => {
      const { x, y, width, height } = face.boundingBox;
      const rectX = x * canvas.width;
      const rectY = y * canvas.height;
      const rectWidth = width * canvas.width;
      const rectHeight = height * canvas.height;

      context.beginPath();
      context.lineWidth = 4;
      context.strokeStyle = face.gender === Gender.Male ? '#4ade80' : '#f87171';
      context.rect(rectX, rectY, rectWidth, rectHeight);
      context.stroke();

      context.fillStyle = face.gender === Gender.Male ? '#4ade80' : '#f87171';
      context.font = '16px sans-serif';
      const genderText = face.gender === Gender.Male ? 'ชาย' : 'หญิง';
      context.fillText(genderText, rectX, rectY > 10 ? rectY - 5 : rectY + rectHeight + 15);
    });
  }, [detectedFaces, clearCanvas]);

  const getStatusMessage = () => {
    if(error) return `ข้อผิดพลาด: ${error}`;
    if(!isDetecting) return "กด 'เริ่ม' เพื่อเปิดกล้องและตรวจจับใบหน้า";
    if(isLoading) return "กำลังประมวลผล...";
    return `ตรวจพบ ${detectedFaces.length} ใบหน้า`;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-3xl flex flex-col items-center">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-400 to-red-400 text-transparent bg-clip-text">โปรแกรมตรวจจับเพศจากใบหน้า</h1>
        <p className="text-gray-400 mb-6">ขับเคลื่อนโดย Gemini API</p>
        
        <div className="w-full aspect-video bg-gray-800 rounded-lg shadow-2xl overflow-hidden relative border-2 border-gray-700">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scaleX-[-1]"></video>
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full transform scaleX-[-1]"></canvas>
          {!isDetecting && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="mt-4 text-xl text-gray-400">กล้องปิดอยู่</p>
             </div>
          )}
        </div>

        <div className="w-full flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
            <p className="text-gray-300 text-center sm:text-left h-6">{getStatusMessage()}</p>
            <button 
              onClick={handleToggleDetection} 
              disabled={!error && isLoading}
              className={`flex items-center justify-center px-6 py-3 rounded-full font-semibold transition-all duration-300 shadow-lg w-full sm:w-auto
                ${isDetecting ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {isLoading && <Spinner/>}
              {isDetecting ? 'หยุด' : 'เริ่ม'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default App;
