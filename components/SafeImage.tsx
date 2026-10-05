'use client';

import React, { useState } from 'react';
import Image, { ImageProps } from 'next/image';
import { isValidUrl } from '@/lib/utils';
import { BookOpen } from 'lucide-react';

interface SafeImageProps extends Omit<ImageProps, 'src'> {
  src: string | null | undefined;
  fallbackSrc?: string;
  fallback?: React.ReactNode;
}

export default function SafeImage({ src, fallbackSrc, alt, fallback, className, ...props }: SafeImageProps) {
  const [error, setError] = useState(false);
  const [triedFallbackSrc, setTriedFallbackSrc] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  // Reset error state when src changes (performed during render as recommended by React docs)
  if (src !== prevSrc) {
    setPrevSrc(src);
    setError(false);
    setTriedFallbackSrc(false);
  }
  
  const currentSrc = (error && fallbackSrc && !triedFallbackSrc) ? fallbackSrc : src;
  const isValid = currentSrc ? isValidUrl(currentSrc) : false;

  if (!currentSrc || !isValid || (error && (!fallbackSrc || triedFallbackSrc))) {
    return (
      <div className={className + " flex items-center justify-center bg-gray-50 text-gray-300"}>
        {fallback || <BookOpen className="w-1/2 h-1/2" />}
      </div>
    );
  }

  // Handle Google Drive links specifically
  let displaySrc = currentSrc;
  if (typeof currentSrc === 'string' && currentSrc.includes('drive.google.com') && currentSrc.includes('/file/d/')) {
    const parts = currentSrc.split('/file/d/');
    const id = parts[1] ? parts[1].split('/')[0] : null;
    if (id) {
      displaySrc = `https://drive.google.com/uc?id=${id}`;
    }
  }

  const handleError = () => {
    if (fallbackSrc && !triedFallbackSrc && currentSrc !== fallbackSrc) {
      setTriedFallbackSrc(true);
    } else {
      setError(true);
    }
  };

  return (
    <Image
      {...props}
      src={displaySrc}
      alt={alt}
      className={className}
      onError={handleError}
      referrerPolicy="no-referrer"
      unoptimized={true}
    />
  );
}
