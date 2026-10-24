export function ResponsiveImage({
  src,
  alt,
  variants,
  blur,
  loading = 'lazy',
  focalX = 50,
  focalY = 50,
  className,
  width = 1600,
  height = 1000,
}: {
  src: string;
  alt: string;
  variants?: { format: string; width: number; url?: string; key?: string }[];
  blur?: string;
  loading?: 'lazy' | 'eager';
  focalX?: number;
  focalY?: number;
  className?: string;
  width?: number;
  height?: number;
}) {
  const list: { format: string; width: number; url?: string; key?: string }[] = variants?.length
    ? variants
    : src.startsWith('/placeholders/')
      ? [480, 960, 1600].flatMap((w) =>
          ['avif', 'webp'].map((format) => ({
            format,
            width: w,
            url: src.replace(/(?:-(?:480|960|1600|2560))?\.webp$/, `-${w}.${format}`),
          })),
        )
      : [];
  const set = (format: string) =>
    list
      .filter((v) => v.format === format)
      .sort((a, b) => a.width - b.width)
      .map((v) => `${v.url || '/' + v.key} ${v.width}w`)
      .join(', ');
  return (
    <picture className={className}>
      {set('avif') && (
        <source
          type="image/avif"
          srcSet={set('avif')}
          sizes="(max-width:760px) 100vw, (max-width:1240px) 88vw, 1240px"
        />
      )}
      <img
        src={src}
        srcSet={set('webp') || undefined}
        sizes="(max-width:760px) 100vw, (max-width:1240px) 88vw, 1240px"
        alt={alt}
        loading={loading}
        fetchPriority={loading === 'eager' ? 'high' : 'auto'}
        width={width}
        height={height}
        style={{
          objectPosition: `${focalX}% ${focalY}%`,
          backgroundImage: blur ? `url(${blur})` : undefined,
          backgroundSize: 'cover',
        }}
      />
    </picture>
  );
}
