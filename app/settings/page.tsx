import { AuthGate } from "@/components/AuthGate";
import { SettingsPanel } from "@/components/SettingsPanel";

export default function SettingsPage() {
  return (
    <AuthGate>
      <SettingsPanel />
    </AuthGate>
  );
}
