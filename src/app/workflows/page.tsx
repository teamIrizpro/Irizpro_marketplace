import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function WorkflowsPage() {
  const supabase = await supabaseServer();

  const { data: workflows, error } = await supabase
    .from("workflows")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold">Workflows</h1>
        <p className="text-red-600 mt-2">{error.message}</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Workflow Marketplace
            </h1>
            <p className="text-muted-foreground mt-2">
              Buy & run ready-made AI + Automation workflows in one click.
            </p>
          </div>

          {/* Optional search UI (no logic yet, just looks nice) */}
          <div className="w-full md:w-72">
            <div className="relative">
              <input
                className="w-full rounded-xl border bg-background px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Search workflows..."
                disabled
              />
              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
                MVP
              </span>
            </div>
          </div>
        </div>

        {/* Grid */}
        {(!workflows || workflows.length === 0) ? (
          <div className="bg-background border rounded-2xl p-10 text-center shadow-sm">
            <h2 className="text-xl font-semibold">No workflows yet</h2>
            <p className="text-muted-foreground mt-2">
              Add your first workflow in Supabase to see it here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="group relative overflow-hidden rounded-2xl border bg-background shadow-sm transition hover:shadow-lg hover:-translate-y-0.5"
              >
                {/* subtle top glow */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/70 via-cyan-400/60 to-emerald-400/60 opacity-70" />

                <div className="p-5 space-y-3">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold leading-snug line-clamp-2">
                      {wf.name}
                    </h2>

                    {/* Credits pill */}
                    <div className="shrink-0 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
                      {wf.credit_cost} Credits
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {wf.description || "No description provided."}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md bg-muted px-2 py-1">
                      AI / Automation
                    </span>
                    <span className="rounded-md bg-muted px-2 py-1">
                      n8n Agent
                    </span>
                  </div>

                  {/* CTA */}
                  <Link
                    href={`/workflows/${wf.id}`}
                    className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-medium shadow-sm transition group-hover:opacity-95"
                  >
                    View & Run →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
















// import { supabaseServer } from "@/lib/supabase/server";
// import Link from "next/link";

// export default async function WorkflowsPage() {
//   const supabase = await supabaseServer();

//   const { data: workflows, error } = await supabase
//     .from("workflows")
//     .select("*")
//     .eq("is_active", true)
//     .order("created_at", { ascending: false });

//   if (error) {
//     return (
//       <div className="p-6">
//         <h1 className="text-xl font-bold">Workflows</h1>
//         <p className="text-red-600">{error.message}</p>
//       </div>
//     );
//   }

//   return (
//     <main className="p-6 space-y-4">
//       <h1 className="text-2xl font-bold">Available Workflows</h1>

//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//         {workflows?.map((wf) => (
//           <div
//             key={wf.id}
//             className="border p-4 rounded shadow-sm space-y-2"
//           >
//             <h2 className="text-lg font-semibold">{wf.name}</h2>
//             <p className="text-sm text-muted-foreground">
//               {wf.description}
//             </p>

//             <p className="text-sm">
//               <strong>Credits:</strong> {wf.credit_cost}
//             </p>

//             <Link
//               href={`/workflows/${wf.id}`}
//               className="underline text-blue-600 font-medium"
//             >
//               View Workflow →
//             </Link>
//           </div>
//         ))}
//       </div>
//     </main>
//   );
// }