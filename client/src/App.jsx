import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import Dashboard from './Dashboard.jsx';
import LandingPage from './pages/LandingPage.jsx';
import AuthPage from './pages/AuthPage.jsx';

function RouteLoader() { return <div className="route-loading"><span className="spinner"/> Loading your workspace…</div>; }
function ProtectedRoute() {
  const { user, loading } = useAuth(), location = useLocation();
  if (loading) return <RouteLoader/>;
  return user ? <Dashboard/> : <Navigate to="/login" replace state={{ from: location }}/>;
}
function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteLoader/>;
  return user ? <Navigate to="/dashboard" replace/> : children;
}
function AppRoutes() {
  return <Routes>
    <Route path="/" element={<LandingPage/>}/>
    <Route path="/login" element={<GuestRoute><AuthPage mode="login"/></GuestRoute>}/>
    <Route path="/register" element={<GuestRoute><AuthPage mode="register"/></GuestRoute>}/>
    <Route path="/dashboard" element={<ProtectedRoute/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes/></AuthProvider></BrowserRouter>;
}
