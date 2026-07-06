import type { CSSProperties } from 'react';
import type { Locale } from '../i18n/types';

type Props = {
  locale: Locale;
  width?: number;
  height?: number;
  style?: CSSProperties;
};

const EN_FLAG_SRC = `${import.meta.env.BASE_URL}flag-en.png`;

const imgStyle = (width: number, height: number, style?: CSSProperties): CSSProperties => ({
  display: 'block',
  width,
  height,
  objectFit: 'cover',
  borderRadius: 3,
  boxShadow: '0 0 0 1px rgba(0,0,0,0.12)',
  ...style,
});

/** Ikona flagi dla wyboru języka. EN: grafika UK+USA z `public/flag-en.png`. */
export default function LanguageFlagIcon({ locale, width = 36, height = 24, style }: Props) {
  const common = {
    width,
    height,
    style: { display: 'block', borderRadius: 3, boxShadow: '0 0 0 1px rgba(0,0,0,0.12)', ...style },
    role: 'img' as const,
  };

  if (locale === 'en') {
    return (
      <img
        src={EN_FLAG_SRC}
        alt=""
        width={width}
        height={height}
        style={imgStyle(width, height, style)}
        aria-hidden
      />
    );
  }

  if (locale === 'pl') {
    return (
      <svg {...common} viewBox="0 0 3 2" aria-hidden>
        <rect width="3" height="1" fill="#fff" />
        <rect y="1" width="3" height="1" fill="#dc143c" />
      </svg>
    );
  }

  if (locale === 'de') {
    return (
      <svg {...common} viewBox="0 0 3 2" aria-hidden>
        <rect width="3" height="0.667" fill="#000" />
        <rect y="0.667" width="3" height="0.667" fill="#dd0000" />
        <rect y="1.333" width="3" height="0.667" fill="#ffce00" />
      </svg>
    );
  }

  return null;
}
