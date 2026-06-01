import { useEffect, useState } from 'react';

const cache = new Map(); // url -> HTMLImageElement (loaded)

// Load and cache an HTMLImageElement for a given URL. Returns the element once
// ready, or null while loading / if the url is missing.
export function useImageEl(url) {
  const [el, setEl] = useState(() => (url && cache.get(url)) || null);

  useEffect(() => {
    if (!url) { setEl(null); return; }
    const cached = cache.get(url);
    if (cached) { setEl(cached); return; }
    let alive = true;
    const img = new Image();
    img.onload = () => {
      cache.set(url, img);
      if (alive) setEl(img);
    };
    img.src = url;
    return () => { alive = false; };
  }, [url]);

  return el;
}
