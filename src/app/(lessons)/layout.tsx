import { Sidebar } from "@/components/Sidebar";
import { buildNav } from "@/lib/content";

export default function LessonsLayout({ children }: LayoutProps<"/">) {
  const nav = buildNav();

  return (
    <div className="mx-auto flex w-full max-w-7xl grow gap-10 px-6 py-10">
      <aside
        data-chrome
        className="sticky top-24 hidden h-[calc(100vh-8rem)] w-60 shrink-0 overflow-y-auto lg:block"
      >
        <Sidebar nav={nav} />
      </aside>
      <main className="min-w-0 grow">{children}</main>
    </div>
  );
}
