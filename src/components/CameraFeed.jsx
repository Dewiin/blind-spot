import { useEffect, useRef, useState, useCallback } from "react";
import { voiceCommands } from "../utils/voiceCommands";
import { ControlPanel } from "./ControlPanel";
import { useSpeech } from "../utils/useSpeech";
import { useVoiceCommands } from '../utils/voiceCommands';

export function CameraFeed() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isDescribing, setIsDescribing] = useState(false);
  const [lastDescription, setLastDescription] = useState("");
  const [cameraError, setCameraError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCameraAccess, setHasCameraAccess] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  
  // Initialize speech synthesis
  const { speak, isSafari } = useSpeech();

  const { startListening, stopListening, isListening, isMicrophoneAvailable, error: voiceError } = useVoiceCommands([
    {
      command: ['describe the scene', 'describe', 'what\'s happening', 'show me my blind spot', 'guide me', 'jarvis clip that'],
      callback: () => {
        if (!isDescribing) {
          describeScene();
        }
      }
    }
  ]);

  // Handle user interaction
  const handleUserInteraction = useCallback(() => {
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
      // Initialize audio context for iOS Safari
      if (isSafari) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Set gain to 0 to make it silent
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Start and immediately stop to initialize audio context
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.001);
      }
    }
  }, [hasUserInteracted, isSafari]);

  // Start camera with proper error handling and loading states
  const startCamera = useCallback(async () => {
    setIsLoading(true);
    try {
      // Request camera with preferred settings
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment", 
          width: { ideal: 1280 },
          height: { ideal: 720 } 
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream; // Store reference for cleanup
        setCameraError(null);
        setHasCameraAccess(true); // Set camera access to true
      }
    } catch (error) {
      console.error("Error accessing the camera:", error);
      setCameraError(error.message || "Unable to access camera");
      setHasCameraAccess(false); // Set camera access to false
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Memoized snapshot function
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

      const imageUrl = canvas.toDataURL("image/jpeg", 0.9); // JPEG with 90% quality for better performance
      return imageUrl;
    } catch (err) {
      console.error("Error taking snapshot:", err);
      return null;
    }
  }, []);

  // Improved scene description with proper API error handling
  const describeScene = useCallback(async () => {
    if (!hasUserInteracted) {
      handleUserInteraction();
    }

    if (isDescribing || !hasCameraAccess) {
      if(!hasCameraAccess) {
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
      // Convert base64 URL to Blob
      const fetchResponse = await fetch(imageUrl);
      const blob = await fetchResponse.blob();

      const formData = new FormData();
      formData.append('image', blob, 'snapshot.jpg');

      const backendUrl = `https://api.blind-spot.app/describe`;
      
      // Use AbortController for request timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch(backendUrl, {
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
      
      // More user-friendly error messages
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
  }, [isDescribing, takeSnapshot, hasCameraAccess, speak, hasUserInteracted, handleUserInteraction]);

  // Initialize camera and voice commands
  useEffect(() => {
    startCamera();
    
    // Initialize voice commands
    startListening();
    
    // Play welcome message only on first visit
    const hasVisitedBefore = sessionStorage.getItem('hasVisitedSceneDescriptor');
    if (!hasVisitedBefore) {
      // For Safari, we'll wait for user interaction before playing the welcome message
      if (isSafari) {
        const playWelcomeMessage = () => {
          speak("Welcome to Blind-Spot, say describe, describe the scene, or tap the screen to get Started.");
          // Remove the event listener after playing the message
          document.removeEventListener('click', playWelcomeMessage);
          document.removeEventListener('touchstart', playWelcomeMessage);
        };
        
        // Add event listeners for user interaction
        document.addEventListener('click', playWelcomeMessage);
        document.addEventListener('touchstart', playWelcomeMessage);
      } else {
        speak("Welcome to Blind-Spot, say describe, describe the scene, or tap the screen to get Started.");
      }
      sessionStorage.setItem('hasVisitedSceneDescriptor', 'true');
    }
    
    // Cleanup function
    return () => {
      // Clean up voice commands
      stopListening();
      
      // Stop camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [startCamera, describeScene, speak, isSafari, startListening, stopListening]);

  return (
    <div 
      className="camera-feed-container"
      onClick={handleUserInteraction}
      onTouchStart={handleUserInteraction}
    >
      {/* Camera feed with loading and error states */}
      <div className="video-container" aria-live="polite">
        <>
          {isLoading && <div className="loading-indicator">Initializing camera...</div>}
          {cameraError && (
            <div className="error-message" role="alert">
              <p>Camera error: {cameraError}</p>
              <button 
                onClick={startCamera} 
                className="retry-button"
                aria-label="Retry camera access"
              >
                Retry
              </button>
            </div>
          )}
          <video 
            ref={videoRef} 
            className="video-element"
            width="100%" 
            height="auto" 
            autoPlay 
            playsInline 
            muted 
            onLoadedMetadata={() => setIsLoading(false)}
            aria-label="Live camera feed"
          />
        </>
      </div>

      {/* Description display with semantic markup */}
      {lastDescription && (
        <div 
          className="description-panel" 
          aria-live="polite" 
          role="status"
        >
          <p>{lastDescription}</p>
        </div>
      )}

      {/* Progress indicator */}
      {isDescribing && (
        <div className="progress-indicator" aria-live="polite">
          <p>Analyzing scene...</p>
        </div>
      )}

      {/* Control panel */}
      <ControlPanel 
        describeScene={describeScene} 
        isDisabled={isDescribing || isLoading || !!cameraError}
      />

      {voiceError && (
        <div className="error-message">
          {voiceError === 'not-allowed' ? (
            'Microphone access is required for voice commands'
          ) : (
            'Voice commands are not supported in this browser'
          )}
        </div>
      )}
    </div>
  );
}
