import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Spinner } from '@/components/ui';
import Home from '@/pages/Home';
import { About, Contact, Faq, NotFound } from '@/pages/Info';
import { LIVE } from '@/services/backend';

const Shop = lazy(() => import('@/pages/Shop'));
const Product = lazy(() => import('@/pages/Product'));
const Cart = lazy(() => import('@/pages/Cart'));
// With a backend (VITE_API_URL), checkout/account/orders use the live versions.
const Checkout = lazy(() => (LIVE ? import('@/pages/live/LiveCheckout') : import('@/pages/Checkout')));
const OrderConfirmation = lazy(() => (LIVE ? import('@/pages/live/LiveOrder') : import('@/pages/OrderConfirmation')));
const Admin = lazy(() => import('@/pages/admin/Admin'));
const Wishlist = lazy(() => import('@/pages/Wishlist'));
const Account = lazy(() => (LIVE ? import('@/pages/live/LiveAccount') : import('@/pages/Account')));

const wrap = (el: JSX.Element) => <Suspense fallback={<div className="grid min-h-[50vh] place-items-center text-brand"><Spinner className="h-8 w-8" /></div>}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/shop', element: wrap(<Shop />) },
      { path: '/collections/:category', element: wrap(<Shop />) },
      { path: '/product/:slug', element: wrap(<Product />) },
      { path: '/cart', element: wrap(<Cart />) },
      { path: '/checkout', element: wrap(<Checkout />) },
      { path: '/order/:id', element: wrap(<OrderConfirmation />) },
      { path: '/wishlist', element: wrap(<Wishlist />) },
      { path: '/account', element: wrap(<Account />) },
      { path: '/admin/*', element: wrap(<Admin />) },
      { path: '/about', element: <About /> },
      { path: '/contact', element: <Contact /> },
      { path: '/faq', element: <Faq /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
