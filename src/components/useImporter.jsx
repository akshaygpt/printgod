import React, { createContext, useContext, useState, useCallback } from 'react';
import { useStore } from '../state/store.jsx';
import { importFiles } from '../lib/imageImport.js';

const ImporterContext = createContext(null);

export function ImporterProvider({ children }) {
  const { dispatch } = useStore();
  const [progress, setProgress] = useState(null); // {done, total} | null
  const [errors, setErrors] = useState([]);

  const run = useCallback(
    async (fileList) => {
      if (!fileList || !fileList.length) return;
      setErrors([]);
      setProgress({ done: 0, total: fileList.length });
      const errs = [];
      const records = await importFiles(fileList, {
        onProgress: (done, total) => setProgress({ done, total }),
        onError: (name, err) => errs.push(`${name}: ${err.message || err}`),
      });
      if (records.length) dispatch({ type: 'IMPORT_IMAGES', images: records });
      setErrors(errs);
      setProgress(null);
    },
    [dispatch]
  );

  return <ImporterContext.Provider value={{ run, progress, errors }}>{children}</ImporterContext.Provider>;
}

export function useImporter() {
  const ctx = useContext(ImporterContext);
  if (!ctx) throw new Error('useImporter must be used within ImporterProvider');
  return ctx;
}
