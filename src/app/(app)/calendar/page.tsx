import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { ScrimCalendar } from "@/components/calendar/scrim-calendar";

export const metadata: Metadata = { title: "Calendario" };

export default function CalendarPage() {
  return (
    <>
      <PageHeader
        eyebrow="Agenda del equipo"
        title="Calendario de scrims"
        description="Selecciona un bloque para agendar, arrastra un scrim para re-agendarlo y haz clic para ver detalles, link de sala y actividad."
      />
      <ScrimCalendar />
    </>
  );
}
