import { CameraFeed } from './components/CameraFeed'
import './App.css'

function App() {
  return (
    <div className="content">
      <CameraFeed />
    </div>
  )
}
export default App


```
// src/App.jsx
import { useState, useEffect } from 'react';
import { CameraFeed } from './components/CameraFeed';
import { voiceCommands } from './utils/voiceCommands';
import './App.css';

function App() {
  const [caption, setCaption] = useState("");

  useEffect(() => {
    voiceCommands(() => console.log("Voice command detected!"));
  }, []);

  return (
    <div className="wholePage">
      <div className="infoBar">
        <img src="src/images/asteroid.png" alt="Logo" />
      </div>
      <div className="mainBody">
        <div className="textSection">
          <h2>What is around?</h2>
          <p>Say something or tap the screen and we will describe it for you...</p>
          {caption && <p><strong>Caption:</strong> {caption}</p>}
        </div>
        <div className="buttonSection">
          <CameraFeed onCaption={setCaption} />
        </div>
      </div>
    </div>
  );
}

export default App;

```