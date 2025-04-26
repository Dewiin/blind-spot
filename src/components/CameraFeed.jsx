import { useEffect, useRef, useState } from "react";
import { voiceCommands } from "../utils/voiceCommands";
import { ControlPanel } from "./ControlPanel";

export function CameraFeed() {
  const videoRef = useRef(null);
  const [snapshot, setSnapshot] = useState(null);
  
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      console.log("Camera Stream:", stream); // Log the stream to ensure it's received
      if (videoRef.current) {
        videoRef.current.srcObject = stream; // Set the video element's stream
        console.log("Stream assigned to video element");
      }
    } catch (error) {
      console.error("Error accessing the camera:", error);
      alert("Please grant camera access for the app to work.");
    }
  }
  

  function takeSnapshot() {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      const imageUrl = canvas.toDataURL("image/png");
      setSnapshot(imageUrl);
      console.log("Snapshot taken:", imageUrl);

      return imageUrl;
    }
  };

  function describeScene() {
    takeSnapshot();
    console.log("Describing the scene... (AI model integration pending)");
  };

  // Set up camera & voice commands on mount
  useEffect(() => {
    startCamera();
    voiceCommands({ describeScene });
  });

  return (
    <>
      <div className="live-feed-recording">
        <video ref={videoRef} width="100%" height="auto" autoPlay />
      </div>

      <ControlPanel describeScene={describeScene}></ControlPanel>
    </>
  );
};
