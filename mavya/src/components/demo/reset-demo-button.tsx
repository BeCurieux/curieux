import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetDemo } from "@/lib/demo/actions";

export function ResetDemoButton() {
  return (
    <form action={resetDemo}>
      <Button type="submit" variant="soft">
        <RotateCcw aria-hidden />
        Reset the demo
      </Button>
    </form>
  );
}
