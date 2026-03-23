import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type DateRangeFilterProps = {
  initialDateFrom: string;
  initialDateTo: string;
  onApply: (next: { dateFrom: string; dateTo: string }) => void;
  onClear: () => void;
};

export function DateRangeFilter({
  initialDateFrom,
  initialDateTo,
  onApply,
  onClear,
}: DateRangeFilterProps) {
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);

  useEffect(() => {
    setDateFrom(initialDateFrom);
    setDateTo(initialDateTo);
  }, [initialDateFrom, initialDateTo]);

  return (
    <Card className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="pr-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/45">Browse by date</p>
        <h2 className="mt-1 text-lg font-semibold text-ink">Filter the current gallery view</h2>
      </div>
      <form
        className="grid gap-2 sm:grid-cols-[minmax(0,180px)_minmax(0,180px)_auto_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          onApply({ dateFrom, dateTo });
        }}
      >
        <label className="flex flex-col gap-1 text-sm text-black/60">
          <span>From</span>
          <Input aria-label="Date from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-black/60">
          <span>To</span>
          <Input aria-label="Date to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        <Button className="h-10" type="submit">
          Apply filters
        </Button>
        <Button
          className="h-10"
          type="button"
          variant="secondary"
          onClick={() => {
            setDateFrom("");
            setDateTo("");
            onClear();
          }}
        >
          Clear
        </Button>
      </form>
    </Card>
  );
}
