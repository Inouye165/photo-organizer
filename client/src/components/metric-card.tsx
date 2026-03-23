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
    <Card className="flex min-h-40 flex-col justify-between bg-white/75" data-testid={testId}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/45">{eyebrow}</p>
        <CardTitle className="mt-3 text-xl">{title}</CardTitle>
      </div>
      <div className="space-y-1">
        <p className="text-4xl font-semibold tracking-tight text-ink">{value}</p>
        <CardDescription>{hint}</CardDescription>
      </div>
    </Card>
  );
}
