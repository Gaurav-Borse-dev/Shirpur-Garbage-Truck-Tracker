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
    const status: ScheduleDay["status"] =
      i < dow ? "completed" : i === dow ? "today" : "upcoming";
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
  return [
    { id: "1", title: "Pickup completed", subtitle: "GBR-03 collected at 8:12 AM", tone: "success", ago: "Today, 8:12 AM" },
    { id: "2", title: "Truck nearby", subtitle: "GBR-03 entered your alert zone", tone: "info", ago: "Today, 8:04 AM" },
    { id: "3", title: "Missed pickup", subtitle: "You did not respond in time", tone: "warn", ago: "Yesterday, 8:30 AM" },
    { id: "4", title: "Pickup completed", subtitle: "GBR-02 collected at 7:55 AM", tone: "success", ago: "2 days ago" },
    { id: "5", title: "Schedule reminder", subtitle: "Pickup tomorrow at 8 AM", tone: "info", ago: "3 days ago" },
    { id: "6", title: "Pickup completed", subtitle: "GBR-03 collected at 8:21 AM", tone: "success", ago: "4 days ago" },
    { id: "7", title: "Truck nearby", subtitle: "GBR-03 entered your alert zone", tone: "info", ago: "4 days ago" },
    { id: "8", title: "Pickup completed", subtitle: "GBR-03 collected at 8:18 AM", tone: "success", ago: "5 days ago" },
    { id: "9", title: "Missed pickup", subtitle: "You did not respond in time", tone: "warn", ago: "6 days ago" },
    { id: "10", title: "Pickup completed", subtitle: "GBR-03 collected at 8:05 AM", tone: "success", ago: "7 days ago" },
  ];
}