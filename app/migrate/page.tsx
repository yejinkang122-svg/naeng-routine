import { AuthGate } from "@/components/AuthGate";
import { MigrationPanel } from "@/components/MigrationPanel";

export default function MigratePage() {
  return (
    <AuthGate>
      <MigrationPanel />
    </AuthGate>
  );
}
