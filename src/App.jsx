import { useState, useEffect } from 'react'
import { CameraFeed } from './components/CameraFeed'
import { voiceCommands } from './utils/voiceCommands';
import './App.css'

function App() {
  useEffect(() => {
    voiceCommands(() => console.log("Voice command detected!"));
  }, []);

  return (
    <>
      <CameraFeed></CameraFeed>
    </>
  )
}
export default App
