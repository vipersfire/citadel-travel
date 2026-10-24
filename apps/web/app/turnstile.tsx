import { useEffect, useRef } from 'react';
export default function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey?: string;
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey) return;
    let widget: string | undefined;
    const render = () => {
      if (ref.current && (window as any).turnstile)
        widget = (window as any).turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: onToken,
          'expired-callback': () => onToken(''),
        });
    };
    const existing = document.querySelector('script[data-turnstile]');
    if ((window as any).turnstile) render();
    else if (existing) existing.addEventListener('load', render, { once: true });
    else {
      const s = document.createElement('script');
      s.dataset.turnstile = 'true';
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = render;
      document.head.appendChild(s);
    }
    return () => {
      if (widget) (window as any).turnstile?.remove(widget);
    };
  }, [siteKey]);
  return siteKey ? <div ref={ref} /> : null;
}
