import AdminPanel from "./panel";
import AdminOrders from "./orders";

export default function AdminPage() {
  if (process.env.NODE_ENV === "production") return <AdminOrders />;
  return <AdminPanel />;
}
