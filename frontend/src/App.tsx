import { StartPage } from "./pages/StartPage";
import { CSATThanksPage } from "./pages/CSATThanksPage";

// Simple client-side router — no react-router dependency needed
export default function App() {
  const path = window.location.pathname;

  if (path.startsWith("/csat/thanks")) return <CSATThanksPage />;

  // Default → main chat page
  return <StartPage />;
}
