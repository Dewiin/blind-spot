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

  async function describeScene() {
    const imageUrl = takeSnapshot();
    console.log("Describing the scene...");

    if (imageUrl) {
        try {
            // Convert base64 URL to Blob (as in the previous answer)
            const base64Data = imageUrl.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteArrays = [];

            for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                const slice = byteCharacters.slice(offset, offset + 512);
                const byteNumbers = new Array(slice.length);
                for (let i = 0; i < slice.length; i++) {
                    byteNumbers[i] = slice.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                byteArrays.push(byteArray);
            }
            const blob = new Blob(byteArrays, { type: 'image/png' });

            const formData = new FormData();
            formData.append('image', blob, 'snapshot.png');

            const response = await fetch(`http://localhost:5001/describe`, {
              method: 'POST',
              body: formData,
          });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            console.log("Backend response:", data);
            // Handle the response data

        } catch (error) {
            console.error("Error sending image to backend:", error);
            alert("Failed to describe the scene.");
        }
    }
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
