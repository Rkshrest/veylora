import { useState } from 'react';
import { ArrowLeft, ArrowRight, Leaf, Sprout } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register', { login, register } = useAuth(), navigate = useNavigate(), location = useLocation();
  const [form, setForm] = useState({ name: '', organizationName: '', email: '', password: '', role: 'recipient' });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const set = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (isRegister) await register(form);
      else await login({ email: form.email, password: form.password });
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <main className="auth-shell"><div className="auth-header"><Link className="site-brand" to="/"><span className="site-brand-icon"><Sprout size={19}/></span><span>veylora</span></Link><Link className="auth-back" to="/"><ArrowLeft size={14}/> Back to home</Link></div>
      <div className="auth-layout"><section className="auth-story"><span className="auth-story-label"><Leaf size={14}/> FOOD, REDIRECTED WITH CARE</span><h1>{isRegister?<>A better food<br/><em>loop starts here.</em></>:<>Welcome back<br/><em>to the loop.</em></>}</h1><p>{isRegister?'Join a local effort to move good food from surplus to shared value.':'Pick up where your community’s good work left off.'}</p><div className="auth-story-foot"><span className="auth-story-rule"/><span>Recover value. Reveal impact.</span></div><div className="auth-doodle"><span/><span/><span/><Leaf size={44}/></div></section>
      <section className="auth-card"><div className="auth-card-heading"><p className="section-eyebrow">{isRegister?'CREATE YOUR ACCOUNT':'YOUR VEYLORA WORKSPACE'}</p><h2>{isRegister?'Get started':'Sign in'}</h2><p>{isRegister?'Set up an account for your organization.':'Use your organization account to continue.'}</p></div>
        <form className="auth-form" onSubmit={submit}>
          {isRegister&&<><label className="auth-field"><span>Your name</span><input name="name" value={form.name} onChange={set} autoComplete="name" maxLength="100" placeholder="Full name" required/></label><label className="auth-field"><span>Organization name</span><input name="organizationName" value={form.organizationName} onChange={set} autoComplete="organization" maxLength="120" placeholder="Your restaurant or community organization" required/></label></>}
          <label className="auth-field"><span>Email address</span><input type="email" name="email" value={form.email} onChange={set} autoComplete="email" maxLength="254" placeholder="you@organization.org" required/></label>
          <label className="auth-field"><span>Password</span><input type="password" name="password" value={form.password} onChange={set} autoComplete={isRegister?'new-password':'current-password'} minLength="8" maxLength="72" placeholder={isRegister?'At least 8 characters':'Your password'} required/>{isRegister&&<small>Use at least 8 characters.</small>}</label>
          {isRegister&&<fieldset className="role-choice"><legend>I’m joining as a</legend><label className={form.role==='recipient'?'selected':''}><input type="radio" name="role" value="recipient" checked={form.role==='recipient'} onChange={set}/><span className="role-choice-mark"><Leaf size={15}/></span><span><b>Recipient</b><small>Find and collect food</small></span></label><label className={form.role==='donor'?'selected':''}><input type="radio" name="role" value="donor" checked={form.role==='donor'} onChange={set}/><span className="role-choice-mark"><Sprout size={15}/></span><span><b>Donor</b><small>Share surplus food</small></span></label></fieldset>}
          {error&&<div className="auth-error" role="alert">{error}</div>}
          <button className="site-button site-button-dark auth-submit" disabled={busy}>{busy?(isRegister?'Creating account…':'Signing in…'):(isRegister?'Create account':'Sign in')} <ArrowRight size={16}/></button>
        </form><div className="auth-switch">{isRegister?'Already have an account?':'New to Veylora?'} <Link to={isRegister?'/login':'/register'}>{isRegister?'Sign in':'Create an account'}</Link></div><div className="auth-security">Your password is securely hashed and never stored as plain text.</div>
      </section></div><footer className="auth-footer">© {new Date().getFullYear()} Veylora <span>·</span> Recover value. Reveal impact.</footer>
  </main>;
}
