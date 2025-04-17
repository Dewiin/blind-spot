import { CameraFeed } from './components/CameraFeed'
import './App.css'

function App() {
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
          <div className="cameraSection">
          <CameraFeed></CameraFeed>
          </div>
        </div>
      </div>
    </>

  )
}
export default App