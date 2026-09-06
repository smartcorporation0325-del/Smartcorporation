import Sidebar from "@/components/Sidebar";
import { getSettings } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar companyName={settings.company_name} />
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
