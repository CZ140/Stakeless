import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { AuthLayout } from '../components/vault/AuthLayout';

export function ResetPasswordPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token') ?? '';

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <AuthLayout>
        <div className="auth-card">
          <div className="auth-eyebrow">RECOVERY · LINK INVALID</div>
          <h1>This link is dead.</h1>
          <p className="subtitle">This reset link is invalid or has already been used. Request a fresh one and try again.</p>
          <div className="auth-foot-link"><Link to="/forgot-password">Request a new link →</Link></div>
        </div>
      </AuthLayout>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post<{ accessToken: string }>(
        '/api/auth/reset-password',
        { token, password },
        { withCredentials: true },
      );
      signIn(res.data.accessToken);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(msg ?? 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-eyebrow">RECOVERY · SET A NEW PASSWORD</div>
        <h1>Choose a new password.</h1>
        <p className="subtitle">Pick something at least 8 characters. You&apos;ll be signed in right after.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <div className="field-row"><label className="label" htmlFor="password">New password</label></div>
            <input
              id="password" className="input" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" minLength={8}
              placeholder="at least 8 characters"
            />
          </div>

          <div style={{ height: 8 }} />

          <button type="submit" className="btn btn-primary submit" disabled={loading}>
            {loading ? <><span className="spinner" />Saving…</> : 'Set new password'}
          </button>
        </form>

        <div className="auth-foot-link">
          Remembered it? <Link to="/login">Back to sign in →</Link>
        </div>
      </div>
    </AuthLayout>
  );
}
