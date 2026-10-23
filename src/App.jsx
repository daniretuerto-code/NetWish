import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { CustomerShell, BusinessShell } from './components/Shell.jsx';
import { Spinner } from './components/ui.jsx';
import Home from './screens/customer/Home.jsx';
import Explore from './screens/customer/Explore.jsx';
import Business from './screens/customer/Business.jsx';
import Checkout from './screens/customer/Checkout.jsx';
import Pay from './screens/customer/Pay.jsx';
import Table from './screens/customer/Table.jsx';
import Orders from './screens/customer/Orders.jsx';
import Account from './screens/customer/Account.jsx';
import Chat from './screens/customer/Chat.jsx';

const Scan = lazy(() => import('./screens/customer/Scan.jsx'));
const BizOverview = lazy(() => import('./screens/business/Overview.jsx'));
const BizOrders = lazy(() => import('./screens/business/Orders.jsx'));
const BizKitchen = lazy(() => import('./screens/business/Kitchen.jsx'));
const BizCatalog = lazy(() => import('./screens/business/Catalog.jsx'));
const BizTables = lazy(() => import('./screens/business/Tables.jsx'));
const BizMessages = lazy(() => import('./screens/business/Messages.jsx'));
const BizSettings = lazy(() => import('./screens/business/Settings.jsx'));

// Printed QR codes point to /?biz=NAME&table=N, so keep that entry point working.
function LegacyLinks() {
  const { search } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const biz = params.get('biz');
    const table = params.get('table');
    if (biz && table) navigate(`/mesa/${encodeURIComponent(biz)}/${parseInt(table, 10) || 1}`, { replace: true });
    else if (biz) navigate(`/negocio/${encodeURIComponent(biz)}`, { replace: true });
  }, [search, navigate]);
  return null;
}

function RequireBusiness({ children }) {
  const { ready, business } = useAuth();
  if (!ready) return <Spinner />;
  if (!business) return <Navigate to="/cuenta" replace />;
  return children;
}

export default function App() {
  const { ready, mode } = useAuth();
  const location = useLocation();

  if (!ready) return <Spinner />;

  if (mode === 'business' && location.pathname === '/') return <Navigate to="/panel" replace />;

  return (
    <Suspense fallback={<Spinner />}>
      <LegacyLinks />
      <Routes>
        <Route element={<CustomerShell />}>
          <Route index element={<Home />} />
          <Route path="explorar" element={<Explore />} />
          <Route path="pedidos" element={<Orders />} />
          <Route path="cuenta" element={<Account />} />
          <Route path="escanear" element={<Scan />} />
          <Route path="negocio/:name" element={<Business />} />
          <Route path="negocio/:name/pedido" element={<Checkout />} />
          <Route path="pagar/:name" element={<Pay />} />
          <Route path="mesa/:name/:table" element={<Table />} />
          <Route path="chat/:name" element={<Chat />} />
        </Route>
        <Route path="panel" element={<RequireBusiness><BusinessShell /></RequireBusiness>}>
          <Route index element={<BizOverview />} />
          <Route path="pedidos" element={<BizOrders />} />
          <Route path="cocina" element={<BizKitchen />} />
          <Route path="carta" element={<BizCatalog />} />
          <Route path="mesas" element={<BizTables />} />
          <Route path="mensajes" element={<BizMessages />} />
          <Route path="ajustes" element={<BizSettings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
