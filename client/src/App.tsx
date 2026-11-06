import { Route, Switch } from "wouter";
import Protected from "./_core/Protected";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Browse from "./pages/Browse";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import PaymentInstructions from "./pages/PaymentInstructions";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Wishlist from "./pages/Wishlist";
import Account from "./pages/Account";
import Notifications from "./pages/Notifications";
import Help from "./pages/Help";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSettings from "./pages/admin/AdminSettings";

/**
 * Route table. The admin tree is mounted under /admin and is never linked from
 * the storefront; access is enforced server-side on every admin procedure, so
 * these routes are only the UI shell.
 */
export default function App() {
  return (
    <Switch>
      {/* Storefront */}
      <Route path="/" component={Home} />
      <Route path="/search">
        {() => <Browse />}
      </Route>
      <Route path="/category/:slug">
        {(params) => <Browse categorySlug={params.slug} />}
      </Route>
      <Route path="/product/:slug">
        {(params) => <ProductDetail slug={params.slug} />}
      </Route>
      <Route path="/cart" component={Cart} />
      <Route path="/wishlist" component={Wishlist} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/help/payments">{() => <Help page="payments" />}</Route>
      <Route path="/help/delivery">{() => <Help page="delivery" />}</Route>
      <Route path="/help/returns">{() => <Help page="returns" />}</Route>
      <Route path="/help/contact">{() => <Help page="contact" />}</Route>

      {/* Auth */}
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />

      {/* Customer account (login required) */}
      <Route path="/checkout">
        <Protected>
          <Checkout />
        </Protected>
      </Route>
      <Route path="/orders">
        <Protected>
          <Orders />
        </Protected>
      </Route>
      <Route path="/orders/:orderId/payment">
        {(params) => (
          <Protected>
            <PaymentInstructions orderId={params.orderId} />
          </Protected>
        )}
      </Route>
      <Route path="/orders/:orderId">
        {(params) => (
          <Protected>
            <OrderDetail orderId={params.orderId} />
          </Protected>
        )}
      </Route>
      <Route path="/account">
        <Protected>
          <Account />
        </Protected>
      </Route>

      {/* Admin (server-authorised; no storefront links point here) */}
      <Route path="/admin" component={AdminOverview} />
      <Route path="/admin/products" component={AdminProducts} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/payments" component={AdminPayments} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/settings" component={AdminSettings} />

      <Route>{() => <NotFound />}</Route>
    </Switch>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-extrabold tracking-tight text-primary">404</p>
      <h1 className="text-lg font-bold">This page doesn't exist</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The link may be broken, or the product may have been removed from the store.
      </p>
      <a
        href="/"
        className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Back to MarketHub
      </a>
    </div>
  );
}
