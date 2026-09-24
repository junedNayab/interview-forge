"use client";

import * as Tabs from "@radix-ui/react-tabs";

export type HighlightedTab = { key: string; label: string; html: string };

export function CodeTabsClient({ tabs }: { tabs: HighlightedTab[] }) {
  return (
    <Tabs.Root
      defaultValue={tabs[0].key}
      className="my-6 overflow-hidden rounded-lg border border-foreground/10"
    >
      <Tabs.List className="flex gap-1 border-b border-foreground/10 bg-foreground/5 px-2">
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.key}
            value={tab.key}
            className="cursor-pointer px-3 py-2 text-sm text-foreground/60 transition-colors hover:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-sky-500 data-[state=active]:font-medium data-[state=active]:text-foreground"
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {tabs.map((tab) => (
        <Tabs.Content
          key={tab.key}
          value={tab.key}
          // Shiki emits a complete, escaped <pre> tree; there is no user input here.
          dangerouslySetInnerHTML={{ __html: tab.html }}
          className="[&_pre]:m-0 [&_pre]:rounded-none [&_pre]:border-0"
        />
      ))}
    </Tabs.Root>
  );
}
