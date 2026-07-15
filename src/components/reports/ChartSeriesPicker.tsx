import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ChartSeriesPickerProps {
  /** Every group value present in the data. */
  allGroups: string[];
  /** The groups currently drawn; their order selects their colour. */
  plottedGroups: string[];
  /** Chart palette, indexed by position in `plottedGroups` and cycled. */
  colors: readonly string[];
  /** True while `plottedGroups` is the default set rather than an explicit pick. */
  isDefaultSelection: boolean;
  /** Called with the new picks; an empty array restores the default set. */
  onChange: (picked: string[]) => void;
}

/**
 * Chooses which grouped series a chart plots (DO-335).
 *
 * Charts default to the first ten groups because more overlapping lines stop
 * being readable. That default used to be the whole story — groups past the
 * tenth were dropped and never offered anywhere — so this states the count it is
 * showing out of the total and lets any of them be picked.
 */
export function ChartSeriesPicker({
  allGroups,
  plottedGroups,
  colors,
  isDefaultSelection,
  onChange,
}: ChartSeriesPickerProps) {
  const [open, setOpen] = useState(false);

  const toggle = (group: string) => {
    const next = plottedGroups.includes(group)
      ? plottedGroups.filter(g => g !== group)
      : [...plottedGroups, group];
    // Emit in data order: position picks the colour, so ordering by pick order
    // would recolour the chart on every click.
    onChange(allGroups.filter(g => next.includes(g)));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="h-7 px-2 text-xs font-normal text-muted-foreground print:hidden"
        >
          Series: {plottedGroups.length} of {allGroups.length}
          <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="center">
        <Command>
          <CommandInput placeholder="Search groups..." />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>No groups found.</CommandEmpty>
            <CommandGroup>
              {allGroups.map(group => {
                const colorIdx = plottedGroups.indexOf(group);
                const isPlotted = colorIdx >= 0;

                return (
                  <CommandItem key={group} value={group} onSelect={() => toggle(group)}>
                    <Check className={cn('mr-2 h-4 w-4 shrink-0', isPlotted ? 'opacity-100' : 'opacity-0')} />
                    <span
                      className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full border"
                      style={
                        isPlotted
                          ? { backgroundColor: colors[colorIdx % colors.length], borderColor: 'transparent' }
                          : undefined
                      }
                    />
                    <span className="truncate">{group}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {!isDefaultSelection && (
          <div className="border-t p-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full justify-center text-xs font-normal text-muted-foreground"
              onClick={() => onChange([])}
            >
              Reset to default
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
