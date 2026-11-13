import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartItem, ColorOption, Coupon, Product, Size, User } from '@/types';

const MAX_PER_LINE = 10;

// ---------- Cart ----------
interface CartState {
  items: CartItem[];
  coupon: Coupon | null;
  add: (p: Product, size: Size, color: ColorOption, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setCoupon: (c: Coupon | null) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      coupon: null,
      add: (p, size, color, qty = 1) =>
        set((s) => {
          const key = `${p.id}|${size}|${color.name}`;
          const maxQty = Math.min(p.stock, MAX_PER_LINE);
          const existing = s.items.find((i) => i.key === key);
          if (existing) {
            return { items: s.items.map((i) => (i.key === key ? { ...i, qty: Math.min(i.qty + qty, maxQty) } : i)) };
          }
          const line: CartItem = {
            key, productId: p.id, slug: p.slug, name: p.name, price: p.price, mrp: p.mrp,
            size, color, art: p.art, image: p.images?.[0], maxQty, qty: Math.min(qty, maxQty),
          };
          return { items: [...s.items, line] };
        }),
      setQty: (key, qty) =>
        set((s) => ({ items: s.items.map((i) => (i.key === key ? { ...i, qty: Math.max(1, Math.min(qty, i.maxQty)) } : i)) })),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [], coupon: null }),
      setCoupon: (coupon) => set({ coupon }),
    }),
    { name: 'ariba.cart', storage: createJSONStorage(() => localStorage) },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.qty, 0);
export const cartSubtotal = (items: CartItem[]) => items.reduce((n, i) => n + i.qty * i.price, 0);

// ---------- Wishlist ----------
interface WishlistState {
  ids: string[];
  toggle: (id: string) => boolean;
  remove: (id: string) => void;
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const has = get().ids.includes(id);
        set({ ids: has ? get().ids.filter((x) => x !== id) : [id, ...get().ids] });
        return !has;
      },
      remove: (id) => set((s) => ({ ids: s.ids.filter((x) => x !== id) })),
    }),
    { name: 'ariba.wishlist' },
  ),
);

// ---------- Auth ----------
interface AuthState {
  user: User | null;
  setUser: (u: User | null) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist((set) => ({ user: null, setUser: (user) => set({ user }), logout: () => set({ user: null }) }), { name: 'ariba.auth' }),
);

// ---------- Recently viewed ----------
interface RecentState {
  ids: string[];
  push: (id: string) => void;
}
export const useRecent = create<RecentState>()(
  persist((set) => ({ ids: [], push: (id) => set((s) => ({ ids: [id, ...s.ids.filter((x) => x !== id)].slice(0, 8) })) }), { name: 'ariba.recent' }),
);

// ---------- UI (not persisted) ----------
export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
  action?: { label: string; to: string };
}

interface UIState {
  cartOpen: boolean;
  menuOpen: boolean;
  searchOpen: boolean;
  toasts: Toast[];
  setCartOpen: (v: boolean) => void;
  setMenuOpen: (v: boolean) => void;
  setSearchOpen: (v: boolean) => void;
  toast: (message: string, tone?: Toast['tone'], action?: Toast['action']) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;
export const useUI = create<UIState>()((set, get) => ({
  cartOpen: false,
  menuOpen: false,
  searchOpen: false,
  toasts: [],
  setCartOpen: (cartOpen) => set({ cartOpen }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  toast: (message, tone = 'success', action) => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, message, tone, action }].slice(-3) });
    setTimeout(() => get().dismiss(id), 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
