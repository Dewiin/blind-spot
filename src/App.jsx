import { CameraFeed } from './components/CameraFeed'
import './App.css'

function App() {
  return (
    <>
      <div className="wholePage">
        <div className="infoBar"> 
          <img src="src/images/asteroid.png" alt="Logo goes here" />
        </div>
        <div className="mainBody">
          <div className="textSection">
            <h2>Header</h2>
           <p>Say "Describe (the scene)"</p> 
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