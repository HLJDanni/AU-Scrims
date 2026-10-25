"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type { DatesSetArg, EventContentArg, EventDropArg, EventInput } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { motion } from "framer-motion";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Columns3, Link2, List, Plus, Repeat2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { api, cn, refreshScrims } from "@/lib/client";
import { STATUS_META, type ScrimDTO } from "@/lib/constants";
import { fmtFull } from "@/lib/dates";
import { Tabs } from "../ui/tabs";
import { Button } from "../ui/button";
import { useShell } from "../app-shell";
import { scrimState } from "../scrims/use-scrim-actions";

type View = "timeGridWeek" | "dayGridMonth" | "timeGridDay" | "listWeek";

const VIEWS = [
  { id: "timeGridWeek" as const, label: "Semana", icon: <Columns3 className="h-3.5 w-3.5" /> },
  { id: "dayGridMonth" as const, label: "Mes", icon: <CalendarDays className="h-3.5 w-3.5" /> },
  { id: "timeGridDay" as const, label: "Día", icon: <CalendarRange className="h-3.5 w-3.5" /> },
  { id: "listWeek" as const, label: "Agenda", icon: <List className="h-3.5 w-3.5" /> },
];

export function ScrimCalendar() {
  const { openCreate, openDetail } = useShell();
  const ref = useRef<FullCalendar>(null);
  const [view, setView] = useState<View>("timeGridWeek");
  const [title, setTitle] = useState("");
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);

  const key = range ? `/api/scrims?scope=calendar&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}` : null;
  const { data, mutate, isLoading } = useSWR<{ scrims: ScrimDTO[] }>(key);

  const events = useMemo<EventInput[]>(() => {
    const list: EventInput[] = [];
    for (const s of data?.scrims ?? []) {
      const st = scrimState(s);
      const meta = STATUS_META[s.status];
      list.push({
        id: s.id,
        title: `vs ${s.opponent.tag}`,
        start: s.startAt,
        end: s.endAt,
        editable: st.canReschedule,
        backgroundColor: s.status === "CONFIRMED" ? "rgba(10,200,185,.22)" : s.status === "PENDING" ? "rgba(200,155,60,.20)" : "rgba(160,155,140,.16)",
        borderColor: meta.color,
        textColor: "#F0E6D2",
        classNames: [`scrim-${s.status.toLowerCase()}`],
        extendedProps: { scrim: s },
      });
      if (s.proposal && (s.status === "PENDING" || s.status === "CONFIRMED")) {
        list.push({
          id: `${s.id}-proposal`,
          title: `Propuesta vs ${s.opponent.tag}`,
          start: s.proposal.startAt,
          end: s.proposal.endAt,
          editable: false,
          backgroundColor: "rgba(10,200,185,.06)",
          borderColor: "#0AC8B9",
          textColor: "#CDFAFA",
          classNames: ["scrim-proposal"],
          extendedProps: { scrim: s, proposal: true },
        });
      }
    }
    return list;
  }, [data]);

  const api_ = () => ref.current?.getApi();

  function onDatesSet(arg: DatesSetArg) {
    setTitle(arg.view.title);
    setRange({ from: arg.start.toISOString(), to: arg.end.toISOString() });
  }

  async function move(info: EventDropArg | EventResizeDoneArg) {
    const s = info.event.extendedProps.scrim as ScrimDTO;
    const start = info.event.start!;
    const end = info.event.end ?? new Date(start.getTime() + (new Date(s.endAt).getTime() - new Date(s.startAt).getTime()));
    try {
      const res = await api<{ direct: boolean }>(`/api/scrims/${s.id}/reschedule`, {
        body: { startAt: start.toISOString(), endAt: end.toISOString(), games: s.games },
      });
      if (res.direct) {
        toast.success("Scrim re-agendado", { description: fmtFull(start, end) });
      } else {
        // Es solo una propuesta: el evento vuelve a su lugar y se muestra la propuesta aparte
        info.revert();
        toast.success("Propuesta de re-agenda enviada", { description: `[${s.opponent.tag}] debe aprobar ${fmtFull(start, end)}` });
      }
      await Promise.all([mutate(), refreshScrims()]);
    } catch (err) {
      info.revert();
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="hex-panel p-3 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="secondary" onClick={() => api_()?.prev()} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => api_()?.today()}>
            Hoy
          </Button>
          <Button size="icon" variant="secondary" onClick={() => api_()?.next()} aria-label="Siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <motion.h2 key={title} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="ml-2 font-display text-lg font-bold capitalize tracking-wide text-gold-50">
            {title}
          </motion.h2>
          {isLoading && <span className="ml-2 h-2 w-2 animate-ping rounded-full bg-hex-200" />}
        </div>
        <div className="flex items-center gap-3">
          <Tabs<View>
            size="sm"
            tabs={VIEWS}
            value={view}
            onChange={(v) => {
              setView(v);
              api_()?.changeView(v);
            }}
            className="border-b-0"
          />
          <Button size="sm" onClick={() => openCreate()} className="hidden sm:inline-flex">
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] text-stone-300">
        <Legend color={STATUS_META.CONFIRMED.color} label="Confirmado" />
        <Legend color={STATUS_META.PENDING.color} label="Pendiente" dashed />
        <Legend color="#0AC8B9" label="Propuesta de re-agenda" dashed faded />
        <Legend color={STATUS_META.COMPLETED.color} label="Finalizado" />
        <span className="ml-auto hidden text-stone-400 md:inline">Arrastra en el calendario para agendar · arrastra un scrim para re-agendarlo</span>
      </div>

      <div className={cn("transition-opacity duration-300", isLoading && !data ? "opacity-50" : "opacity-100")}>
        <FullCalendar
          ref={ref}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale={esLocale}
          headerToolbar={false}
          height={view === "dayGridMonth" ? "auto" : 720}
          firstDay={1}
          nowIndicator
          allDaySlot={false}
          slotDuration="00:30:00"
          snapDuration="00:15:00"
          scrollTime="15:00:00"
          slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          dayMaxEvents={3}
          selectable
          selectMirror
          selectAllow={(sel) => sel.start.getTime() > Date.now() - 15 * 60000}
          select={(sel) => {
            const isMonth = sel.view.type === "dayGridMonth";
            const start = new Date(sel.start);
            let end = new Date(sel.end);
            if (isMonth) {
              start.setHours(19, 0, 0, 0);
              end = new Date(start.getTime() + 2 * 3600 * 1000);
            }
            openCreate({ startAt: start, endAt: end });
            sel.view.calendar.unselect();
          }}
          eventAllow={(span) => span.start.getTime() > Date.now()}
          events={events}
          eventClick={(info) => {
            info.jsEvent.preventDefault();
            openDetail((info.event.extendedProps.scrim as ScrimDTO).id);
          }}
          eventDrop={move}
          eventResize={move}
          eventContent={renderEvent}
          datesSet={onDatesSet}
          noEventsContent="No hay scrims en este rango"
        />
      </div>
    </div>
  );
}

