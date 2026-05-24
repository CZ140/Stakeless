import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AuthLayout } from '../components/vault/AuthLayout';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/api/auth/forgot-password', { email });
    } catch {
      // Swallow error — always show success to avoid email enumeration
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <AuthLayout>
        <div className="auth-card">
          <div className="auth-eyebrow">RECOVERY · LINK SENT</div>
          <h1>Check your email.</h1>
          <p className="subtitle">
            If <strong style={{ color: 'var(--text)' }}>{email}</strong> is registered, a password reset link is on its
            way. The link expires in a short while — use it soon.
          </p>
          <div className="auth-foot-link">
            <Link to="/login">Back to sign in →</Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-eyebrow">RECOVERY · RESET YOUR PASSWORD</div>
        <h1>Forgot it? Fine.</h1>
        <p className="subtitle">Enter your email and we&apos;ll send a recovery link. No password expires here.</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <div className="field-row"><label className="label" htmlFor="email">Email</label></div>
            <input
              id="email" className="input" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
            />
          </div>

          <div style={{ height: 8 }} />

          <button type="submit" className="btn btn-primary submit" disabled={loading}>
            {loading ? <><span className="spinner" />Sending link…</> : 'Send recovery link'}
          </button>
        </form>

        <div className="auth-foot-link">
          Remembered it? <Link to="/login">Back to sign in →</Link>
        </div>
      </div>
    </AuthLayout>
  );
}
