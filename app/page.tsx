import { AuthGate } from "@/components/AuthGate";
import { RoutineShell } from "@/components/RoutineShell";

export default function HomePage() {
  return (
    <AuthGate>
      <RoutineShell />
    </AuthGate>
  );
}
