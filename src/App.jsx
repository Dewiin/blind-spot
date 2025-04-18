import { CameraFeed } from './components/CameraFeed'
import './App.css'

function App() {
  return (
    <>
      <div className="wholePage">
        <div className="infoBar"> 
          <img src="src/images/Logo.png" alt="Logo goes here" />
        </div>
        <div className="mainBody">
          <div className="textSection">
   
          </div>
          <div className="tvContainer">
            <CameraFeed></CameraFeed>
          </div>
        </div>
      </div>
    </>

  )
}
export default App