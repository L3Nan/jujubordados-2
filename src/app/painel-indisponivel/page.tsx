import Link from "next/link";

export default function AdminUnavailablePage() {
  return (
    <main className="admin-unavailable">
      <p className="eyebrow">Área administrativa</p>
      <h1>Estamos preparando o painel.</h1>
      <p>O catálogo público está disponível. A gestão da loja será liberada quando o acesso protegido e a sincronização com o banco estiverem prontos.</p>
      <Link className="button button-dark" href="/">Voltar à vitrine <span aria-hidden="true">↗</span></Link>
    </main>
  );
}
