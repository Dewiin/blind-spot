import { useEffect, useRef, useState, useCallback } from "react";
import { voiceCommands } from "../utils/voiceCommands";
import { ControlPanel } from "./ControlPanel";
import { smartSpeak } from "../utils/textToSpeech";

export function CameraFeed() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isDescribing, setIsDescribing] = useState(false);
  const [lastDescription, setLastDescription] = useState("");
  const [cameraError, setCameraError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCameraAccess, setHasCameraAccess] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  const handleUserInteraction = useCallback(() => {
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }
  }, [hasUserInteracted]);

  const backendUrl = 'https://api.blind-spot.app';

  const startCamera = useCallback(async () => {
    if (streamRef.current && videoRef.current?.srcObject) return;

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
    if (!videoRef.current || videoRef.current.readyState < 3) return null;

    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.9);
    } catch (err) {
      console.error("Snapshot error:", err);
      return null;
    }
  }, []);

  const describeScene = useCallback(async () => {
    if (!hasUserInteracted || isDescribing || !hasCameraAccess) {
      if (!hasCameraAccess) {
        smartSpeak("error_no_camera", "No camera access available. Please check camera permissions.");
        setLastDescription("No camera access available.");
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
      formData.append("image", blob, "snapshot.jpg");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${backendUrl}/describe`, {
        method: "POST",
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
        smartSpeak("describe_success", data.description);
      } else {
        setLastDescription("No description available for this scene.");
        smartSpeak("describe_none", "No description available for this scene.");
      }
    } catch (error) {
      console.error("Describe error:", error);
      let message = "Failed to describe the scene.";
      if (error.name === "AbortError") {
        message = "Request timed out. Please try again.";
      } else if (error.message.includes("NetworkError")) {
        message = "Network error. Please check your connection.";
      }
      setLastDescription("Error: " + message);
      smartSpeak("describe_error", message);
    } finally {
      setIsDescribing(false);
    }
  }, [isDescribing, takeSnapshot, hasCameraAccess, hasUserInteracted]);

  useEffect(() => {
    startCamera();

    fetch(`${backendUrl}/ping`)
      .then(res => res.json())
      .then(data => console.log(data))
      .catch(err => console.error("Ping failed:", err));

    const cleanup = voiceCommands({ describeScene });

    const hasVisitedBefore = sessionStorage.getItem("hasVisitedSceneDescriptor");
    if (!hasVisitedBefore) {
      smartSpeak("welcome", "Welcome to Blind-Spot. Say describe the scene or tap the screen to begin.");
      sessionStorage.setItem("hasVisitedSceneDescriptor", "true");
    }

    return () => {
      if (cleanup && typeof cleanup === "function") cleanup();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [startCamera, describeScene]);

  return (
    <div
      className="camera-feed-container"
      onClick={handleUserInteraction}
      onTouchStart={handleUserInteraction}
    >
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
        isDisabled={isDescribing || isLoading || !!cameraError || !hasUserInteracted}
      />
    </div>
  );
}