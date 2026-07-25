/** @jsxImportSource @opentui/react */
/** DoctorCard: one compact diagnostic playbill with an honest status and detail for every check. */
import type { ReactNode } from "react";
import type { DoctorResult, DoctorStatus } from "../../doctor/check";
import { theme } from "../theme";

const statusInk = (status: DoctorStatus): string => {
  if (status === "ok") return theme.teal;
  if (status === "warn") return theme.gold;
  return theme.red;
};

const statusMark = (status: DoctorStatus): string => {
  if (status === "ok") return "+";
  if (status === "warn") return "!";
  return "x";
};

export function DoctorCard({ checks }: { checks: readonly DoctorResult[] }): ReactNode {
  return (
    <box flexDirection="column" border={["left"]} borderColor={theme.teal} backgroundColor={theme.floor}>
      <box flexDirection="row" backgroundColor={theme.panel} paddingLeft={1} paddingRight={1}>
        <text fg={theme.bright}>DOCTOR · {String(checks.length)} CHECKS</text>
      </box>
      {checks.map((check) => (
        <box key={check.id} flexDirection="row" paddingLeft={1} paddingRight={1}>
          <text fg={statusInk(check.status)}>{statusMark(check.status)} </text>
          <text fg={theme.bright}>{check.label}</text>
          <box width={2} />
          <text fg={theme.soft}>{check.detail}</text>
        </box>
      ))}
    </box>
  );
}
