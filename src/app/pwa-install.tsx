"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function PwaInstall() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [device, setDevice] = useState<{ installed: boolean; ios: boolean } | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
    const timer = window.setTimeout(() => setDevice({ installed: isStandalone, ios: isIos }), 0);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => { setDevice((current) => current ? { ...current, installed: true } : current); setPromptEvent(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setMessage(choice.outcome === "accepted" ? "Instalação iniciada no dispositivo." : "Você pode instalar depois pelo menu do navegador.");
    setPromptEvent(null);
  }

  if (!device || device.installed) return null;
  return (
    <aside className="pwa-install-card" aria-label="Instalar aplicativo">
      <div><strong>Leve a loja com você</strong><p>{device.ios ? "No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início." : promptEvent ? "Instale o painel no celular ou computador para abrir em tela cheia." : "No menu do navegador, escolha Instalar aplicativo ou Adicionar à tela inicial."}</p>{message && <small role="status">{message}</small>}</div>
      {promptEvent && <button className="button button-dark" type="button" onClick={() => void install()}>Instalar app <span aria-hidden="true">↓</span></button>}
    </aside>
  );
}
