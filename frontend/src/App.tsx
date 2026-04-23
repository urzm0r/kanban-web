import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Board } from "./components/Board";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./components/Dashboard";
import { parseJwt } from "./lib/jwt";

function App() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = sessionStorage.getItem("kanban_token");
    if (savedToken) setToken(savedToken);
  }, []);

  const handleAuth = (newToken: string) => {
    sessionStorage.setItem("kanban_token", newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("kanban_token");
    setToken(null);
  };

  const currentUserId = token ? parseJwt(token)?.userId || "" : "";

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0f172a] overflow-hidden selection:bg-[#3b82f6]/30 text-slate-100">
        <Routes>
          <Route 
            path="/" 
            element={token ? <Navigate to="/dashboard" /> : <AuthScreen onAuthSuccess={handleAuth} />} 
          />
          <Route 
            path="/dashboard" 
            element={token ? <Dashboard token={token} userId={currentUserId || ""} onLogout={handleLogout} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/board/:boardId" 
            element={token ? <Board token={token} onLogout={handleLogout} /> : <Navigate to="/" />} 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
