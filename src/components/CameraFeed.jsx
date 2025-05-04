import { useEffect, useRef, useState, useCallback } from "react";
import { voiceCommands } from "../utils/voiceCommands";
import { ControlPanel } from "./ControlPanel";
import { speakText } from "../utils/textToSpeech"; // Import the new utility function

export function CameraFeed() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isDescribing, setIsDescribing] = useState(false);
  const [lastDescription, setLastDescription] = useState("");
  const [cameraError, setCameraError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCameraAccess, setHasCameraAccess] = useState(false);
  const [showStartingImage, setShowStartingImage] = useState(true);

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
    if (isDescribing || hasCameraAccess) {
      if(!hasCameraAccess) {
        speakText("No camera access available. Please check camera permissions.", null, null);
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

      const backendUrl = `http://localhost:5001/describe`;
      
      // Use AbortController for request timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
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
        
        // Use the extracted speech function and handle completion
        speakText(data.description, () => setIsDescribing(false), (error) => {
          console.error("Speech error:", error);
          setIsDescribing(false);
        });
      } else {
        setLastDescription("No description available for this scene.");
        setIsDescribing(false);
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
      setIsDescribing(false);
    }
  }, [isDescribing, takeSnapshot, hasCameraAccess]);


  const describeStartingImage = useCallback(async () => {
    try {
      const response = await fetch("/startingImage.png");
      const blob = await response.blob();

      const formData = new FormData();
      formData.append("image", blob, "startingImage.png");

      const res = await fetch("http://localhost:5001/describe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.description) {
        setLastDescription(data.description);
        speakText(data.description);
      }
    } catch (err) {
      console.error("Failed to describe image:", err);
      setLastDescription("Could not describe the example image.");
    }
  }, []);

  // Initialize camera and voice commands
  useEffect(() => {
    const hasVisitedBefore = sessionStorage.getItem('hasVisitedSceneDescriptor');
    if (!hasVisitedBefore) {
      startCamera();
      speakText(
        "Welcome to Blind-Spot. Say describe, describe the scene to start. Here's an example of what I can do.",
        async () => {
          await describeStartingImage();
          startCamera(); 
          setShowStartingImage(false);   
        }
      );
      sessionStorage.setItem("hasVisitedSceneDescriptor", "true"); 
    } else {
      startCamera();
      setShowStartingImage(false);
    }
    
    const cleanupVoice = voiceCommands({ describeScene });
    
    // Cleanup function
    return () => {
      // Clean up voice commands
      if (cleanupVoice && typeof cleanupVoice === 'function') {
        cleanupVoice();
      }
      
      // Stop speech synthesis
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      
      // Stop camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [startCamera, describeScene]);

  return (
    <div className="camera-feed-container">
      {/* Camera feed with loading and error states */}
      <div className="video-container" aria-live="polite">
        {showStartingImage ? (
          <img
            src= "/startingImage.png"
            alt="Example scene"
            className="starting-image"
            style={{ width: "100%", borderRadius: "12px" }}
          />
        ) : (
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
        )}
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
    </div>
  );
}