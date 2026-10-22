import { notFound } from "next/navigation";
import { MODULES, isModuleKey } from "@/lib/domain/modules";
import { ModuleView } from "@/components/studio/module-view";

export default async function ModulePage({ params }: { params: Promise<{ profileId: string; module: string }> }) {
  const { profileId, module } = await params;
  if (!isModuleKey(module) || MODULES[module].scope !== "profile") notFound();
  return <ModuleView profileId={profileId} module={module} />;
}
