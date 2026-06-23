import { Button } from 'semantic-ui-react'
import logo from './logo.svg';
import './App.css';
import conf from './conf'

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <Button to='/'>
          To homepage
        </Button>
      </header>
    </div>
  );
}

export default App;
