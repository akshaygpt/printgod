import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { DEFAULT_FILTERS, TEMPLATES, makeSlot } from './constants.js';
import { loadState, saveState } from '../lib/storage.js';
import * as imageStore from '../lib/imageStore.js';

const StoreContext = createContext(null);

// Actions that mutate the document and therefore push onto the undo stack.
const UNDOABLE = new Set([
  'UPDATE_FILTER',
  'TOGGLE_FILTER',
  'RESET_FILTERS',
  'SET_CROP',
  'SET_SETTINGS',
  'ADD_PAGE',
  'SET_PAGE_TEMPLATE',
  'REMOVE_PAGE',
  'REORDER_PAGES',
  'ASSIGN_SLOT',
  'MOVE_SLOT',
  'SET_SLOT_FIT',
  'SET_SLOT_CAPTION',
  'AUTO_FILL',
  'AUTO_LAYOUT',
  'REMOVE_IMAGES',
]);

// Classify an image's orientation from its aspect ratio.
function orientationOf(img) {
  const r = img.w / img.h;
  if (r > 1.15) return 'land';
  if (r < 0.87) return 'port';
  return 'sq';
}

// Build a fresh set of pages that fits the given images without cropping
// (every slot uses 'fit'). Cross-orientation photos are paired onto one sheet
// to minimize wasted space; everything else gets a full-bleed page of its own.
function autoLayoutPages(state, ids) {
  const items = ids.filter((id) => state.images[id] && !state.images[id].needsReimport);
  if (!items.length) return [newPage('full-bleed')];
  const landscapePage = state.settings.orientation === 'landscape';

  const mk = (template, slotIds) => {
    const pg = newPage(template);
    pg.slots = pg.slots.map((s, i) => ({ ...s, imageId: slotIds[i] != null ? slotIds[i] : null, fit: 'fit' }));
    return pg;
  };

  const pages = [];
  let i = 0;
  while (i < items.length) {
    const a = items[i];
    const clsA = orientationOf(state.images[a]);
    const b = items[i + 1];
    const clsB = b ? orientationOf(state.images[b]) : null;

    if (!landscapePage) {
      // Portrait sheet: two landscapes stack vertically and fill it well.
      if (clsA === 'land' && clsB === 'land') { pages.push(mk('2up-v', [a, b])); i += 2; continue; }
    } else {
      // Landscape sheet: two portraits sit side by side and fill it well.
      if (clsA === 'port' && clsB === 'port') { pages.push(mk('2up-h', [a, b])); i += 2; continue; }
    }
    // Otherwise the photo already matches the sheet — give it the whole page.
    pages.push(mk('full-bleed', [a]));
    i += 1;
  }
  return pages;
}

function snapshot(s) {
  return { images: s.images, imageOrder: s.imageOrder, pages: s.pages, settings: s.settings };
}

function emptyDoc() {
  return {
    images: {},
    imageOrder: [],
    pages: [newPage('full-bleed')],
    settings: {
      paperSize: 'A4',
      orientation: 'portrait',
      margin: 3,
      printCompensation: 0.12,
    },
  };
}

let pageCounter = 0;
export function newPage(templateKey) {
  const tpl = TEMPLATES[templateKey];
  return {
    id: `page_${Date.now()}_${pageCounter++}`,
    template: templateKey,
    slots: tpl.slots.map((def) => makeSlot(def)),
  };
}

function initState() {
  const persisted = loadState();
  const base = {
    ...emptyDoc(),
    selectedIds: [],
    soloId: null,
    lastSelected: null,
    history: { past: [], future: [] },
    saveStatus: 'idle', // 'idle' | 'saving' | 'saved'
    savedAt: 0,
    hydrating: false, // true while pixels are being restored from IndexedDB
  };
  if (persisted) {
    const imageOrder = persisted.imageOrder || [];
    return {
      ...base,
      images: persisted.images || {},
      imageOrder,
      pages: persisted.pages && persisted.pages.length ? persisted.pages : base.pages,
      settings: { ...base.settings, ...(persisted.settings || {}) },
      hydrating: imageOrder.length > 0, // metadata exists; pixels load async
    };
  }
  return base;
}

