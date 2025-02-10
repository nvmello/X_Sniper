import "./App.css";

import Temp from "./components/temp";
import Scrollview from "./components/scrollview";
import Dashboard from "./components/Dashboard";
import ControlPanel from "./components/ControlPanel";

function App() {
  return (
    <main className="text-white h-screen overflow-hidden flex flex-col">
      {/*  ai generated concept  */}
      {/* <Dashboard /> */}
      {/* My own chicken scratch */}
      <ControlPanel />
      <Scrollview />
      {/* <Temp /> */}
    </main>
  );
}

export default App;
