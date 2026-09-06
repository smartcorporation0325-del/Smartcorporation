import { Sidebar } from "@/components/layout/sidebar";
import { DemoModeBanner } from "@/components/layout/demo-mode-banner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoModeBanner />
        <main className="flex-1 overflow-x-hidden px-6 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