function docReducer(state, action) {
  switch (action.type) {
    case 'IMPORT_IMAGES': {
      // payload.images: array of fully-built image records.
      // Re-link to persisted metadata when an identical filename+size returns.
      const images = { ...state.images };
      const order = [...state.imageOrder];
      for (const img of action.images) {
        const existing = order
          .map((id) => state.images[id])
          .find((e) => e && e.needsReimport && e.name === img.name && e.origSize === img.origSize);
        if (existing) {
          images[existing.id] = {
            ...existing,
            ...img,
            id: existing.id,
            filters: existing.filters,
            crop: existing.crop,
            needsReimport: false,
          };
        } else {
          images[img.id] = img;
          order.push(img.id);
        }
      }
      return { ...state, images, imageOrder: order };
    }

    case 'REMOVE_IMAGES': {
      const remove = new Set(action.ids);
      const images = { ...state.images };
      action.ids.forEach((id) => delete images[id]);
      const imageOrder = state.imageOrder.filter((id) => !remove.has(id));
      // Unassign from any slot.
      const pages = state.pages.map((pg) => ({
        ...pg,
        slots: pg.slots.map((s) => (remove.has(s.imageId) ? { ...s, imageId: null } : s)),
      }));
      return {
        ...state,
        images,
        imageOrder,
        pages,
        selectedIds: state.selectedIds.filter((id) => !remove.has(id)),
        soloId: remove.has(state.soloId) ? null : state.soloId,
      };
    }

    case 'SELECT': {
      const { id, mode } = action;
      if (mode === 'toggle') {
        const set = new Set(state.selectedIds);
        set.has(id) ? set.delete(id) : set.add(id);
        return { ...state, selectedIds: [...set], lastSelected: id };
      }
      if (mode === 'range' && state.lastSelected) {
        const a = state.imageOrder.indexOf(state.lastSelected);
        const b = state.imageOrder.indexOf(id);
        if (a === -1 || b === -1) return { ...state, selectedIds: [id], lastSelected: id };
        const [lo, hi] = a < b ? [a, b] : [b, a];
        return { ...state, selectedIds: state.imageOrder.slice(lo, hi + 1) };
      }
      return { ...state, selectedIds: [id], lastSelected: id };
    }

    case 'SELECT_ALL':
      return { ...state, selectedIds: [...state.imageOrder] };

    case 'CLEAR_SELECTION':
      return { ...state, selectedIds: [], lastSelected: null };

    case 'SET_SOLO':
      return { ...state, soloId: action.id };

    case 'UPDATE_FILTER':
    case 'TOGGLE_FILTER':
    case 'RESET_FILTERS': {
      const targets = action.targets; // array of image ids
      if (!targets || !targets.length) return state;
      const images = { ...state.images };
      for (const id of targets) {
        const img = images[id];
        if (!img) continue;
        let filters = img.filters;
        if (action.type === 'UPDATE_FILTER') filters = { ...filters, [action.key]: action.value };
        else if (action.type === 'TOGGLE_FILTER') filters = { ...filters, [action.key]: !filters[action.key] };
        else filters = { ...DEFAULT_FILTERS };
        images[id] = { ...img, filters };
      }
      return { ...state, images };
    }

    case 'SET_CROP': {
      const img = state.images[action.id];
      if (!img) return state;
      return { ...state, images: { ...state.images, [action.id]: { ...img, crop: action.crop } } };
    }

    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };

    case 'ADD_PAGE':
      return { ...state, pages: [...state.pages, newPage(action.template || 'full-bleed')] };

    case 'SET_PAGE_TEMPLATE': {
      const pages = state.pages.map((pg) => {
        if (pg.id !== action.pageId) return pg;
        const tpl = TEMPLATES[action.template];
        const slots = tpl.slots.map((def, i) => {
          const old = pg.slots[i];
          return {
            ...makeSlot(def),
            imageId: old ? old.imageId : null,
            fit: old ? old.fit : 'fill',
            caption: def.caption ? (old && old.caption) || '' : null,
          };
        });
        return { ...pg, template: action.template, slots };
      });
      return { ...state, pages };
    }

    case 'REMOVE_PAGE': {
      const pages = state.pages.filter((p) => p.id !== action.pageId);
      return { ...state, pages: pages.length ? pages : [newPage('full-bleed')] };
    }

    case 'REORDER_PAGES': {
      const pages = [...state.pages];
      const [moved] = pages.splice(action.from, 1);
      pages.splice(action.to, 0, moved);
      return { ...state, pages };
    }

    case 'ASSIGN_SLOT': {
      const pages = state.pages.map((pg) =>
        pg.id !== action.pageId
          ? pg
          : {
              ...pg,
              slots: pg.slots.map((s, i) => (i === action.slotIndex ? { ...s, imageId: action.imageId } : s)),
            }
      );
      return { ...state, pages };
    }

    case 'MOVE_SLOT': {
      // Swap (or move) image between two slots, possibly across pages.
      const { from, to } = action; // {pageId, slotIndex}
      const get = (pid, idx) => {
        const pg = state.pages.find((p) => p.id === pid);
        return pg ? pg.slots[idx] : null;
      };
      const fromSlot = get(from.pageId, from.slotIndex);
      const toSlot = get(to.pageId, to.slotIndex);
      if (!fromSlot || !toSlot) return state;
      const fromImg = fromSlot.imageId;
      const toImg = toSlot.imageId;
      const pages = state.pages.map((pg) => {
        if (pg.id !== from.pageId && pg.id !== to.pageId) return pg;
        const slots = pg.slots.map((s, i) => {
          if (pg.id === from.pageId && i === from.slotIndex) return { ...s, imageId: toImg };
          if (pg.id === to.pageId && i === to.slotIndex) return { ...s, imageId: fromImg };
          return s;
        });
        return { ...pg, slots };
      });
      return { ...state, pages };
    }

    case 'SET_SLOT_FIT': {
      const pages = state.pages.map((pg) =>
        pg.id !== action.pageId
          ? pg
          : { ...pg, slots: pg.slots.map((s, i) => (i === action.slotIndex ? { ...s, fit: action.fit } : s)) }
      );
      return { ...state, pages };
    }

    case 'SET_SLOT_CAPTION': {
      const pages = state.pages.map((pg) =>
        pg.id !== action.pageId
          ? pg
          : { ...pg, slots: pg.slots.map((s, i) => (i === action.slotIndex ? { ...s, caption: action.text } : s)) }
      );
      return { ...state, pages };
    }

    case 'AUTO_FILL': {
      // Distribute the given image ids into empty slots across existing pages,
      // adding pages with the current default template as needed.
      const ids = action.ids.filter((id) => state.images[id]);
      if (!ids.length) return state;
      let pages = state.pages.map((pg) => ({ ...pg, slots: pg.slots.map((s) => ({ ...s })) }));
      let queue = [...ids];
      for (const pg of pages) {
        for (const s of pg.slots) {
          if (!queue.length) break;
          if (!s.imageId) s.imageId = queue.shift();
        }
      }
      while (queue.length) {
        const pg = newPage(action.template || 'full-bleed');
        for (const s of pg.slots) {
          if (!queue.length) break;
          s.imageId = queue.shift();
        }
        pages.push(pg);
      }
      return { ...state, pages };
    }

    case 'HYDRATE_PIXELS': {
      // Merge pixel data restored from IndexedDB into the metadata loaded from
      // localStorage. Images with no restorable pixels are dropped, and their
      // slots cleared, so no broken "re-import" placeholders linger.
      const pixels = action.pixels || {};
      const images = {};
      const keep = [];
      for (const id of state.imageOrder) {
        const meta = state.images[id];
        const px = pixels[id];
        if (meta && px) {
          images[id] = { ...meta, ...px, id, needsReimport: false };
          keep.push(id);
        }
      }
      // Pixel records present in IndexedDB but missing from metadata (e.g. the
      // localStorage doc was cleared) are restored as fresh images.
      for (const id of Object.keys(pixels)) {
        if (images[id]) continue;
        const px = pixels[id];
        images[id] = {
          id,
          name: px.name || 'photo',
          origSize: px.origSize || 0,
          w: px.w,
          h: px.h,
          thumbUrl: px.thumbUrl,
          fullResUrl: px.fullResUrl,
          fullBlob: px.fullBlob,
          filters: { ...DEFAULT_FILTERS },
          crop: null,
          needsReimport: false,
        };
        keep.push(id);
      }
      const removed = new Set(state.imageOrder.filter((id) => !images[id]));
      const pages = removed.size
        ? state.pages.map((pg) => ({
            ...pg,
            slots: pg.slots.map((s) => (removed.has(s.imageId) ? { ...s, imageId: null } : s)),
          }))
        : state.pages;
      return {
        ...state,
        images,
        imageOrder: keep,
        pages,
        hydrating: false,
        selectedIds: state.selectedIds.filter((id) => images[id]),
        soloId: state.soloId && images[state.soloId] ? state.soloId : null,
      };
    }

    case 'MARK_SAVING':
      return { ...state, saveStatus: 'saving' };

    case 'MARK_SAVED':
      return { ...state, saveStatus: 'saved', savedAt: action.at };

    case 'AUTO_LAYOUT':
      return { ...state, pages: autoLayoutPages(state, action.ids) };

    case 'LOAD_DOC':
      return { ...state, ...action.doc };

    case 'RESET':
      return { ...emptyDoc(), selectedIds: [], soloId: null, lastSelected: null, history: { past: [], future: [] } };

    default:
      return state;
  }
}

