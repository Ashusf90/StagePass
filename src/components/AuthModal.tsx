import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ApiClientError } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated?: () => void;
}

const DEMO_ACCOUNTS = [
  {
    label: 'Attendee',
    name: 'Alex Rivera',
    email: 'alex@stagepass.io',
    password: 'Password123!',
    note: 'Browse, hold seats, checkout & view QR passes',
  },
  {
    label: 'Organizer',
    name: 'Elena Vance',
    email: 'elena@luminaevents.com',
    password: 'Password123!',
    note: 'Create events, analytics & QR gate check-in',
  },
  {
    label: 'Admin',
    name: 'Nadia Sterling',
    email: 'admin@stagepass.io',
    password: 'Password123!',
    note: 'Moderate vendors/events & inspect webhook logs',
  },
];

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onClose,
  onAuthenticated,
}) => {
  const { login, register } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'attendee' | 'organizer'>('attendee');
  const [organizationName, setOrganizationName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const user = await login(email, password);
        showToast(`Signed in as ${user.name}`, 'success');
      } else {
        const user = await register({
          name,
          email,
          password,
          role,
          organizationName: role === 'organizer' ? organizationName : undefined,
        });
        showToast(
          role === 'organizer'
            ? 'Organizer account created (pending admin approval for publishing).'
            : `Welcome to StagePass, ${user.name}`,
          'success'
        );
      }
      onAuthenticated?.();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Unable to authenticate'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(demoEmail, demoPassword);
      showToast(`Signed in as ${user.name} (${user.role})`, 'success');
      onAuthenticated?.();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Demo sign-in failed'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="auth-modal-title" className="text-lg font-semibold text-slate-900">
            {mode === 'login' ? 'Sign in to StagePass' : 'Create your account'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Full name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jordan Taylor"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Account type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('attendee')}
                      className={`py-2 px-3 text-sm font-medium rounded-lg border transition-colors ${
                        role === 'attendee'
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Attendee
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('organizer')}
                      className={`py-2 px-3 text-sm font-medium rounded-lg border transition-colors ${
                        role === 'organizer'
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Organizer
                    </button>
                  </div>
                </div>
                {role === 'organizer' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Organization / Venue Name
                    </label>
                    <input
                      type="text"
                      required
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="Northstar Live Arts"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {submitting
                ? 'Authenticating...'
                : mode === 'login'
                  ? 'Sign In'
                  : 'Create Account'}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-2.5">
              Quick role testing (seeded accounts)
            </p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoLogin(acc.email, acc.password)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      {acc.name} · {acc.label}
                    </div>
                    <div className="text-xs text-slate-500">{acc.note}</div>
                  </div>
                  <span className="text-xs font-medium text-blue-600 whitespace-nowrap shrink-0 ml-2">
                    Sign in
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
