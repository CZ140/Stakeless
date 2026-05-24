import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { AuthLayout } from '../components/vault/AuthLayout';

export function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const token = new URLSearchParams(location.search).get('token');
    if (!token) {
      setStatus('error');
      return;
    }
    axios
      .get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { withCredentials: true })
      .then(() => {
        setStatus('success');
        setTimeout(() => navigate('/login?verified=true', { replace: true }), 2000);
      })
      .catch(() => setStatus('error'));
  }, [location.search, navigate]);

  return (
    <AuthLayout>
      <div className="auth-card">
        {status === 'loading' && (
          <>
            <div className="auth-eyebrow">EMAIL · VERIFYING</div>
            <h1>Hang tight.</h1>
            <p className="subtitle" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="spinner" style={{ borderColor: 'var(--accent)', borderRightColor: 'transparent' }} />
              Verifying your email…
            </p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="auth-eyebrow">EMAIL · VERIFIED</div>
            <h1>You&apos;re in.</h1>
            <p className="subtitle">Your email is verified and your 1,000 coins are ready. Redirecting you to sign in…</p>
            <div className="auth-foot-link"><Link to="/login?verified=true">Go to sign in →</Link></div>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="auth-eyebrow">EMAIL · LINK INVALID</div>
            <h1>This link is dead.</h1>
            <p className="subtitle">This verification link is invalid or has expired. Sign in to request a new one, or create an account.</p>
            <div className="auth-foot-link"><Link to="/login">Back to sign in →</Link></div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
