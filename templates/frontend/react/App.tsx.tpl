import { AuthProvider, useAuth } from "@seamless-auth/react";
import "./App.css";

const AUTH_SERVER = import.meta.env.VITE_AUTH_SERVER_URL;

function LoginPanel() {
  const { login, register, user, logout, isAuthenticated } = useAuth();

  return (
    <div className="auth-card">
      {user && isAuthenticated ? (
        <>
          <h2>Welcome back</h2>
                <div>
                  <p>Signed in as:</p>

                  <pre>{JSON.stringify(user, null, 2)}</pre>
                </div>
          <button className="auth-button" onClick={logout}>
            Logout
          </button>
        </>
      ) : (
        <>
          <h2>Login or Register</h2>
          <button className="auth-button" onClick={() => login()}>
            Login with Passkey
          </button>
          <br />
          <br />
          <button className="auth-button" onClick={() => register()}>
            Register
          </button>
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <>
      <div className="grid-bg" />
      <div className="app-container">
        <div className="left-panel">
          <AuthProvider apiHost={AUTH_SERVER}>
            <LoginPanel />
          </AuthProvider>
        </div>
        <div className="right-panel">
          <h1 className="brand-title">Seamless Auth</h1>
          <p className="brand-subtitle">
            Passwordless authentication you will actually deploy to production.
          </p>
          <a
            className="docs-link"
            href="https://docs.seamlessauth.com"
            target="_blank"
          >
            Learn more →
          </a>
          <div className="micro-label">Powered by SeamlessAuth</div>
        </div>
      </div>
    </>
  );
}
