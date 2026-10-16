import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />

                <Route
                    path="/login"
                    element={
                        localStorage.getItem("access")
                            ? <Navigate to="/chat" replace />
                            : <Login />
                    }
                />

                <Route
                    path="/register"
                    element={
                        localStorage.getItem("access")
                            ? <Navigate to="/chat" replace />
                            : <Register />
                    }
                />

                <Route
                    path="/chat"
                    element={
                        localStorage.getItem("access")
                            ? <Dashboard />
                            : <Navigate to="/login" replace />
                    }
                />

                <Route
                    path="*"
                    element={<Navigate to="/login" replace />}
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;