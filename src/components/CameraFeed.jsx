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
