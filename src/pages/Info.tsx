import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Media } from '@/components/Media';
import { EmptyState, ExploreLink, Field, Heading, Spinner } from '@/components/ui';
import { FAQS } from '@/data/content';
import { MEDIA } from '@/data/media';
import { sendContactMessage } from '@/services/api';
import { useUI } from '@/store';
import { cx } from '@/utils/format';

export function About() {
  return (
    <div className="container-x py-12">
      <Heading as="h1" pre="Our" title="Story" size="xl" />
      <div className="mt-12 grid items-center gap-12 lg:grid-cols-2">
        <Media image={MEDIA.story.image} className="aspect-[4/5] rounded-xl" />
        <div className="space-y-5 text-[15px] leading-relaxed text-ink-600">
          <p className="font-serif text-3xl italic leading-snug text-brand">Every beautiful outfit begins with an idea. Ours began with a simple observation.</p>
          <p>In 2023, we noticed something missing in the market. Many women were buying kurtis with machine-made designs and ordinary prints, but finding something that felt truly special was becoming difficult.</p>
          <p>We believed there was a better way.</p>
          <p>That’s how Ariba began, with a vision to create beautiful kurtis featuring thoughtfully designed patterns, handmade detailing and quality tailoring. Instead of simply selling what was already available, we decided to create our own designs and bring them to life with our own skilled tailors.</p>
          <p>What started as a small initiative has grown into something we’re incredibly proud of. Over the years, we’ve sold thousands of kurtis and earned the trust of customers who appreciate the beauty of thoughtfully made clothing.</p>
          <p>Today, we’re taking the next step by expanding Ariba and bringing our designs to even more women.</p>
          <p className="font-medium text-ink">Our belief remains the same: beautiful clothing shouldn’t just look good. It should make you feel beautiful.</p>
          <p className="font-serif text-2xl italic text-brand">Welcome to Ariba. ❤️</p>
          <ExploreLink to="/shop">Explore the collection</ExploreLink>
        </div>
      </div>
      <div className="mt-20 grid gap-6 sm:grid-cols-3">
        {[['Our own designs', 'Every pattern is designed by us, never picked from what is already in the market.'], ['Handmade detailing', 'Hand-finished details that machine-made prints can’t match.'], ['Quality tailoring', 'Stitched by our own skilled tailors, with care in every seam.']].map(([t, b]) => (
          <div key={t} className="rounded-xl bg-ink p-8 text-white"><h3 className="text-2xl">{t}</h3><p className="mt-2 text-sm text-white/75">{b}</p></div>
        ))}
      </div>
    </div>
  );
}

export function Contact() {
  const toast = useUI((s) => s.toast);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <div className="container-x grid gap-12 py-12 lg:grid-cols-2">
      <div>
        <Heading as="h1" pre="Get in" title="Touch" size="xl" />
        <p className="mt-6 max-w-md text-ink-600">Questions about sizing, an order, or a custom request? We reply within one business day.</p>
        <ul className="mt-8 space-y-4 text-sm">
          <li className="flex gap-3"><Icon name="phone" className="text-brand" /> +91 98765 43210 · Mon–Sat, 10am–7pm</li>
          <li className="flex gap-3"><Icon name="mail" className="text-brand" /> hello@aribacollections.in</li>
          <li className="flex gap-3"><Icon name="pin" className="text-brand" /> Hazratganj, Lucknow, Uttar Pradesh 226001</li>
        </ul>
      </div>
      <div className="rounded-xl bg-white p-8">
        {sent ? (
          <EmptyState icon="check" title="Message sent" body="Thank you — we’ll get back to you shortly." />
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!form.name || !/^\S+@\S+\.\S+$/.test(form.email) || form.message.length < 10) return toast('Please fill all fields (message min 10 characters)', 'error');
              setBusy(true);
              await sendContactMessage(form);
              setBusy(false);
              setSent(true);
            }}
          >
            <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Message"><textarea rows={5} className="input" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
            <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Send message'}</button>
          </form>
        )}
      </div>
    </div>
  );
}

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="container-x max-w-3xl py-12">
      <Heading as="h1" pre="Help &" title="FAQs" size="xl" />
      <ul className="mt-10 divide-y divide-ink/10 border-y border-ink/10">
        {FAQS.map((f, i) => (
          <li key={f.q}>
            <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left" aria-expanded={open === i}>
              <span className="font-display text-lg uppercase text-brand">{f.q}</span>
              <Icon name="plus" className={cx('shrink-0 transition', open === i && 'rotate-45')} />
            </button>
            {open === i && <p className="animate-fade-in pb-5 text-sm leading-relaxed text-ink-600">{f.a}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-ink-600">Still need help? <Link to="/contact" className="link text-brand">Contact us</Link></p>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="container-x py-20 text-center">
      <p className="font-display text-[30vw] font-bold leading-none text-brand sm:text-[200px]">404</p>
      <p className="mt-4 font-serif text-2xl italic">This page has wandered off.</p>
      <Link to="/" className="btn-primary mt-8">Back to home</Link>
    </div>
  );
}
