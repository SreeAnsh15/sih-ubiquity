/** Civic Signal: the application stays in a light civic workspace with the role-driven demo at its center. */
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";

export default function App() {
  return <ErrorBoundary><Home /></ErrorBoundary>;
}
