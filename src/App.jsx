import { CameraFeed } from './components/CameraFeed'
import './App.css'

function App() {
  return (
    <>
      <div className="wholePage">
        <div className="infoBar"> 
          <img src="src/images/Logo.png" alt="Logo goes here" width= "50%" />
        </div>
        <div className="mainBody">
          <img src="src/images/describe.png" alt="Logo goes here" width = "50%" />
          <CameraFeed></CameraFeed>
        </div>
      </div>
    </>

  )
}
export default App