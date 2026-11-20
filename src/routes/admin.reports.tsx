import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDailyDriverReport } from "@/lib/tracking.functions";
import {
  DownloadIcon,
  FileSpreadsheetIcon,
  UserIcon,
  TruckIcon,
  ClockIcon,
  MapIcon,
} from "@/components/icons";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Daily Reports — CleanTrack Admin" },
      {
        name: "description",
        content:
          "Download daily driver activity reports as Excel files. Track driver login times, offline times, and kilometers covered.",
      },
    ],
  }),
  component: ReportsPage,
});

/* ── Excel builder (pure JS, no external library) ─────────────────────── */

/** Escape XML special characters */
function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Format ISO timestamp to readable local string */
function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "—";
  }
}

/** Format date for display */
function fmtDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

type DriverRow = {
  driverName: string;
  driverPhone: string;
  truckCode: string;
  ward: string;
  truckStatus: string;
  dutyState: string;
  onDuty: boolean;
  loginTime: string | null;
  lastHeartbeat: string | null;
  distanceKm: number;
  stopsCompleted: number;
};

/**
 * Builds an Excel XML Spreadsheet 2003 (.xls) file from the driver data.
 * This format is natively supported by Excel, Google Sheets, and LibreOffice.
 */
function buildExcelXml(drivers: DriverRow[], reportDate: string): string {
  const title = `Shirpur Driver Report - ${reportDate}`;
  const headers = [
    "Sr. No.",
    "Driver Name",
    "Driver Phone",
    "Truck No.",
    "Ward",
    "Status",
    "Login Time",
    "Last Active Time",
    "Distance Covered (km)",
    "Stops Completed",
  ];

  let rows = "";
  drivers.forEach((d, i) => {
    rows += `
    <Row>
      <Cell><Data ss:Type="Number">${i + 1}</Data></Cell>
      <Cell ss:StyleID="s_text"><Data ss:Type="String">${escXml(d.driverName)}</Data></Cell>
      <Cell ss:StyleID="s_text"><Data ss:Type="String">${escXml(d.driverPhone ? `+91 ${d.driverPhone}` : "—")}</Data></Cell>
      <Cell ss:StyleID="s_truck"><Data ss:Type="String">${escXml(d.truckCode)}</Data></Cell>
      <Cell ss:StyleID="s_text"><Data ss:Type="String">${escXml(d.ward)}</Data></Cell>
      <Cell ss:StyleID="${d.onDuty ? "s_online" : "s_offline"}"><Data ss:Type="String">${d.onDuty ? "Online" : "Offline"}</Data></Cell>
      <Cell ss:StyleID="s_text"><Data ss:Type="String">${escXml(fmtTime(d.loginTime))}</Data></Cell>
      <Cell ss:StyleID="s_text"><Data ss:Type="String">${escXml(fmtTime(d.lastHeartbeat))}</Data></Cell>
      <Cell><Data ss:Type="Number">${d.distanceKm}</Data></Cell>
      <Cell><Data ss:Type="Number">${d.stopsCompleted}</Data></Cell>
    </Row>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default"><Font ss:FontName="Calibri" ss:Size="11"/></Style>
  <Style ss:ID="s_title">
    <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#1B1B1F"/>
    <Interior ss:Color="#E8F5E9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="s_subtitle">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#6B7280"/>
  </Style>
  <Style ss:ID="s_header">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
    <Interior ss:Color="#1B1B1F" ss:Pattern="Solid"/>
    <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    <Borders>
      <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    </Borders>
  </Style>
  <Style ss:ID="s_text">
    <Font ss:FontName="Calibri" ss:Size="11"/>
    <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="s_truck">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#16A34A"/>
    <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="s_online">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#16A34A"/>
    <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
    <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="s_offline">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#DC2626"/>
    <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
    <Alignment ss:Horizontal="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Driver Report">
  <Table>
   <Column ss:Width="50"/>
   <Column ss:Width="180"/>
   <Column ss:Width="140"/>
   <Column ss:Width="100"/>
   <Column ss:Width="150"/>
   <Column ss:Width="90"/>
   <Column ss:Width="160"/>
   <Column ss:Width="160"/>
   <Column ss:Width="140"/>
   <Column ss:Width="120"/>
   <Row ss:Height="30">
     <Cell ss:MergeAcross="9" ss:StyleID="s_title"><Data ss:Type="String">${escXml(title)}</Data></Cell>
   </Row>
   <Row ss:Height="22">
     <Cell ss:MergeAcross="9" ss:StyleID="s_subtitle"><Data ss:Type="String">Shirpur Municipal Corporation · Generated on ${new Date().toLocaleString("en-IN")} · Valid for ${reportDate} only</Data></Cell>
   </Row>
   <Row ss:Height="5"><Cell/></Row>
   <Row ss:Height="28">
     ${headers.map((h) => `<Cell ss:StyleID="s_header"><Data ss:Type="String">${escXml(h)}</Data></Cell>`).join("")}
   </Row>
   ${rows}
  </Table>
 </Worksheet>
</Workbook>`;
}

function downloadExcel(drivers: DriverRow[], reportDate: string) {
  const xml = buildExcelXml(drivers, reportDate);
  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Shirpur_Driver_Report_${reportDate}.xls`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/* ── Component ────────────────────────────────────────────────────────── */

function ReportsPage() {
  const tr = useT();
  const [downloading, setDownloading] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ["daily-driver-report"],
    queryFn: () => getDailyDriverReport(),
    staleTime: 30_000,
    refetchInterval: typeof window !== "undefined" ? 60_000 : false,
  });

  const drivers: DriverRow[] = useMemo(() => report?.drivers ?? [], [report]);
  const reportDate = report?.reportDate ?? new Date().toISOString().slice(0, 10);
  const onlineCount = drivers.filter((d) => d.onDuty).length;
  const offlineCount = drivers.filter((d) => !d.onDuty).length;
  const totalKm = drivers.reduce((sum, d) => sum + d.distanceKm, 0);
  const totalStops = drivers.reduce((sum, d) => sum + d.stopsCompleted, 0);

  function handleDownload() {
    setDownloading(true);
    try {
      downloadExcel(drivers, reportDate);
    } finally {
      setTimeout(() => setDownloading(false), 1200);
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{tr("Daily Reports")}</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {fmtDate(reportDate)} · {tr("Auto-refreshes daily")}
          </p>
        </div>
        <button
          id="download-excel-btn"
          onClick={handleDownload}
          disabled={downloading || drivers.length === 0}
          className="h-11 px-5 rounded-xl bg-ink text-white text-sm font-semibold flex items-center gap-2.5 hover:bg-neutral-800 transition-all disabled:bg-neutral-200 disabled:text-neutral-400 shadow-sm"
        >
          {downloading ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="opacity-25"
                />
                <path
                  d="M4 12a8 8 0 018-8"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="opacity-75"
                />
              </svg>
              {tr("Downloading…")}
            </>
          ) : (
            <>
              <DownloadIcon className="w-4 h-4" />
              {tr("Download Excel")}
            </>
          )}
        </button>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-4 gap-3">
        <SummaryCard
          icon={<UserIcon className="w-5 h-5" />}
          label={tr("Total Drivers")}
          value={drivers.length}
          color="blue"
        />
        <SummaryCard
          icon={<TruckIcon className="w-5 h-5" />}
          label={tr("Online Now")}
          value={onlineCount}
          sub={`${offlineCount} ${tr("offline")}`}
          color="green"
        />
        <SummaryCard
          icon={<MapIcon className="w-5 h-5" />}
          label={tr("Total Km Today")}
          value={totalKm.toFixed(1)}
          color="amber"
        />
        <SummaryCard
          icon={<ClockIcon className="w-5 h-5" />}
          label={tr("Stops Completed")}
          value={totalStops}
          color="violet"
        />
      </div>

      {/* Info banner */}
      <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200/60 px-4 py-3 flex items-center gap-3">
        <FileSpreadsheetIcon className="w-5 h-5 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-800">
          <span className="font-semibold">{tr("Note:")}</span>{" "}
          {tr(
            "This report is valid for today only. Data refreshes automatically at midnight. Download the Excel file to keep a permanent record of each day's driver activity.",
          )}
        </p>
      </div>

      {/* Data table */}
      <div className="mt-5 rounded-2xl border border-neutral-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <svg className="w-8 h-8 animate-spin text-neutral-300" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="opacity-25"
                />
                <path
                  d="M4 12a8 8 0 018-8"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="opacity-75"
                />
              </svg>
              <span className="text-sm text-neutral-400">{tr("Loading report data…")}</span>
            </div>
          </div>
        ) : drivers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 grid place-items-center">
              <UserIcon className="w-6 h-6 text-neutral-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-600">{tr("No driver data")}</div>
              <div className="text-xs text-neutral-400 mt-1">
                {tr("No drivers have been registered in the system yet.")}
              </div>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold w-12">#</th>
                <th className="text-left px-4 py-3 font-semibold">{tr("Driver")}</th>
                <th className="text-left px-4 py-3 font-semibold">{tr("Phone")}</th>
                <th className="text-left px-4 py-3 font-semibold">{tr("Truck")}</th>
                <th className="text-left px-4 py-3 font-semibold">{tr("Ward")}</th>
                <th className="text-left px-4 py-3 font-semibold">{tr("Status")}</th>
                <th className="text-left px-4 py-3 font-semibold">{tr("Login Time")}</th>
                <th className="text-left px-4 py-3 font-semibold">{tr("Last Active")}</th>
                <th className="text-right px-4 py-3 font-semibold">{tr("Km")}</th>
                <th className="text-right px-4 py-3 font-semibold">{tr("Stops")}</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d, i) => (
                <tr
                  key={d.driverPhone || i}
                  className={`border-t border-neutral-100 ${i % 2 ? "bg-neutral-50/40" : ""}`}
                >
                  <td className="px-4 py-3 text-neutral-400 font-mono text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{d.driverName}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {d.driverPhone ? `+91 ${d.driverPhone}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-brand-soft text-brand">
                      {d.truckCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 text-xs">{d.ward}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`ct-pill text-[10px] py-0.5 ${d.onDuty ? "bg-brand-soft text-brand" : "bg-neutral-100 text-neutral-500"}`}
                    >
                      {d.onDuty ? tr("Online") : tr("Offline")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600 font-mono">
                    {fmtTime(d.loginTime)}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600 font-mono">
                    {fmtTime(d.lastHeartbeat)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-ink tabular-nums">
                    {d.distanceKm.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-ink tabular-nums">
                    {d.stopsCompleted}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-neutral-50 border-t-2 border-neutral-200">
              <tr>
                <td className="px-4 py-3" colSpan={8}>
                  <span className="text-xs font-bold text-neutral-600 uppercase">
                    {tr("Total")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-ink tabular-nums">
                  {totalKm.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-ink tabular-nums">
                  {totalStops}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────── */

const colorMap = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  green: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  violet: "bg-violet-50 text-violet-600 border-violet-100",
} as const;

function SummaryCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  color: keyof typeof colorMap;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-white/80 grid place-items-center shadow-sm">
          {icon}
        </div>
        <span className="text-xs uppercase tracking-wider font-semibold opacity-70">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
      {sub && <div className="text-xs opacity-60 mt-1">{sub}</div>}
    </div>
  );
}
