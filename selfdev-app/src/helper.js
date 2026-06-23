import { useEffect, useState } from 'react'

export function getWindowDimensions() {
  const { innerWidth: width, innerHeight: height } = window;
  return {
    width,
    height
  };
}

export function useWindowDimensions() {
  const [windowDimensions, setWindowDimensions] = useState(getWindowDimensions());

  useEffect(() => {
    function handleResize() {
      setWindowDimensions(getWindowDimensions());
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowDimensions;
}

export function sleep (ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

export function hexToRgba({ hexColor = '#ffffff', alpha = 1} = {}) {
  const match = hexColor.replace('#', '').match(/.{1,2}/g);
  if (!match) return hexColor;
  const [r, g, b] = match.map(x => parseInt(x, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
