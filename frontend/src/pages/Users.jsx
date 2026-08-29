import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROLE_BADGES = {
  admin: "bg-violet-500/10 text-violet-600",
  sales: "bg-blue-500/10 text-blue-600",
  operations: "bg-amber-500/10 text-amber-600",
  finance: "bg-emerald-500/10 text-emerald-600",
};
const ROLE_LABELS = { admin: "Admin", sales: "Sales Agent", operations: "Operations", finance: "Finance" };

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "sales" });
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/users").then((r) => setUsers(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true);
    try {
      await api.post("/users", form);
      toast.success("Team member added");
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "sales" });
      load();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  const changeRole = async (id, role) => {
    try {
      await api.patch(`/users/${id}`, { role });
      toast.success("Role updated");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      toast.success("User removed");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Team & Roles</h1>
          <p className="text-sm text-muted-foreground mt-1">Role-based access: Admin, Sales Agent, Operations, Finance.</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="add-user-btn"><Plus className="w-4 h-4 mr-2" /> Add member</Button>
      </div>

      {!users ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody data-testid="users-table">
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    {u.id === me?.id ? (
                      <Badge className={`rounded-full border-0 ${ROLE_BADGES[u.role]}`}>{ROLE_LABELS[u.role]} (you)</Badge>
                    ) : (
                      <Select value={u.role} onValueChange={(v) => changeRole(u.id, v)}>
                        <SelectTrigger className="w-40 h-8" data-testid={`user-role-${u.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {u.id !== me?.id && (
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(u.id)} data-testid={`user-delete-${u.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="user-dialog">
          <DialogHeader><DialogTitle className="font-heading">Add team member</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="user-name-input" /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-email-input" /></div>
            <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="user-password-input" /></div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={create} disabled={busy} data-testid="user-save-btn">
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Add member
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
