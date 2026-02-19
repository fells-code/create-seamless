import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider, AuthRoutes, useAuth } from "@seamless-auth/react";
import "./App.css";

const AUTH_SERVER = import.meta.env.VITE_AUTH_SERVER_URL;
const AUTH_MODE = import.meta.env.AUTH_MODE;

function AuthSurface() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      {!isAuthenticated ? (
        <Route path="*" element={<AuthRoutes />} />
      ) : (
        <Route
          path="*"
          element={
            <>
              <div>
                <h2>You are signed in</h2>
                <div>
                  <p>Signed in as:</p>

                  <pre>{JSON.stringify(user, null, 2)}</pre>
                </div>
              </div>
            </>
          }
        />
      )}
    </Routes>
  );
}

export default function App() {
  return (
    <>
      <div className="grid-bg" />

      <div className="app-container">
        <Router>
          <AuthProvider apiHost={AUTH_SERVER} mode={AUTH_MODE}>
            <div className="left-panel">
              <div className="auth-card">
                <AuthSurface />
              </div>
            </div>
          </AuthProvider>
        </Router>

        <div className="right-panel">
          <div className="title-row">
            <div className="title-accent" />
            <h1 className="brand-title">Seamless Auth</h1>
          </div>

          <p className="brand-subtitle">
            Modern passwordless authentication infrastructure built for
            production-grade applications.
          </p>

          <a
            className="docs-link"
            href="https://docs.seamlessauth.com"
            target="_blank"
            rel="noreferrer"
          >
            Learn more →
          </a>

          <div className="micro-label">Powered by SeamlessAuth</div>
        </div>
      </div>
    </>
  );
}
