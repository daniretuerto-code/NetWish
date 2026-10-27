import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { CustomerShell, BusinessShell } from './components/Shell.jsx';
import { Spinner } from './components/ui.jsx';
import Home from './screens/customer/Home.jsx';
import Explore from './screens/customer/Explore.jsx';
import Business from './screens/customer/Business.jsx';
import Table from './screens/customer/Table.jsx';
import Orders from './screens/customer/Orders.jsx';
import Account from './screens/customer/Account.jsx';
import Chat from './screens/customer/Chat.jsx';
import BookingResponse from './screens/customer/BookingResponse.jsx';
import Opinion from './screens/customer/Opinion.jsx';
import Unsubscribe from './screens/customer/Unsubscribe.jsx';
import ComingSoon from './screens/customer/ComingSoon.jsx';
import { kindOf } from './lib/categories.js';
import { showComingSoon } from './lib/launch.js';

const Scan = lazy(() => import('./screens/customer/Scan.jsx'));
const BizOverview = lazy(() => import('./screens/business/Overview.jsx'));
const BizOrders = lazy(() => import('./screens/business/Orders.jsx'));
const BizReservations = lazy(() => import('./screens/business/Reservations.jsx'));
const BizKitchen = lazy(() => import('./screens/business/Kitchen.jsx'));
const BizCatalog = lazy(() => import('./screens/business/Catalog.jsx'));
const BizTables = lazy(() => import('./screens/business/Tables.jsx'));
const BizMessages = lazy(() => import('./screens/business/Messages.jsx'));
const BizSettings = lazy(() => import('./screens/business/Settings.jsx'));
const BizHours = lazy(() => import('./screens/business/Hours.jsx'));
const BizCampaigns = lazy(() => import('./screens/business/Campaigns.jsx'));
const BizEvents = lazy(() => import('./screens/business/Events.jsx'));
const BizPortal = lazy(() => import('./screens/business/Portal.jsx'));
const Admin = lazy(() => import('./screens/business/Admin.jsx'));
const BizOnboarding = lazy(() => import('./screens/business/Setup.jsx').then((m) => ({ default: m.Onboarding })));
const BizClients = lazy(() => import('./screens/business/Clients.jsx'));
const BizNumbers = lazy(() => import('./screens/business/Clients.jsx').then((m) => ({ default: m.Numbers })));
const BizShare = lazy(() => import('./screens/business/Share.jsx'));
const BizPickups = lazy(() => import('./screens/business/PickupOrders.jsx'));
const BizShopCatalog = lazy(() => import('./screens/business/ShopCatalog.jsx'));
const BizStock = lazy(() => import('./screens/business/Stock.jsx'));
const BizClasses = lazy(() => import('./screens/business/ClassesAdmin.jsx'));
const BizSection = lazy(() => import('./screens/business/Setup.jsx').then((m) => ({ default: m.SectionWizard })));

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
  if (!business) return <Navigate to="/negocios" replace />;
  return children;
}

// Restaurants get the agenda, hall and customers; shops their pickup orders; others the simple list.
function BizBookings() {
  const { business } = useAuth();
  const kind = kindOf(business);
  if (kind === 'restaurant') return <BizReservations />;
  if (kind === 'shop') return <BizPickups />;
  return <BizOrders />;
}

// Shops manage products with photos and stock; everyone else the menu or list of services.
function BizProducts() {
  const { business } = useAuth();
  return kindOf(business) === 'shop' ? <BizShopCatalog /> : <BizCatalog />;
}

// QR table orders, on their own page inside the service section.
function BizComandas() {
  return <BizOrders comandasOnly page />;
}

// Old links (e-mails, bookmarks) to /panel/pedidos keep working, with their ?ver=.
function LegacyPanelLink({ to }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

// netwish.es/r/casa-lucio: the short booking link restaurants paste on Google and Instagram.
function ShortLink() {
  const { slug } = useParams();
  const { search } = useLocation();
  // Keeps ?embed=1 from the "Reservar" button restaurants put on their own website.
  const extra = new URLSearchParams(search);
  extra.set('reservar', '1');
  return <Navigate to={`/negocio/${encodeURIComponent(slug)}?${extra}`} replace />;
}

// Old payment QR codes and links now land on the business page.
function OldPayLink() {
  const { name } = useParams();
  return <Navigate to={`/negocio/${encodeURIComponent(name)}`} replace />;
}

export default function App() {
  const { ready } = useAuth();
  const { search } = useLocation();

  if (showComingSoon(search)) return <ComingSoon />;
  if (!ready) return <Spinner />;

  return (
    <Suspense fallback={<Spinner />}>
      <LegacyLinks />
      <Routes>
        <Route element={<CustomerShell />}>
          <Route index element={<Home />} />
          <Route path="explorar" element={<Explore />} />
          <Route path="reservas" element={<Orders />} />
          <Route path="pedidos" element={<Navigate to="/reservas" replace />} />
          <Route path="cuenta" element={<Account />} />
          <Route path="escanear" element={<Scan />} />
          <Route path="negocio/:name" element={<Business />} />
          <Route path="negocio/:name/pedido" element={<OldPayLink />} />
          <Route path="pagar/:name" element={<OldPayLink />} />
          <Route path="mesa/:name/:table" element={<Table />} />
          <Route path="chat/:name" element={<Chat />} />
          <Route path="reserva/:token" element={<BookingResponse />} />
          <Route path="r/:slug" element={<ShortLink />} />
          <Route path="opinion/:token" element={<Opinion />} />
          <Route path="baja" element={<Unsubscribe />} />
        </Route>
        <Route path="negocios" element={<BizPortal />} />
        <Route path="admin" element={<Admin />} />
        <Route path="panel" element={<RequireBusiness><BusinessShell /></RequireBusiness>}>
          <Route index element={<BizOverview />} />
          <Route path="reservas" element={<BizBookings />} />
          <Route path="pedidos" element={<LegacyPanelLink to="/panel/reservas" />} />
          <Route path="comandas" element={<BizComandas />} />
          <Route path="clientes" element={<BizClients />} />
          <Route path="numeros" element={<BizNumbers />} />
          <Route path="compartir" element={<BizShare />} />
          <Route path="cocina" element={<BizKitchen />} />
          <Route path="carta" element={<BizProducts />} />
          <Route path="stock" element={<BizStock />} />
          <Route path="clases" element={<BizClasses />} />
          <Route path="mesas" element={<BizTables />} />
          <Route path="mensajes" element={<BizMessages />} />
          <Route path="ajustes" element={<BizSettings />} />
          <Route path="horario" element={<BizHours />} />
          <Route path="campanas" element={<BizCampaigns />} />
          <Route path="eventos" element={<BizEvents />} />
          <Route path="empezar" element={<BizOnboarding />} />
          <Route path="personalizar" element={<Navigate to="/panel/ajustes" replace />} />
          <Route path="personalizar/:key" element={<BizSection />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