function renderEvent(arg: EventContentArg) {
  const s = arg.event.extendedProps.scrim as ScrimDTO;
  const proposal = Boolean(arg.event.extendedProps.proposal);
  const isList = arg.view.type.startsWith("list");
  if (isList) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gold-50">
          {proposal ? "Propuesta · " : ""}
          {s.myTeam.tag} vs {s.opponent.tag}
        </span>
        <span className="text-stone-400">· {s.games} juegos</span>
        {s.roomLink && <Link2 className="h-3.5 w-3.5 text-hex-200" />}
        <span className="text-xs" style={{ color: STATUS_META[s.status].color }}>
          {STATUS_META[s.status].label}
        </span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden border-l-[3px] px-1.5 py-1 leading-tight",
        (s.status === "PENDING" || proposal) && "border-dashed",
        proposal && "opacity-80",
      )}
      style={{ borderColor: proposal ? "#0AC8B9" : STATUS_META[s.status].color }}
    >
      <div className="flex items-center gap-1 truncate text-[11px] font-bold">
        {proposal && <Repeat2 className="h-3 w-3 shrink-0" />}
        <span className="truncate">
          {proposal ? "Propuesta " : ""}vs {s.opponent.tag}
        </span>
        {s.roomLink && !proposal && <Link2 className="h-3 w-3 shrink-0 text-hex-200" />}
      </div>
      <div className="truncate text-[10px] opacity-80">
        {arg.timeText} · {s.games}G
      </div>
    </div>
  );
}

function Legend({ color, label, dashed, faded }: { color: string; label: string; dashed?: boolean; faded?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-sm border-2" style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid", background: faded ? "transparent" : `${color}33` }} />
      {label}
    </span>
  );
}
