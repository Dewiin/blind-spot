import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      {/* <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p> */}
    
      <div className="wholePage">
        <div className="infoBar">
          <img src="src/images/asteroid.png" alt="Description of the image" />
        </div>
        <div className="mainBody">
          <div className="textSection">
            <h2>What is arround?</h2>
           <p>Say something or click on the button and we will describe it for you...</p> 

            
          </div>
          <div className="buttonSection">
            <img src="src/images/button.png" alt="Description of the image" />
            </div>
        </div>
    
      </div>

    </>
  )
}
export default App
