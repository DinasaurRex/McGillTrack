'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

type TabsValue = string;

type TabsContextValue = {
  idBase: string;
  orientation: 'horizontal' | 'vertical';
  setValue: (value: TabsValue) => void;
  value: TabsValue;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used inside <Tabs>.');
  }
  return context;
}

type TabsProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  defaultValue?: TabsValue;
  onValueChange?: (value: TabsValue) => void;
  orientation?: 'horizontal' | 'vertical';
  value?: TabsValue;
};

function Tabs({
  className,
  defaultValue = '',
  onValueChange,
  orientation = 'horizontal',
  value: controlledValue,
  ...props
}: TabsProps) {
  const idBase = React.useId();
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(defaultValue);
  const value = controlledValue ?? uncontrolledValue;

  const setValue = React.useCallback(
    (nextValue: TabsValue) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [controlledValue, onValueChange],
  );

  return (
    <TabsContext.Provider value={{ idBase, orientation, setValue, value }}>
      <div
        data-slot="tabs"
        data-orientation={orientation}
        data-horizontal={orientation === 'horizontal' ? '' : undefined}
        data-vertical={orientation === 'vertical' ? '' : undefined}
        className={cn(
          'group/tabs flex gap-2 data-horizontal:flex-col',
          className,
        )}
        {...props}
      />
    </TabsContext.Provider>
  );
}

const tabsListVariants = cva(
  'group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none',
  {
    variants: {
      variant: {
        default: 'bg-muted',
        line: 'gap-1 bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type TabsListProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof tabsListVariants>;

function TabsList({ className, variant = 'default', ...props }: TabsListProps) {
  const { orientation } = useTabsContext();

  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

type TabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: TabsValue;
};

function TabsTrigger({
  className,
  disabled,
  onClick,
  onKeyDown,
  onPointerDown,
  value,
  ...props
}: TabsTriggerProps) {
  const context = useTabsContext();
  const active = context.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-controls={`${context.idBase}-${value}-panel`}
      aria-selected={active}
      aria-disabled={disabled}
      data-active={active ? '' : undefined}
      data-orientation={context.orientation}
      data-slot="tabs-trigger"
      disabled={disabled}
      id={`${context.idBase}-${value}-tab`}
      tabIndex={active ? 0 : -1}
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        'group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent',
        'data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground',
        'after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100',
        className,
      )}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented && !disabled && event.button === 0) {
          context.setValue(value);
        }
      }}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          context.setValue(value);
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (
          !event.defaultPrevented &&
          !disabled &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          context.setValue(value);
        }
      }}
      {...props}
    />
  );
}

type TabsContentProps = React.HTMLAttributes<HTMLDivElement> & {
  value: TabsValue;
};

function TabsContent({ className, value, ...props }: TabsContentProps) {
  const context = useTabsContext();
  const active = context.value === value;

  if (!active) return null;

  return (
    <div
      role="tabpanel"
      aria-labelledby={`${context.idBase}-${value}-tab`}
      data-active=""
      data-slot="tabs-content"
      id={`${context.idBase}-${value}-panel`}
      className={cn('flex-1 text-sm outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
