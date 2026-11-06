import { Redirect } from "wouter";

/**
 * The scaffold's demo dashboard is retired. MarketHub's authenticated customer
 * surfaces are /account, /orders and /wishlist; the staff console lives at
 * /admin. This route is kept only so old bookmarks land somewhere sensible.
 */
export default function Dashboard() {
  return <Redirect to="/account" />;
}
