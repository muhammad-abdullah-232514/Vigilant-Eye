import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  createStudent,
  createUser,
  fetchStudents,
  fetchUsers,
  linkStudentUser,
} from "../services/api";

const CAN_MANAGE = new Set(["INVIGILATOR", "HOD", "EXAM_DEPARTMENT"]);

export default function StudentsPage() {
  const { user } = useAuth();
  const canManage = CAN_MANAGE.has(user?.role);

  const [items, setItems] = useState([]);
  const [studentUsers, setStudentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    student_id: "",
    name: "",
    department: "Computer Science",
    program: "BSCS",
    user_id: "",
  });

  const [portalForm, setPortalForm] = useState({
    name: "",
    email: "",
    password: "Demo@123",
  });

  const [linkDrafts, setLinkDrafts] = useState({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const tasks = [fetchStudents()];
      if (canManage) {
        tasks.push(fetchUsers("STUDENT").catch(() => []));
      }
      const [students, users] = await Promise.all(tasks);
      setItems(Array.isArray(students) ? students : []);
      setStudentUsers(Array.isArray(users) ? users : []);
    } catch (err) {
      setError(err.message || "Failed to load students");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [canManage]);

  const userById = useMemo(() => {
    const map = new Map(studentUsers.map((u) => [u.id, u]));
    return map;
  }, [studentUsers]);

  const linkedUserIds = useMemo(
    () => new Set(items.filter((s) => s.user_id != null).map((s) => s.user_id)),
    [items]
  );

  function optionsForStudent(student) {
    // Available: unlinked STUDENT users + this student's current link
    return studentUsers.filter(
      (u) =>
        !linkedUserIds.has(u.id) ||
        (student.user_id != null && u.id === student.user_id)
    );
  }

  async function onCreateStudent(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        student_id: form.student_id.trim(),
        name: form.name.trim(),
        department: form.department.trim(),
        program: form.program.trim(),
      };
      if (form.user_id) {
        payload.user_id = Number(form.user_id);
      }
      await createStudent(payload);
      setMessage("Student created.");
      setForm((prev) => ({
        ...prev,
        student_id: "",
        name: "",
        user_id: "",
      }));
      await load();
    } catch (err) {
      setError(err.message || "Create student failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCreatePortalUser(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const created = await createUser({
        name: portalForm.name.trim(),
        email: portalForm.email.trim().toLowerCase(),
        password: portalForm.password,
        role: "STUDENT",
      });
      setMessage(
        `Portal user created: ${created.email} (id ${created.id}). Link them to a student below.`
      );
      setPortalForm({ name: "", email: "", password: "Demo@123" });
      await load();
    } catch (err) {
      setError(err.message || "Create portal user failed");
    } finally {
      setBusy(false);
    }
  }

  async function onLink(studentPk) {
    const raw = linkDrafts[studentPk];
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const userId =
        raw === undefined || raw === "" || raw === "none"
          ? null
          : Number(raw);
      await linkStudentUser(studentPk, userId);
      setMessage(
        userId == null
          ? `Cleared portal link for student #${studentPk}`
          : `Linked student #${studentPk} to portal user ${userId}`
      );
      await load();
    } catch (err) {
      setError(err.message || "Link failed");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Home / Students</p>
        <h1 className="text-2xl font-semibold text-au-navy">Students</h1>
        <p className="mt-1 text-sm text-slate-600">
          Academic records plus portal logins (STUDENT role). Link a login so
          the student sees only their UFM cases.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {canManage ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <form
            onSubmit={onCreateStudent}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold text-au-navy">Add Student Record</h2>
            <input
              required
              className={inputClass}
              placeholder="Roll / student_id"
              value={form.student_id}
              onChange={(e) =>
                setForm((p) => ({ ...p, student_id: e.target.value }))
              }
            />
            <input
              required
              className={inputClass}
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              required
              className={inputClass}
              placeholder="Department"
              value={form.department}
              onChange={(e) =>
                setForm((p) => ({ ...p, department: e.target.value }))
              }
            />
            <input
              required
              className={inputClass}
              placeholder="Program"
              value={form.program}
              onChange={(e) =>
                setForm((p) => ({ ...p, program: e.target.value }))
              }
            />
            <select
              className={inputClass}
              value={form.user_id}
              onChange={(e) =>
                setForm((p) => ({ ...p, user_id: e.target.value }))
              }
            >
              <option value="">No portal link yet</option>
              {studentUsers
                .filter((u) => !linkedUserIds.has(u.id))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    #{u.id} — {u.name} ({u.email})
                  </option>
                ))}
            </select>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-au-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Saving..." : "Create Student"}
            </button>
          </form>

          <form
            onSubmit={onCreatePortalUser}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold text-au-navy">
              Register Student Portal Login
            </h2>
            <p className="text-xs text-slate-500">
              Creates a <strong>STUDENT</strong> user. Then link them to a
              student roll in the table.
            </p>
            <input
              required
              className={inputClass}
              placeholder="Full name"
              value={portalForm.name}
              onChange={(e) =>
                setPortalForm((p) => ({ ...p, name: e.target.value }))
              }
            />
            <input
              required
              type="email"
              className={inputClass}
              placeholder="Email"
              value={portalForm.email}
              onChange={(e) =>
                setPortalForm((p) => ({ ...p, email: e.target.value }))
              }
            />
            <input
              required
              type="password"
              minLength={4}
              className={inputClass}
              placeholder="Password"
              value={portalForm.password}
              onChange={(e) =>
                setPortalForm((p) => ({ ...p, password: e.target.value }))
              }
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-au-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Saving..." : "Create Portal User"}
            </button>
          </form>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-slate-500">Loading...</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Portal login</th>
                {canManage ? <th className="px-4 py-3">Link / Unlink</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-6 text-slate-500"
                    colSpan={canManage ? 6 : 5}
                  >
                    No students yet.
                  </td>
                </tr>
              ) : (
                items.map((s) => {
                  const linked = s.user_id != null ? userById.get(s.user_id) : null;
                  const draft =
                    linkDrafts[s.id] !== undefined
                      ? linkDrafts[s.id]
                      : s.user_id != null
                        ? String(s.user_id)
                        : "none";
                  return (
                    <tr key={s.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">{s.id}</td>
                      <td className="px-4 py-3 font-medium text-au-navy">
                        {s.student_id}
                      </td>
                      <td className="px-4 py-3">{s.name}</td>
                      <td className="px-4 py-3">{s.department}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {linked
                          ? `${linked.email} (#${linked.id})`
                          : s.user_id != null
                            ? `user #${s.user_id}`
                            : "Not linked"}
                      </td>
                      {canManage ? (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                              value={draft}
                              onChange={(e) =>
                                setLinkDrafts((prev) => ({
                                  ...prev,
                                  [s.id]: e.target.value,
                                }))
                              }
                            >
                              <option value="none">— Unlinked —</option>
                              {optionsForStudent(s).map((u) => (
                                <option key={u.id} value={u.id}>
                                  #{u.id} {u.email}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onLink(s.id)}
                              className="rounded-lg bg-au-navy px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              Save
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
