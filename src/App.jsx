import { CameraFeed } from './components/CameraFeed'
import './App.css'
import { ControlPanel } from './components/ControlPanel'

function App() {
  return (
    <>
      <div className="wholePage">
        <div className="infoBar"> 
          <img src="assets/Logo.png" alt="Logo goes here" width= "50%" />
        </div>
        <div className="mainBody">
          <img src="assets/describe.png" alt="Logo goes here" width = "50%" />
          <CameraFeed />
        </div>
      </div>
    </>

  )
}
export default App
