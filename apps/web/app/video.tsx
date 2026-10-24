import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
export function BackgroundVideo({
  src,
  mobileSrc,
  poster,
  lang,
}: {
  src: string;
  mobileSrc?: string;
  poster: string;
  lang: 'id' | 'en';
}) {
  const video = useRef<HTMLVideoElement>(null),
    [play, setPlay] = useState(false),
    [ready, setReady] = useState(false),
    [mobile, setMobile] = useState(false),
    [reduced, setReduced] = useState(false),
    [saveData, setSaveData] = useState(false),
    [visible, setVisible] = useState(true),
    [pageVisible, setPageVisible] = useState(true),
    manual = useRef(false);
  const active = play && visible && pageVisible && !reduced && !saveData;
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (video.current) observer?.observe(video.current);
    return () => {
      document.removeEventListener('visibilitychange', update);
      observer?.disconnect();
    };
  }, []);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)'),
      connection = (navigator as any).connection,
      viewport = matchMedia('(max-width:760px)');
    const update = () => {
      setReduced(preference.matches);
      setSaveData(!!connection?.saveData);
      setMobile(viewport.matches);
      if (preference.matches || connection?.saveData) {
        setPlay(false);
        video.current?.pause();
      }
    };
    update();
    let timer: number | undefined;
    if (!preference.matches && !connection?.saveData)
      timer = window.setTimeout(() => {
        if (!manual.current && !preference.matches && !connection?.saveData) setPlay(true);
      }, 1800);
    preference.addEventListener('change', update);
    viewport.addEventListener('change', update);
    connection?.addEventListener('change', update);
    return () => {
      clearTimeout(timer);
      preference.removeEventListener('change', update);
      viewport.removeEventListener('change', update);
      connection?.removeEventListener('change', update);
    };
  }, [src]);
  useEffect(() => {
    if (active) video.current?.play().catch(() => setPlay(false));
    else video.current?.pause();
  }, [active]);
  return (
    <>
      <video
        ref={video}
        className={'hero-video ' + (ready ? 'loaded' : '')}
        muted
        playsInline
        loop
        aria-hidden="true"
        preload="none"
        poster={poster}
        src={play ? (mobile && mobileSrc ? mobileSrc : src) : undefined}
        onCanPlay={() => {
          setReady(true);
          if (active) void video.current?.play().catch(() => setPlay(false));
        }}
      />
      {!reduced && !saveData && (
        <button
          type="button"
          className="video-control"
          aria-label={
            play
              ? lang === 'id'
                ? 'Jeda video latar'
                : 'Pause background video'
              : lang === 'id'
                ? 'Putar video latar'
                : 'Play background video'
          }
          onClick={() => {
            manual.current = true;
            setPlay(!play);
          }}
        >
          {play ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
        </button>
      )}
    </>
  );
}
