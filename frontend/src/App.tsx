import { useState, useEffect } from "react";
import { Board } from "./components/Board";
import { AuthScreen } from "./components/AuthScreen";

function App() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("kanban_token");
    if (saved) setToken(saved);
  }, []);

  const handleAuth = (newToken: string) => {
    localStorage.setItem("kanban_token", newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("kanban_token");
    setToken(null);
  };

  if (!token) {
    return <AuthScreen onAuthSuccess={handleAuth} />;
  }

  return (
    <div className="min-h-screen bg-[#0f172a] overflow-hidden selection:bg-[#3b82f6]/30">
      <Board token={token} onLogout={handleLogout} />
    </div>
  );
}

export default App;
