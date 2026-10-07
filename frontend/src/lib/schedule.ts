export type ScheduleDay = {
  day: string;
  date: string;
  window: string;
  status: "completed" | "today" | "upcoming";
};

export function getSchedule(): ScheduleDay[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = new Date();
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1;
  return days.map((d, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + (i - dow));
    const status: ScheduleDay["status"] = i < dow ? "completed" : i === dow ? "today" : "upcoming";
    return {
      day: d,
      date: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      window: ["7:00 – 8:30 AM", "7:30 – 9:00 AM", "8:00 – 9:30 AM"][i % 3],
      status,
    };
  });
}

export type AlertEvent = {
  id: string;
  title: string;
  subtitle: string;
  tone: "success" | "warn" | "info";
  ago: string;
};

export function getAlertHistory(): AlertEvent[] {
  // DEPRECATED: Alert history is now fetched from the database via alerts.functions.ts.
  // This function is kept as a no-op for backward compatibility.
  return [];
}
