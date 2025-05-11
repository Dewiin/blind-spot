import { useEffect, useRef, useState, useCallback } from "react";
import { voiceCommands } from "../utils/voiceCommands";
import { ControlPanel } from "./ControlPanel";
import { useSpeech } from "../utils/useSpeech";

export function CameraFeed() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isDescribing, setIsDescribing] = useState(false);
  const [lastDescription, setLastDescription] = useState("");
  const [cameraError, setCameraError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCameraAccess, setHasCameraAccess] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  
  // Initialize speech synthesis with new iOS flag
  const { speak, isSafari, isIOS, initializeAudioContext } = useSpeech();

  // backend url
  const backendUrl = 'https://api.blind-spot.app';

  // Handle user interaction
  const handleUserInteraction = useCallback(async () => {
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
      // Initialize audio context for iOS Safari
      if (isSafari || isIOS) {
        try {
          await initializeAudioContext();
          // Test speech synthesis after initialization
          const testUtterance = new SpeechSynthesisUtterance('Initializing speech');
          testUtterance.onend = () => {
            console.log('Test utterance completed');
            // Now try the welcome message
            speak("Welcome to Blind-Spot, say describe the scene, or tap the screen to get Started.");
          };
          testUtterance.onerror = (error) => {
            console.error('Test utterance failed:', error);
          };
          window.speechSynthesis.speak(testUtterance);
        } catch (error) {
          console.error('Failed to initialize audio context:', error);
        }
      }
    }
  }, [hasUserInteracted, isSafari, isIOS, initializeAudioContext, speak]);

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
      await handleUserInteraction();
      // For iOS, we need to wait for user interaction before speaking
      if (isIOS) {
        return;
      }
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

      const url = `${backendUrl}/describe`;
      
      // Use AbortController for request timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
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
  }, [isDescribing, takeSnapshot, hasCameraAccess, speak, hasUserInteracted, handleUserInteraction, isIOS]);

  // Initialize camera and voice commands
  useEffect(() => {
    startCamera();

    // Ping the server to warm up
    fetch(`${backendUrl}/ping`)
      .then(response => response.json())
      .then(data => console.log(data))
      .catch(error => console.error('Error pinging server:', error));
    
    // Initialize voice commands
    const cleanupVoice = voiceCommands({ describeScene });
    
    // Play welcome message only on first visit
    const hasVisitedBefore = sessionStorage.getItem('hasVisitedSceneDescriptor');
    if (!hasVisitedBefore) {
      // For Safari/iOS, we'll wait for user interaction before playing the welcome message
      if (isSafari || isIOS) {
        const playWelcomeMessage = async () => {
          try {
            await handleUserInteraction();
          } catch (error) {
            console.error('Failed to play welcome message:', error);
          }
          // Remove the event listeners after playing the message
          document.removeEventListener('click', playWelcomeMessage);
          document.removeEventListener('touchstart', playWelcomeMessage);
        };
        
        // Add event listeners for user interaction
        document.addEventListener('click', playWelcomeMessage);
        document.addEventListener('touchstart', playWelcomeMessage);
      } else {
        speak("Welcome to Blind-Spot, say describe the scene, or tap the screen to get Started.");
      }
      sessionStorage.setItem('hasVisitedSceneDescriptor', 'true');
    }
    
    // Cleanup function
    return () => {
      // Clean up voice commands
      if (cleanupVoice && typeof cleanupVoice === 'function') {
        cleanupVoice();
      }
      
      // Stop camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [startCamera, describeScene, speak, isSafari, isIOS]);

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
        isDisabled={isDescribing || isLoading || !!cameraError || (isIOS && !hasUserInteracted)}
      />
    </div>
  );
}