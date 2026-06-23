import React, { useEffect, useState } from 'react';
import { createMedia } from '@artsy/fresnel'

export const breakpoints = {
  mobile: 0,
  tablet: 768,
  computer: 1024,
}

export const { MediaContextProvider, Media } = createMedia({
  breakpoints
})

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);
    media.addListener(listener);
    return () => media.removeListener(listener);
  }, [query]);

  return matches;
}

export function useIsMobile () {
 return useMediaQuery(`(max-width: ${breakpoints.tablet-1}px)`);
}

