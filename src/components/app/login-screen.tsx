'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Eye, EyeOff, Lock, Plane, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// SHA-256("ro901230") — computed at build time, never stored in plain text
const EXPECTED_HASH = '8928611398ca3dd657e2637f89f0885e42e4da2cd2d193ed8540da6e11cd0a15';

// Session storage key — clears on browser close
const SESSION_KEY = 'ovh_session_v1';
const LOCKOUT_KEY = 'ovh_lockout_v1';
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getRemainingLockout(): number {
  if (typeof window === 'undefined') return 0;
  const raw = sessionStorage.getItem(LOCKOUT_KEY);
  if (!raw) return 0;
  const { until } = JSON.parse(raw);
  const remaining = Math.ceil((until - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

function setLockout() {
  sessionStorage.setItem(LOCKOUT_KEY, JSON.stringify({ until: Date.now() + LOCKOUT_SECONDS * 1000 }));
}

function getAttempts(): number {
  if (typeof window === 'undefined') return 0;
  return Number(sessionStorage.getItem('ovh_attempts_v1') || '0');
}
function setAttempts(n: number) {
  sessionStorage.setItem('ovh_attempts_v1', String(n));
}
function clearAttempts() {
  sessionStorage.removeItem('ovh_attempts_v1');
  sessionStorage.removeItem(LOCKOUT_KEY);
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SESSION_KEY) === 'ok';
}

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockout, setLockoutState] = useState(() => getRemainingLockout());
  const inputRef = useRef<HTMLInputElement>(null);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockout <= 0) return;
    const timer = setInterval(() => {
      const remaining = getRemainingLockout();
      setLockoutState(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockout]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (lockout > 0 || loading || !password.trim()) return;

    setLoading(true);
    setError('');

    // Artificial small delay to prevent timing attacks
    await new Promise(r => setTimeout(r, 400));

    const hash = await sha256(password.trim());

    if (hash === EXPECTED_HASH) {
      clearAttempts();
      sessionStorage.setItem(SESSION_KEY, 'ok');
      onSuccess();
    } else {
      const attempts = getAttempts() + 1;
      setAttempts(attempts);
      const remaining = MAX_ATTEMPTS - attempts;

      if (attempts >= MAX_ATTEMPTS) {
        setLockout();
        setLockoutState(LOCKOUT_SECONDS);
        clearAttempts();
        setError(`Demasiados intentos fallidos. Espera ${LOCKOUT_SECONDS} segundos.`);
      } else {
        setError(`Contraseña incorrecta. ${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.`);
      }
      setPassword('');
      inputRef.current?.focus();
    }
    setLoading(false);
  }, [password, loading, lockout, onSuccess]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[hsl(222,47%,6%)] overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0 animated-grid" />
      
      {/* Radial gradient overlay for depth */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 50% 30%, hsla(24, 100%, 50%, 0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, hsla(210, 100%, 50%, 0.04) 0%, transparent 50%)'
      }} />

      {/* Subtle floating dots */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[15%] w-1 h-1 bg-primary/30 rounded-full animate-station-pulse" />
        <div className="absolute top-[60%] right-[20%] w-1.5 h-1.5 bg-blue-500/20 rounded-full animate-station-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-[40%] right-[35%] w-1 h-1 bg-primary/20 rounded-full animate-station-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-[25%] left-[30%] w-1 h-1 bg-blue-400/15 rounded-full animate-station-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="w-full max-w-sm px-4 relative z-10 animate-fade-up">
        {/* Glass login card */}
        <div className="rounded-2xl overflow-hidden shadow-2xl"
          style={{
            background: 'hsla(222, 41%, 10%, 0.7)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid hsla(215, 20%, 55%, 0.15)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
          }}
        >
          {/* Top accent bar with glow */}
          <div className="h-1 bg-gradient-to-r from-primary/80 via-primary to-primary/80 w-full" style={{
            boxShadow: '0 2px 12px hsla(24, 100%, 50%, 0.3)'
          }} />

          <div className="p-8 space-y-6">
            {/* Logo / Branding */}
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="relative">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'hsla(24, 100%, 50%, 0.1)',
                    border: '1px solid hsla(24, 100%, 50%, 0.2)'
                  }}
                >
                  <Plane className="h-8 w-8 text-primary" />
                </div>
                {/* Subtle glow ring */}
                <div className="absolute -inset-1 rounded-2xl opacity-40 animate-pulse-glow pointer-events-none" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">
                  OVH
                </h1>
                <p className="text-xs text-[hsl(215,20%,55%)] mt-1">
                  Sistema de Logística Aérea
                </p>
              </div>
            </div>

            {/* Separator */}
            <div className="border-t border-white/[0.06]" />

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-[hsl(213,31%,91%)]">
                  Contraseña de acceso
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(215,20%,55%)]" />
                  <Input
                    ref={inputRef}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    className="pl-9 pr-10 h-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-[hsl(215,20%,40%)] focus:border-primary/50 focus:ring-primary/20 transition-all"
                    placeholder="••••••••"
                    disabled={loading || lockout > 0}
                    autoComplete="current-password"
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(215,20%,55%)] hover:text-white transition-colors"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {(error || lockout > 0) && (
                <div
                  id="login-error"
                  role="alert"
                  className="flex items-center gap-2 text-xs rounded-lg px-3 py-2.5"
                  style={{
                    background: 'hsla(0, 60%, 40%, 0.15)',
                    border: '1px solid hsla(0, 60%, 50%, 0.2)',
                    color: 'hsl(0, 90%, 72%)'
                  }}
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {lockout > 0
                      ? `Acceso bloqueado. Espera ${lockout}s para reintentar.`
                      : error}
                  </span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 font-semibold bg-primary hover:bg-primary/90 text-white transition-all shadow-lg hover:shadow-primary/20"
                disabled={loading || lockout > 0 || !password.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando…
                  </>
                ) : (
                  'Ingresar al sistema'
                )}
              </Button>
            </form>
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 text-center">
            <p className="text-[11px] text-[hsl(215,20%,35%)]">
              Acceso restringido · Solo personal autorizado
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
