"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import type { StoreProduct } from "@/data/catalog";
import type { StoreCategory } from "@/data/store-catalog";

type Props = { products: StoreProduct[]; categories: StoreCategory[] };

export default function ShareQr({ products, categories }: Props) {
  const [kind, setKind] = useState<"store" | "product" | "category">("store");
  const [itemId, setItemId] = useState("");
  const [origin, setOrigin] = useState("https://jujubordados-2.leandromlmp.workers.dev");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setOrigin(window.location.origin), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const availableProducts = products.filter((product) => product.isActive !== false && product.stockQuantity !== 0);
  const selectedProduct = availableProducts.find((product) => product.id === itemId) ?? availableProducts[0];
  const selectedCategory = categories.find((category) => category.id === itemId) ?? categories[0];
  const label = kind === "product" ? selectedProduct?.name ?? "Produto" : kind === "category" ? selectedCategory?.name ?? "Categoria" : "Vitrine Jujubordados";
  const url = new URL("/", origin);
  if (kind === "product" && selectedProduct) url.hash = `produto-${selectedProduct.id}`;
  if (kind === "category" && selectedCategory) {
    url.searchParams.set("categoria", selectedCategory.id);
    url.hash = "catalogo";
  }
  const value = url.toString();

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `jujubordados-qr-${kind === "store" ? "vitrine" : itemId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <section className="share-qr-card" aria-labelledby="share-qr-title">
      <div className="share-qr-copy"><p className="eyebrow">LINKS PARA COMPARTILHAR</p><h2 id="share-qr-title">QR Code da sua vitrine</h2><p>Baixe para imprimir em cartões e embalagens ou compartilhe um acesso direto a um produto ou categoria.</p>
        <label>O QR Code abre<select value={kind} onChange={(event) => { setKind(event.target.value as typeof kind); setItemId(""); }}><option value="store">A vitrine completa</option><option value="product">Um produto</option><option value="category">Uma categoria</option></select></label>
        {kind === "product" && (availableProducts.length ? <label>Produto<select value={selectedProduct?.id ?? ""} onChange={(event) => setItemId(event.target.value)}>{availableProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label> : <p className="admin-muted">Não há produtos publicados e disponíveis para compartilhar.</p>)}
        {kind === "category" && <label>Categoria<select value={selectedCategory?.id ?? ""} onChange={(event) => setItemId(event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.parentId ? `↳ ${category.name}` : category.name}</option>)}</select></label>}
        <div className="share-qr-actions"><button className="button button-dark" type="button" onClick={downloadPng}>Baixar PNG</button><button className="button button-light" type="button" onClick={() => window.print()}>Imprimir</button></div>
      </div>
      <div className="share-qr-preview"><QRCodeCanvas ref={canvasRef} value={value} size={224} level="H" marginSize={3} title={`QR Code para ${label}`} /><strong>{label}</strong><small>{value}</small></div>
    </section>
  );
}
