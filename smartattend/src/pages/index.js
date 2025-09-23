import Link from 'next/link';
import dynamic from 'next/dynamic';

const ThemeToggleButton = dynamic(() => import('../components/ThemeToggleButton'), { ssr: false });

export default function LandingPage() {
  const scrollTo = (id) => {
    if (typeof window === 'undefined') return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-30 border-b" style={{ background: 'rgba(var(--background-rgb), 0.8)', backdropFilter: 'saturate(180%) blur(10px)', borderColor: 'var(--glass-border)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }} />
            <span className="text-lg font-semibold" style={{ color: 'rgb(var(--body-foreground-rgb))' }}>SmartAttend</span>
          </div>
          <nav className="hidden md:flex items-center gap-6" style={{ color: 'rgb(var(--body-foreground-rgb))' }}>
            <button className="hover:opacity-80" onClick={() => scrollTo('features')}>Features</button>
            <button className="hover:opacity-80" onClick={() => scrollTo('howitworks')}>How it works</button>
            <button className="hover:opacity-80" onClick={() => scrollTo('pricing')}>Pricing</button>
            <button className="hover:opacity-80" onClick={() => scrollTo('about')}>About</button>
            <button className="hover:opacity-80" onClick={() => scrollTo('contact')}>Contact</button>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 rounded-lg border text-sm font-medium hover:opacity-90" style={{ borderColor: 'var(--glass-border)', color: 'rgb(var(--body-foreground-rgb))' }}>Log in</Link>
            <Link href="/register" className="px-4 py-2 rounded-lg text-sm font-semibold shadow" style={{ background: 'var(--gradient-primary)', color: '#fff' }}>Get Started</Link>
            <ThemeToggleButton />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-28 lg:py-32 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight">
            Smart Attendance. Zero Proxy. Real Insights.
          </h1>
          <p className="mt-6 text-lg max-w-3xl mx-auto" style={{ color: 'var(--text-muted)' }}>
            AI-powered attendance monitoring system with multi-factor security and real-time analytics for colleges.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/register" className="px-6 py-3 rounded-xl font-semibold shadow hover:translate-y-[-2px] transition" style={{ background: 'var(--gradient-primary)', color: '#fff' }}>Get Started</Link>
            <button onClick={() => scrollTo('contact')} className="px-6 py-3 rounded-xl font-semibold border hover:bg-white/5 transition" style={{ borderColor: 'var(--glass-border)', color: 'rgb(var(--body-foreground-rgb))' }}>Book a Demo</button>
          </div>
        </div>
        <div className="absolute inset-0 -z-10" aria-hidden>
          <div className="pointer-events-none select-none" style={{ position: 'absolute', inset: 0, background:
            'radial-gradient(600px 200px at 20% 80%, rgba(99,102,241,0.15), transparent 60%), radial-gradient(600px 200px at 80% 20%, rgba(6,182,212,0.15), transparent 60%)' }} />
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-7xl px-6 py-16" id="problem">
        <h2 className="text-2xl sm:text-3xl font-bold">Why Manual Attendance Fails?</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[ 'Wastes teaching time', 'Proxy attendance', 'Errors in registers', 'No real-time analytics' ].map((t, i) => (
            <div key={i} className="p-5 rounded-xl border hover:shadow-md transition" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
              <p className="font-medium" style={{ color: 'rgb(var(--foreground-rgb))' }}>{t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Solution */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold">Our Solution</h2>
        <p className="mt-3 max-w-3xl" style={{ color: 'var(--text-muted)' }}>
          Multi-factor authentication with Face recognition, secure PIN fallback, and Wi-Fi/Bluetooth proximity validation.
          Built-in proxy prevention, real-time analytics, gamified student dashboard, and admin-grade reporting.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Proxy Prevention' },
            { label: 'Real-Time Analytics' },
            { label: 'Gamified Dashboard' },
            { label: 'Admin Reports' },
          ].map((f, i) => (
            <div key={i} className="p-6 rounded-2xl border hover:translate-y-[-3px] transition" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
              <div className="w-10 h-10 rounded-lg mb-4" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }} />
              <p className="font-semibold" style={{ color: 'rgb(var(--foreground-rgb))' }}>{f.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold">Key Features</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Student Module', desc: 'Secure login, gamified dashboard, QR + proximity check.' },
            { title: 'Teacher Module', desc: 'Session creation, auto/manual attendance, analytics.' },
            { title: 'Admin Module', desc: 'Approvals, centralized database, institute-wide insights.' },
            { title: 'Security', desc: 'Multi-factor checks, logs, auto-expiring QR.' },
          ].map((c, idx) => (
            <div key={idx} className="p-6 rounded-2xl border hover:shadow-md transition" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'rgb(var(--foreground-rgb))' }}>{c.title}</h3>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="howitworks" className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold">How It Works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { step: '1', title: 'Create Session', desc: 'Teacher creates session with QR + Wi-Fi/Bluetooth settings.' },
            { step: '2', title: 'Join & Validate', desc: 'Students scan QR and pass proximity checks.' },
            { step: '3', title: 'Verify', desc: 'System verifies identity and marks attendance.' },
            { step: '4', title: 'Dashboards', desc: 'Live updates for Teacher, Admin, and Student.' },
          ].map((s, i) => (
            <div key={i} className="p-6 rounded-2xl border relative" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'var(--gradient-secondary)', color: '#fff' }}>{s.step}</div>
              <h3 className="text-lg font-semibold" style={{ color: 'rgb(var(--foreground-rgb))' }}>{s.title}</h3>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Screenshots / Demo placeholders */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold">Visual Demo</h2>
        <p className="mt-2" style={{ color: 'var(--text-muted)' }}>Placeholder previews — plug in your app screenshots anytime.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-video rounded-2xl border overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(6,182,212,0.15))', borderColor: 'var(--glass-border)' }} />
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold">Pricing</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            { name: 'Starter', audience: 'Small colleges', price: '₹4,999/mo', features: ['Up to 1,000 students', 'Core analytics', 'Email support'] },
            { name: 'Standard', audience: 'Universities', price: '₹14,999/mo', features: ['Up to 10,000 students', 'Advanced analytics', 'Priority support'] },
            { name: 'Enterprise', audience: 'Multi-campus', price: 'Custom', features: ['Unlimited', 'Dedicated support', 'Advanced controls'] },
          ].map((p, i) => (
            <div key={i} className="p-6 rounded-2xl border flex flex-col" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
              <h3 className="text-xl font-semibold" style={{ color: 'rgb(var(--foreground-rgb))' }}>{p.name}</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{p.audience}</p>
              <div className="mt-4 text-3xl font-extrabold" style={{ color: 'rgb(var(--foreground-rgb))' }}>{p.price}</div>
              <ul className="mt-4 space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                {p.features.map((f, idx) => (<li key={idx}>• {f}</li>))}
              </ul>
              <div className="mt-6">
                <button className="w-full px-4 py-2 rounded-xl font-semibold shadow hover:translate-y-[-2px] transition" style={{ background: 'var(--gradient-primary)', color: '#fff' }}>Choose Plan</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About / Impact */}
      <section id="about" className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-8 md:grid-cols-2 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold">Empowering education with technology</h2>
            <p className="mt-3" style={{ color: 'var(--text-muted)' }}>
              Preventing proxy, saving teaching time, and delivering actionable insights. Built for modern institutes and aligned with Digital India.
            </p>
            <ul className="mt-4 space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <li>• Saves time</li>
              <li>• Improves accuracy</li>
              <li>• Motivates students</li>
              <li>• Supports Digital India</li>
            </ul>
          </div>
          <div className="aspect-video rounded-2xl border" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(6,182,212,0.15))', borderColor: 'var(--glass-border)' }} />
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold">Ready to Modernize Attendance?</h2>
            <p className="mt-3" style={{ color: 'var(--text-muted)' }}>
              Tell us about your institution and we’ll get back with a tailored demo and pricing.
            </p>
            <div className="mt-6 flex gap-3">
              <a href="#pricing" className="px-4 py-2 rounded-xl font-semibold shadow" style={{ background: 'var(--gradient-primary)', color: '#fff' }}>Request Pricing</a>
              <button onClick={() => scrollTo('contact')} className="px-4 py-2 rounded-xl font-semibold border" style={{ borderColor: 'var(--glass-border)', color: 'rgb(var(--body-foreground-rgb))' }}>Book Demo</button>
            </div>
          </div>
          <form method="post" action="/api/contact" className="p-6 rounded-2xl border" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">Name</label>
                <input name="name" required className="form-input" placeholder="Your name" />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input type="email" name="email" required className="form-input" placeholder="you@example.com" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 mt-2">
              <div>
                <label className="form-label">Institution</label>
                <input name="institution" className="form-input" placeholder="College / University" />
              </div>
              <div>
                <label className="form-label">Plan Interest</label>
                <select name="plan" className="form-select">
                  <option>Starter</option>
                  <option>Standard</option>
                  <option>Enterprise</option>
                </select>
              </div>
            </div>
            <div className="mt-2">
              <label className="form-label">Message</label>
              <textarea name="message" rows="4" className="form-input" placeholder="Tell us more..." />
            </div>
            <div className="mt-4">
              <button type="submit" className="w-full px-4 py-2 rounded-xl font-semibold shadow hover:translate-y-[-2px] transition" style={{ background: 'var(--gradient-primary)', color: '#fff' }}>Send Message</button>
            </div>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t" style={{ borderColor: 'var(--glass-border)' }}>
        <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>© {new Date().getFullYear()} SmartAttend. All rights reserved.</p>
          <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            <a href="#">Twitter</a>
            <a href="#">LinkedIn</a>
            <a href="#">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}