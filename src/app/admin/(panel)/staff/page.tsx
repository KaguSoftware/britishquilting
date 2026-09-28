import { ownerDb } from "@/lib/actions/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { StaffManager } from "@/components/admin/staff-manager";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const { db, viewer } = await ownerDb();
  const { data } = await db.from("profiles").select("id, email, full_name, role, created_at").in("role", ["owner", "staff"]).order("role").order("full_name");
  return (
    <div>
      <PageHeader title="Staff" description="People who can use this back office. Staff can do everything except change settings and staff." />
      <StaffManager people={data ?? []} me={viewer.id} />
    </div>
  );
}
