import { redirect } from "next/navigation";
import AdminPanel from "./panel";

export default function AdminPage() {
  if (process.env.NODE_ENV === "production") redirect("/painel-indisponivel");
  return <AdminPanel />;
}
