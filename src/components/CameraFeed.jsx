import { useEffect, useRef, useState, useCallback } from "react";
import { voiceCommands } from "../utils/voiceCommands"; // Assuming these paths are correct
import { ControlPanel } from "./ControlPanel";          // Assuming these paths are correct
import { useSpeech } from "../utils/useSpeech";        // Assuming these paths are correct

export function CameraFeed() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isDescribing, setIsDescribing] = useState(false);
  const [lastDescription, setLastDescription] = useState("");
  const [cameraError, setCameraError] = useState(null);
  // isLoading is already used for camera, let's add a specific one for ping or reuse carefully
  const [isSystemLoading, setIsSystemLoading] = useState(true); // For ping and initial setup
  const [pingError, setPingError] = useState(null); // For ping error

  const [hasCameraAccess, setHasCameraAccess] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  const { speak, isSafari, isIOS, initializeAudioContext } = useSpeech();

  // Determine backend URL (adjust as necessary)
  // It's good practice to use environment variables for this
  const backendUrl = 'https://api.blind-spot.app'; // Your production URL
  // For local development, you might override this or use a different variable:
  // const backendUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:5001' : 'https://api.blind-spot.app';


  // +++++++++++++++ NEW PING FUNCTION +++++++++++++++
  useEffect(() => {
    const wakeUpBackend = async () => {
      try {
        // Use the backendUrl variable. Ensure it points to your Flask server's host and port.
        // e.g., 'http://localhost:5001/ping' if Flask runs on port 5001 locally.
        const response = await fetch(`${backendUrl}/ping`);
        if (!response.ok) {
          throw new Error(`Backend ping failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log('Backend ping successful:', data.message);
        setPingError(null);
      } catch (error) {
        console.error("Error pinging backend:", error);
        setPingError("Could not connect to the server. Please try again later.");
        // You might want to inform the user more visibly here
      } finally {
        setIsSystemLoading(false); // Combined loading state, or manage separately
      }
    };

    wakeUpBackend();
  }, [backendUrl]); // backendUrl dependency if it can change, otherwise empty array is fine
  // +++++++++++++++++++++++++++++++++++++++++++++++++


  const handleUserInteraction = useCallback(async () => {
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
      if (isSafari || isIOS) {
        await initializeAudioContext();
      }
    }
  }, [hasUserInteracted, isSafari, isIOS, initializeAudioContext]);

  const startCamera = useCallback(async () => {
    // setIsLoading(true); // You might want to use isSystemLoading or a dedicated camera loading state
    setCameraError(null); // Clear previous camera errors
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
        setHasCameraAccess(true);
      }
    } catch (error) {
      console.error("Error accessing the camera:", error);
      setCameraError(error.message || "Unable to access camera");
      setHasCameraAccess(false);
    } finally {
      // setIsLoading(false); // Manage loading state appropriately
    }
  }, []); // Removed setIsLoading from dependencies as it causes re-runs

  const takeSnapshot = useCallback(() => {
    if (!videoRef.current || videoRef.current.readyState < 3) {
      console.warn("Video not ready for snapshot");
      return null;
    }
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      if (canvas.width === 0 || canvas.height === 0) {
        console.warn("Invalid video dimensions for snapshot");
        return null;
      }
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.9);
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
      if(!hasCameraAccess) {
        const msg = "No camera access. Check permissions.";
        speak(msg);
        setLastDescription(msg);
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

      // Use the backendUrl variable for the describe endpoint too
      const describeEndpoint = `${backendUrl}/describe`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(describeEndpoint, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        // You might need to add headers here if your API key is expected
        // headers: { 'X-API-Key': 'YOUR_API_KEY_IF_NEEDED_ON_FRONTEND' }
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
        const msg = "No description available.";
        setLastDescription(msg);
        speak(msg);
      }
    } catch (error) {
      console.error("Scene description error:", error);
      let errorMessage = "Failed to describe the scene.";
      if (error.name === 'AbortError') {
        errorMessage = "Request timed out.";
      } else if (error.message.includes("NetworkError") || error.message.includes("Failed to fetch")) {
        errorMessage = "Network error. Check connection.";
      }
      setLastDescription(`Error: ${errorMessage}`);
      speak(errorMessage);
    } finally {
      setIsDescribing(false);
    }
  }, [isDescribing, takeSnapshot, hasCameraAccess, speak, hasUserInteracted, handleUserInteraction, isIOS, backendUrl]); // Added backendUrl

  useEffect(() => {
    // We still want to attempt to start the camera,
    // but the ping might be happening in parallel or just before.
    startCamera();

    const cleanupVoice = voiceCommands({ describeScene });

    const hasVisitedBefore = sessionStorage.getItem('hasVisitedSceneDescriptor');
    if (!hasVisitedBefore) {
      const playWelcomeMessage = () => {
        speak("Welcome to Blind-Spot, say describe, describe the scene, or tap the screen to get Started.");
        document.removeEventListener('click', playWelcomeMessage);
        document.removeEventListener('touchstart', playWelcomeMessage);
      };
      if (isSafari || isIOS) {
        document.addEventListener('click', playWelcomeMessage, { once: true });
        document.addEventListener('touchstart', playWelcomeMessage, { once: true });
      } else {
        speak("Welcome to Blind-Spot, say describe, describe the scene, or tap the screen to get Started.");
      }
      sessionStorage.setItem('hasVisitedSceneDescriptor', 'true');
    }

    return () => {
      if (cleanupVoice && typeof cleanupVoice === 'function') {
        cleanupVoice();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      // Clean up listeners for welcome message if component unmounts before interaction
      // This part is tricky as playWelcomeMessage is defined inside the effect.
      // A more robust way would be to define playWelcomeMessage outside or use refs.
    };
    // Removed speak, isSafari, isIOS from dependencies if they don't change after initial render
    // Added describeScene to ensure the latest version is used by voiceCommands
  }, [startCamera, describeScene, speak, isSafari, isIOS]); // Corrected dependencies

  return (
    <div
      className="camera-feed-container"
      onClick={handleUserInteraction}
      onTouchStart={handleUserInteraction}
    >
      <div className="video-container" aria-live="polite">
        <> {/* isLoading is for camera, isSystemLoading for initial ping */}
          {isSystemLoading && <div className="loading-indicator">Connecting to server...</div>}
          {pingError && !isSystemLoading && ( // Show ping error if not system loading
            <div className="error-message" role="alert">
              <p>{pingError}</p>
              {/* Optionally add a retry button for the ping */}
            </div>
          )}
          {isLoading && !isSystemLoading && !pingError && <div className="loading-indicator">Initializing camera...</div>} {/* Camera specific loading */}
          {cameraError && !isSystemLoading && !pingError && (
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
            onLoadedMetadata={() => { /*setIsLoading(false)*/ /* Manage camera loading separately */ }}
            aria-label="Live camera feed"
            style={{ display: (isSystemLoading || pingError || cameraError) ? 'none' : 'block' }} // Hide video if critical errors or initial load
          />
        </>
      </div>

      {lastDescription && (
        <div
          className="description-panel"
          aria-live="polite"
          role="status"
        >
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
        isDisabled={isDescribing || isSystemLoading || !!pingError || isLoading || !!cameraError || (isIOS && !hasUserInteracted)}
      />
    </div>
  );
}