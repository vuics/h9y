import React, { useEffect, useState, createContext, useContext } from 'react'

export const IndexContext = createContext({});
export const useIndexContext = () => useContext(IndexContext);

export const usePersistentState = (key, defaultValue) => {
  const [state, setState] = useState(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  const clearState = () => {
    localStorage.removeItem(key);
    setState(defaultValue);
  };

  return [state, setState, clearState];
};

