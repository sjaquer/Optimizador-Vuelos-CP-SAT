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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-4">
        <div className="bg-card border rounded-2xl shadow-2xl overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1.5 bg-primary w-full" />

          <div className="p-8 space-y-6">
            {/* Logo */}
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Plane className="h-9 w-9 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Logística Aérea</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Sistema de Optimización de Rutas</p>
              </div>
            </div>

            {/* Separator */}
            <div className="border-t" />

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">
                  Contraseña de acceso
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    className="pl-9 pr-10"
                    placeholder="••••••••"
                    disabled={loading || lockout > 0}
                    autoComplete="current-password"
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                  className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2"
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
                className="w-full"
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
            <p className="text-[11px] text-muted-foreground/60">
              Acceso restringido · Solo personal autorizado
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
