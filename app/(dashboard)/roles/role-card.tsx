import { Brain, FolderGit2, BookOpen, Wrench, ShieldCheck } from "lucide-react";

// Shape written by lib/seed-roles.ts. Read every key defensively: the
// manifest is untyped JSON in the database and future roles may omit parts.
interface RoleManifest {
  brain?: { harness?: string; model?: string };
  workspace?: { type?: string };
  playbooks?: string[];
  tools?: string[];
  signoff?: Record<string, boolean>;
}

interface RoleCardProps {
  role: {
    roleKey: string;
    name: string;
    description: string | null;
    manifest: unknown;
  };
}

function humanize(value: string): string {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Section({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-[6px]">
        <Icon className="size-[12px] text-iris-violet/60 shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate">
          {label}
        </span>
      </div>
      <div className="pl-[18px]">{children}</div>
    </div>
  );
}

export function RoleCard({ role }: RoleCardProps) {
  const manifest = (role.manifest ?? {}) as RoleManifest;

  const brainHarness = manifest.brain?.harness;
  const brainModel = manifest.brain?.model;
  const brainParts = [brainHarness, brainModel].filter(
    (part): part is string => Boolean(part)
  );
  const brainText =
    brainParts.length > 0 ? brainParts.map(humanize).join(" · ") : "Not configured";

  const workspaceText = manifest.workspace?.type
    ? humanize(manifest.workspace.type)
    : "Not configured";

  const playbooks = Array.isArray(manifest.playbooks) ? manifest.playbooks : [];
  const tools = Array.isArray(manifest.tools) ? manifest.tools : [];
  const signoff = manifest.signoff && typeof manifest.signoff === "object"
    ? manifest.signoff
    : {};
  const signoffEntries = Object.entries(signoff);
  const gatedActions = signoffEntries
    .filter(([, needsSignoff]) => needsSignoff)
    .map(([action]) => action);

  return (
    <div className="flex flex-col justify-between p-24 rounded border border-mist bg-paper-white hover:border-slate/40 transition-all shadow-xs">
      <div className="space-y-16">
        <div className="space-y-[4px]">
          <h3 className="font-lustria text-lg font-bold text-graphite-ink tracking-tight">
            {role.name}
          </h3>
          {role.description && (
            <p className="text-xs text-slate leading-relaxed">{role.description}</p>
          )}
        </div>

        <div className="space-y-16 pt-16 border-t border-mist">
          <Section icon={Brain} label="Brain">
            <span className="text-xs text-graphite-ink">{brainText}</span>
          </Section>

          <Section icon={FolderGit2} label="Workspace">
            <span className="text-xs text-graphite-ink">{workspaceText}</span>
          </Section>

          <Section icon={BookOpen} label="Playbooks">
            {playbooks.length > 0 ? (
              <div className="flex flex-wrap gap-4">
                {playbooks.map((playbook) => (
                  <span
                    key={playbook}
                    className="px-[6px] py-[2px] rounded-full border border-mist bg-soft-snow font-mono text-[9px] uppercase tracking-wider text-slate"
                  >
                    {playbook}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate/50">None yet</span>
            )}
          </Section>

          <Section icon={Wrench} label="Tools">
            {tools.length > 0 ? (
              <div className="flex flex-wrap gap-4">
                {tools.map((tool) => (
                  <span
                    key={tool}
                    className="px-[6px] py-[2px] rounded-full border border-mist bg-soft-snow font-mono text-[9px] uppercase tracking-wider text-slate"
                  >
                    {humanize(tool)}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate/50">None yet</span>
            )}
          </Section>

          <Section icon={ShieldCheck} label="Sign-off">
            {gatedActions.length > 0 ? (
              <span className="text-xs text-graphite-ink">
                Requires approval: {gatedActions.map(humanize).join(", ")}
              </span>
            ) : (
              <span className="text-xs text-slate/50">No approvals required</span>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
