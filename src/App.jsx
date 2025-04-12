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
      <div className="wholePage">
        <div className="infoBar"> 
          <img src="src/images/asteroid.png" alt="Description of the image" />
        </div>
        <div className="mainBody">
          <div className="textSection">
            <h2>What is arround?</h2>
           <p>Say something or touch the screen and we will describe it for you...</p> 
          </div>
          <div className="buttonSection">
          <CameraFeed></CameraFeed>
            {/* <img src="src/images/button.png" alt="Description of the image" /> */}
            </div>
        </div>
    
      </div>

    </>
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