import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Spinner } from '@/components/ui';
import Home from '@/pages/Home';
import { About, Contact, Faq, NotFound } from '@/pages/Info';

const Shop = lazy(() => import('@/pages/Shop'));
const Product = lazy(() => import('@/pages/Product'));
const Cart = lazy(() => import('@/pages/Cart'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const OrderConfirmation = lazy(() => import('@/pages/OrderConfirmation'));
const Wishlist = lazy(() => import('@/pages/Wishlist'));
const Account = lazy(() => import('@/pages/Account'));

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