function rootReducer(state, action) {
  if (action.type === 'UNDO') {
    const past = state.history.past;
    if (!past.length) return state;
    const prev = past[past.length - 1];
    return {
      ...state,
      ...prev,
      history: { past: past.slice(0, -1), future: [snapshot(state), ...state.history.future].slice(0, 50) },
    };
  }
  if (action.type === 'REDO') {
    const future = state.history.future;
    if (!future.length) return state;
    const next = future[0];
    return {
      ...state,
      ...next,
      history: { past: [...state.history.past, snapshot(state)].slice(-50), future: future.slice(1) },
    };
  }
  const next = docReducer(state, action);
  if (next === state) return state;
  if (UNDOABLE.has(action.type)) {
    return {
      ...next,
      history: { past: [...state.history.past, snapshot(state)].slice(-50), future: [] },
    };
  }
  return next;
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(rootReducer, undefined, initState);
  const saveTimer = useRef(null);
  const firstRun = useRef(true);
  const skipSave = useRef(false);
  const persisted = useRef(new Set()); // image ids whose pixels are in IndexedDB

  // On mount, restore image pixels from IndexedDB and merge them into the
  // metadata loaded from localStorage.
  useEffect(() => {
    let alive = true;
    (async () => {
      const recs = await imageStore.getAllImages();
      if (!alive) return;
      persisted.current = new Set(recs.map((r) => r.id));
      const pixels = {};
      for (const r of recs) {
        if (!r.fullBlob) continue;
        pixels[r.id] = {
          fullResUrl: URL.createObjectURL(r.fullBlob),
          thumbUrl: r.thumbUrl,
          fullBlob: r.fullBlob,
          w: r.w,
          h: r.h,
          name: r.name,
          origSize: r.origSize,
        };
      }
      skipSave.current = true; // hydration shouldn't trigger a save/toast
      dispatch({ type: 'HYDRATE_PIXELS', pixels });
    })();
    return () => { alive = false; };
  }, []);

  // Debounced persistence of document metadata (no pixel data). Surfaces a
  // 'saving' → 'saved' status that the UI uses for its indicator + toast.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return; // nothing has changed yet on initial mount
    }
    if (skipSave.current) {
      skipSave.current = false;
      return; // hydration pass — already in sync with storage
    }
    dispatch({ type: 'MARK_SAVING' });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveState({
        images: state.images,
        imageOrder: state.imageOrder,
        pages: state.pages,
        settings: state.settings,
      });
      dispatch({ type: 'MARK_SAVED', at: Date.now() });
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [state.images, state.imageOrder, state.pages, state.settings]);

  // Persist newly imported pixels to IndexedDB and prune removed ones.
  useEffect(() => {
    if (state.hydrating) return;
    for (const id of state.imageOrder) {
      const img = state.images[id];
      if (img && img.fullBlob && !persisted.current.has(id)) {
        persisted.current.add(id);
        imageStore.putImage({
          id,
          name: img.name,
          origSize: img.origSize,
          w: img.w,
          h: img.h,
          fullBlob: img.fullBlob,
          thumbUrl: img.thumbUrl,
        });
      }
    }
    for (const id of [...persisted.current]) {
      if (!state.images[id]) {
        persisted.current.delete(id);
        imageStore.deleteImages([id]);
      }
    }
  }, [state.images, state.imageOrder, state.hydrating]);

  // Keyboard: undo / redo.
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'REDO' : 'UNDO' });
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        dispatch({ type: 'SELECT_ALL' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Photos and edits are persisted (IndexedDB + localStorage), so only warn if
  // a save is still in flight when the user tries to leave.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (state.saveStatus !== 'saving') return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state.saveStatus]);

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
