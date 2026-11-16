"use client";

import type { LocalCalendarEvent } from "@/data/store-operations";

type Suggestion = { title: string; date: string };
type Props = { today: string; events: LocalCalendarEvent[]; onAdd: (suggestion: Suggestion) => void };

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, amount: number) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + amount);
  return dateString(result);
}

function nthWeekday(year: number, month: number, weekday: number, occurrence: number) {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = 1 + (weekday - firstWeekday + 7) % 7 + (occurrence - 1) * 7;
  return dateString(new Date(Date.UTC(year, month - 1, day)));
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dateString(new Date(Date.UTC(year, month - 1, day)));
}

function seasonalDates(year: number): Suggestion[] {
  const easter = easterSunday(year);
  const thanksgiving = nthWeekday(year, 11, 4, 4);
  return [
    { title: `Carnaval (terça-feira) · ${year}`, date: addDays(easter, -47) },
    { title: `Dia do Consumidor · ${year}`, date: `${year}-03-15` },
    { title: `Páscoa · ${year}`, date: easter },
    { title: `Dia das Mães · ${year}`, date: nthWeekday(year, 5, 0, 2) },
    { title: `Dia dos Namorados · ${year}`, date: `${year}-06-12` },
    { title: `São João · ${year}`, date: `${year}-06-24` },
    { title: `Dia Mundial do Bordado · ${year}`, date: `${year}-07-30` },
    { title: `Dia dos Pais · ${year}`, date: nthWeekday(year, 8, 0, 2) },
    { title: `Dia do Cliente · ${year}`, date: `${year}-09-15` },
    { title: `Dia das Crianças · ${year}`, date: `${year}-10-12` },
    { title: `Black Friday · ${year}`, date: addDays(thanksgiving, 1) },
    { title: `Natal · ${year}`, date: `${year}-12-25` },
  ];
}

export default function CalendarSuggestions({ today, events, onAdd }: Props) {
  if (!today) return null;
  const year = Number(today.slice(0, 4));
  const cutoff = addDays(today, 365);
  const suggestions = [
    ...seasonalDates(year),
    ...seasonalDates(year + 1),
  ].filter((suggestion) => suggestion.date >= today && suggestion.date <= cutoff);

  return (
    <section className="seasonal-suggestions" aria-labelledby="seasonal-suggestions-title">
      <div className="seasonal-suggestions-heading"><div><h3 id="seasonal-suggestions-title">Sugestões sazonais</h3><p>Datas nacionais para avaliar no planejamento da loja. Adicione somente as que fizerem sentido.</p></div><small>Próximos 12 meses</small></div>
      {suggestions.length ? <ul>{suggestions.map((suggestion) => {
        const added = events.some((event) => event.title === suggestion.title && event.date === suggestion.date);
        return <li key={`${suggestion.date}-${suggestion.title}`}><div><strong>{suggestion.title}</strong><time dateTime={suggestion.date}>{new Date(`${suggestion.date}T12:00:00Z`).toLocaleDateString("pt-BR", { dateStyle: "medium", timeZone: "UTC" })}</time></div><button type="button" disabled={added} onClick={() => onAdd(suggestion)}>{added ? "Na agenda" : "Adicionar"}</button></li>;
      })}</ul> : <p className="admin-muted">Não há sugestões nos próximos 12 meses.</p>}
      <p className="admin-footnote">O calendário usa referências comerciais nacionais; as datas de cada ano são calculadas pelas regras recorrentes. Confira feriados locais e a relevância de cada campanha: <a href="https://www.correios.com.br/aproxime/arquivos/calendario-comercial-2026_2.pdf" target="_blank" rel="noreferrer">Correios · calendário comercial 2026</a> · <a href="https://sebrae.com.br/content/dam/portal-sebrae/na/midias/documentos/pdfs/Ebook-calendario-empreendedor-datas-oportunidades.pdf" target="_blank" rel="noreferrer">Sebrae · calendário empreendedor 2026</a>.</p>
    </section>
  );
}
