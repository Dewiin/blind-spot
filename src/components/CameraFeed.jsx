import { useEffect, useRef, useState, useCallback } from "react";
import { voiceCommands } from "../utils/voiceCommands";
import { ControlPanel } from "./ControlPanel";
import { useSpeech } from "../utils/useSpeech";

// 🔊 TEST BUTTON to check iOS TTS
function SpeechTestButton() {
  const handleTap = async () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const utterance = new SpeechSynthesisUtterance("This is a test message for iPhone.");
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.startsWith('en')) || null;

    if (voices.length === 0) {
      speechSynthesis.addEventListener("voiceschanged", () => {
        utterance.voice = speechSynthesis.getVoices().find(v => v.lang.startsWith('en')) || null;
        speechSynthesis.speak(utterance);
      }, { once: true });
    } else {
      speechSynthesis.speak(utterance);
    }
  };

  return (
    <button 
      onClick={handleTap} 
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: 999,
        backgroundColor: "#222",
        color: "white",
        padding: "10px",
        border: "none",
        borderRadius: "5px"
      }}
    >
      🔊 Tap for iOS Speech Test
    </button>
  );
}

export function CameraFeed() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isDescribing, setIsDescribing] = useState(false);
  const [lastDescription, setLastDescription] = useState("");
  const [cameraError, setCameraError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCameraAccess, setHasCameraAccess] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  
  const { speak, isSafari, isIOS, initializeAudioContext } = useSpeech();
  const backendUrl = 'https://api.blind-spot.app';

  const handleUserInteraction = useCallback(async () => {
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
      if (isSafari || isIOS) {
        await initializeAudioContext();
      }
    }
  }, [hasUserInteracted, isSafari, isIOS, initializeAudioContext]);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment", 
          width: { ideal: 1280 },
          height: { ideal: 720 } 
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraError(null);
        setHasCameraAccess(true);
      }
    } catch (error) {
      console.error("Error accessing the camera:", error);
      setCameraError(error.message || "Unable to access camera");
      setHasCameraAccess(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const takeSnapshot = useCallback(() => {
    if (!videoRef.current || videoRef.current.readyState < 3) {
      console.warn("Video not ready for snapshot");
      return null;
    }

    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      if (videoWidth === 0 || videoHeight === 0) {
        console.warn("Invalid video dimensions");
        return null;
      }

      canvas.width = videoWidth;
      canvas.height = videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageUrl = canvas.toDataURL("image/jpeg", 0.9);
      return imageUrl;
    } catch (err) {
      console.error("Error taking snapshot:", err);
      return null;
    }
  }, []);

  const describeScene = useCallback(async () => {
    if (!hasUserInteracted) {
      await handleUserInteraction();
      if (isIOS) return;
    }

    if (isDescribing || !hasCameraAccess) {
      if (!hasCameraAccess) {
        speak("No camera access available. Please check camera permissions.");
        setLastDescription("No camera access available. Please check camera permissions.");
      }
      return;
    }

    setIsDescribing(true);
    const imageUrl = takeSnapshot();
    if (!imageUrl) {
      setIsDescribing(false);
      return;
    }

    try {
      const fetchResponse = await fetch(imageUrl);
      const blob = await fetchResponse.blob();

      const formData = new FormData();
      formData.append('image', blob, 'snapshot.jpg');

      const url = `${backendUrl}/describe`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      if (data.description) {
        setLastDescription(data.description);
        speak(data.description);
      } else {
        setLastDescription("No description available for this scene.");
        speak("No description available for this scene.");
      }
    } catch (error) {
      console.error("Scene description error:", error);
      let errorMessage = "Failed to describe the scene.";
      if (error.name === 'AbortError') {
        errorMessage = "Request timed out. Please try again.";
      } else if (error.message.includes("NetworkError")) {
        errorMessage = "Network error. Please check your connection.";
      }
      setLastDescription(`Error: ${errorMessage}`);
      speak(errorMessage);
    } finally {
      setIsDescribing(false);
    }
  }, [isDescribing, takeSnapshot, hasCameraAccess, speak, hasUserInteracted, handleUserInteraction, isIOS]);

  useEffect(() => {
    startCamera();

    fetch(`${backendUrl}/ping`)
      .then(response => response.json())
      .then(data => console.log(data))
      .catch(error => console.error('Error pinging server:', error));
    
    const cleanupVoice = voiceCommands({ describeScene });

    const hasVisitedBefore = sessionStorage.getItem('hasVisitedSceneDescriptor');

    if (!hasVisitedBefore) {
      const tryDescribeAfterInteraction = async () => {
        if (isIOS || isSafari) {
          if (hasUserInteracted) {
            await initializeAudioContext();
            speak("Welcome to Blind-Spot. Analyzing the scene now.");
            describeScene();
            sessionStorage.setItem('hasVisitedSceneDescriptor', 'true');
          }
        } else {
          speak("Welcome to Blind-Spot. Analyzing the scene now.");
          describeScene();
          sessionStorage.setItem('hasVisitedSceneDescriptor', 'true');
        }
      };

      tryDescribeAfterInteraction();
    }

    return () => {
      if (cleanupVoice && typeof cleanupVoice === 'function') {
        cleanupVoice();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [startCamera, describeScene, speak, isSafari, isIOS, hasUserInteracted, initializeAudioContext]);

  return (
    <div 
      className="camera-feed-container"
      onClick={handleUserInteraction}
      onTouchStart={handleUserInteraction}
    >
      <SpeechTestButton />

      <div className="video-container" aria-live="polite">
        {isLoading && <div className="loading-indicator">Initializing camera...</div>}
        {cameraError && (
          <div className="error-message" role="alert">
            <p>Camera error: {cameraError}</p>
            <button onClick={startCamera} className="retry-button" aria-label="Retry camera access">
              Retry
            </button>
          </div>
        )}
        <video 
          ref={videoRef} 
          className="video-element"
          width="100%" 
          autoPlay 
          playsInline 
          muted 
          onLoadedMetadata={() => setIsLoading(false)}
          aria-label="Live camera feed"
        />
      </div>

      {lastDescription && (
        <div className="description-panel" aria-live="polite" role="status">
          <p>{lastDescription}</p>
        </div>
      )}

      {isDescribing && (
        <div className="progress-indicator" aria-live="polite">
          <p>Analyzing scene...</p>
        </div>
      )}

      <ControlPanel 
        describeScene={describeScene} 
        isDisabled={isDescribing || isLoading || !!cameraError || (isIOS && !hasUserInteracted)}
      />
    </div>
  );
}
