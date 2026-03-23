import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type MetricCardProps = {
  eyebrow: string;
  title: string;
  value: string;
  hint: string;
  testId?: string;
};

export function MetricCard({ eyebrow, title, value, hint, testId }: MetricCardProps) {
  return (
    <Card className="flex h-full min-h-0 flex-col justify-between bg-white/68" data-testid={testId}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">{eyebrow}</p>
        <CardTitle className="mt-1.5 text-sm sm:text-base">{title}</CardTitle>
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{value}</p>
        <CardDescription className="text-xs sm:text-sm">{hint}</CardDescription>
      </div>
    </Card>
  );
}
