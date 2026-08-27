import { Redirect, Route, Switch } from "wouter";
import { Toaster } from "sonner";
import ErrorBoundary from "./components/ErrorBoundary";
import { AdminDashboardPage, HomePage, WorkerPage } from "./pages/Home";

export default function App() {
  return <ErrorBoundary><Switch><Route path="/admin" component={AdminDashboardPage} /><Route path="/worker" component={WorkerPage} /><Route path="/profile" component={WorkerPage} /><Route path="/" component={HomePage} /><Route><Redirect to="/" /></Route></Switch><Toaster position="top-right" richColors closeButton /></ErrorBoundary>;
}
