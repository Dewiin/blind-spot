import { useEffect, useRef } from "react";

export function CameraFeed() {
  const videoRef = useRef();

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      })
      .catch((err) => console.error("Error accessing camera:", err));
  }, []);

  return <video ref={videoRef} width="100%" height="auto" />;
}



```
// src/components/CameraFeed.jsx

import React, { useRef, useState, useEffect } from 'react';

export const CameraFeed = ({ onCaption }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streamStarted, setStreamStarted] = useState(false);

  // Start the camera when component mounts.
  useEffect(() => {
    const startCamera = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setStreamStarted(true);
          }
        } catch (error) {
          console.error("Error starting the video stream", error);
        }
      }
    };
    startCamera();
  }, []);

  // Capture image when the video element is clicked.
  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const formData = new FormData();
      formData.append("image", blob, "capture.jpg");
      try {
        const response = await fetch("http://localhost:5000/caption", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (data.caption) {
          onCaption(data.caption);
        } else {
          console.error("No caption in response", data);
        }
      } catch (error) {
        console.error("Error generating caption:", error);
      }
    }, "image/jpeg");
  };

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        onClick={captureImage}
        style={{ width: "100%" }}
      />
      {/* Hidden canvas used for capturing the frame */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <p>Tap the video to capture an image and generate a caption.</p>
    </div>
  );
};


```