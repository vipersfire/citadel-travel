import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import type { Locale } from '@citadel/i18n';

export function MobileActions({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className: string;
  label: string;
}) {
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!bar.current) return;
    const measure = () => {
      const height = bar.current?.getBoundingClientRect().height || 0;
      if (height)
        document.documentElement.style.setProperty('--mobile-actions-height', `${height}px`);
      else document.documentElement.style.removeProperty('--mobile-actions-height');
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar.current);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--mobile-actions-height');
    };
  }, []);
  return (
    <nav ref={bar} className={className} aria-label={label}>
      {children}
    </nav>
  );
}

export function BrandMark({
  to,
  light = false,
  descriptor = 'Sports Travel',
}: {
  to: string;
  light?: boolean;
  descriptor?: string;
}) {
  return (
    <Link className={`brand-lockup${light ? ' light' : ''}`} to={to}>
      <span className="brand-name">Citadel Tour Travel</span>
      <span className="brand-descriptor">{descriptor}</span>
    </Link>
  );
}

export function SiteHeader({ lang, user, contact }: { lang: Locale; user: any; contact: any }) {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const id = lang === 'id';
  const other = id ? 'en' : 'id';
  const account = `/${lang}/${user ? 'account' : 'sign-in'}`;

  useEffect(() => setOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1200px)');
    const resize = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener('change', resize);
    return () => desktop.removeEventListener('change', resize);
  }, []);
  useEffect(() => {
    if (!open) return;
    navigation.current?.querySelector('a')?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);

  return (
    <header className="site-header" ref={header}>
      <div className="container header-inner">
        <BrandMark to={`/${lang}`} />
        <nav
          id="primary-navigation"
          className="main-nav"
          data-open={open}
          ref={navigation}
          onClick={(event) => {
            if ((event.target as Element).closest('a')) setOpen(false);
          }}
          aria-label={id ? 'Navigasi utama' : 'Main navigation'}
        >
          <NavLink to={`/${lang}/sport`}>{id ? 'Olahraga' : 'Sports'}</NavLink>
          <NavLink to={`/${lang}/beyond-the-event`}>Beyond the event</NavLink>
          <NavLink to={`/${lang}/about`}>{id ? 'Tentang' : 'About'}</NavLink>
          <Link className="nav-account" to={account}>
            {id ? 'Akun' : 'Account'} <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <div className="nav-contact">
            <Link to={`/${lang}/contact`}>
              {id ? 'Hubungi Citadel' : 'Contact Citadel'}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            {contact.whatsapp && (
              <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}>
                {contact.whatsapp} · WhatsApp
              </a>
            )}
          </div>
        </nav>
        <div className="header-actions">
          <Link
            className="language"
            to={location.pathname.replace(/^\/(id|en)/, `/${other}`) + location.search}
            aria-label={id ? 'Switch to English' : 'Ganti ke Bahasa Indonesia'}
          >
            <span className={id ? 'active' : ''} lang="id">
              ID
            </span>
            <span aria-hidden="true">/</span>
            <span className={!id ? 'active' : ''} lang="en">
              EN
            </span>
          </Link>
          <Link className="header-account" to={account}>
            {id ? 'Akun' : 'Account'}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="mobile-menu icon-button"
            ref={toggle}
            onClick={() => setOpen((value) => !value)}
            aria-label={
              open
                ? id
                  ? 'Tutup navigasi'
                  : 'Close navigation'
                : id
                  ? 'Buka navigasi'
                  : 'Open navigation'
            }
            aria-expanded={open}
            aria-controls="primary-navigation"
          >
            {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ lang, contact }: { lang: Locale; contact: any }) {
  const id = lang === 'id';
  const other = id ? 'en' : 'id';
  const location = useLocation();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-main">
          <div>
            <BrandMark to={`/${lang}`} light />
            <p className="footer-promise">Be There When It Matters.</p>
          </div>
          <nav className="footer-explore" aria-label={id ? 'Jelajahi Citadel' : 'Explore Citadel'}>
            <Link to={`/${lang}/sport`}>{id ? 'Pengalaman olahraga' : 'Sport experiences'}</Link>
            <Link to={`/${lang}/beyond-the-event`}>Beyond the event</Link>
            <Link to={`/${lang}/how-it-works`}>{id ? 'Cara memesan' : 'How to book'}</Link>
            <Link to={`/${lang}/about`}>{id ? 'Tentang Citadel' : 'About Citadel'}</Link>
          </nav>
          <div className="footer-contact">
            <span>{id ? 'Hubungi Citadel' : 'Contact Citadel'}</span>
            <span className="footer-location">{contact.address || 'Jakarta, Indonesia'}</span>
            {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
            {contact.whatsapp && (
              <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}>
                {contact.whatsapp} · WhatsApp <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            )}
            <Link to={`/${lang}/enquire`}>
              {id ? 'Diskusikan perjalanan' : 'Plan your journey'} ↗
            </Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Citadel Tour Travel</span>
          <nav aria-label={id ? 'Navigasi footer' : 'Footer navigation'}>
            <Link
              to={location.pathname.replace(/^\/(id|en)/, `/${other}`) + location.search}
              lang={other}
            >
              {id ? 'English' : 'Bahasa Indonesia'}
            </Link>
            <Link to={`/${lang}/contact`}>{id ? 'Kontak' : 'Contact'}</Link>
            <Link to={`/${lang}/legal/terms`}>{id ? 'Syarat' : 'Terms'}</Link>
            <Link to={`/${lang}/legal/privacy`}>{id ? 'Privasi' : 'Privacy'}</Link>
            <Link to={`/${lang}/legal/cancellation`}>{id ? 'Pembatalan' : 'Cancellation'}</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
