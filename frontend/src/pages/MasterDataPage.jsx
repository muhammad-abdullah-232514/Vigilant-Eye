import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  createCamera,
  createExam,
  createExamRoom,
  fetchCameras,
  fetchExamRooms,
  fetchExams,
} from "../services/api";

const TABS = [
  { id: "rooms", label: "Exam Rooms" },
  { id: "cameras", label: "Cameras" },
  { id: "exams", label: "Exams" },
];

const CAN_CREATE = new Set(["HOD", "EXAM_DEPARTMENT"]);

export default function MasterDataPage() {
  const { user } = useAuth();
  const canCreate = CAN_CREATE.has(user?.role);
  const [tab, setTab] = useState("rooms");
  const [rooms, setRooms] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [roomForm, setRoomForm] = useState({
    room_number: "",
    building: "",
    capacity: "40",
  });
  const [cameraForm, setCameraForm] = useState({
    camera_id: "",
    name: "",
    room_id: "",
    stream_url: "webcam:0",
    is_active: true,
  });
  const [examForm, setExamForm] = useState({
    course_code: "",
    course_name: "",
    semester: "Spring 2026",
    exam_date: "",
    start_time: "09:00",
    end_time: "12:00",
    room_id: "",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [r, c, e] = await Promise.all([
        fetchExamRooms(),
        fetchCameras(),
        fetchExams(),
      ]);
      setRooms(Array.isArray(r) ? r : []);
      setCameras(Array.isArray(c) ? c : []);
      setExams(Array.isArray(e) ? e : []);
      const firstRoom = r?.[0]?.id ? String(r[0].id) : "";
      setCameraForm((prev) => ({
        ...prev,
        room_id: prev.room_id || firstRoom,
      }));
      setExamForm((prev) => ({
        ...prev,
        room_id: prev.room_id || firstRoom,
      }));
    } catch (err) {
      setError(err.message || "Failed to load master data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const roomLabel = useMemo(() => {
    const map = new Map(rooms.map((r) => [r.id, `${r.room_number} (${r.building})`]));
    return (id) => map.get(id) || `#${id}`;
  }, [rooms]);

  async function onCreateRoom(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await createExamRoom({
        room_number: roomForm.room_number.trim(),
        building: roomForm.building.trim(),
        capacity: Number(roomForm.capacity),
      });
      setMessage("Exam room created.");
      setRoomForm({ room_number: "", building: "", capacity: "40" });
      await load();
    } catch (err) {
      setError(err.message || "Create room failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateCamera(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await createCamera({
        camera_id: cameraForm.camera_id.trim(),
        name: cameraForm.name.trim(),
        room_id: Number(cameraForm.room_id),
        stream_url: cameraForm.stream_url.trim(),
        is_active: Boolean(cameraForm.is_active),
      });
      setMessage("Camera registered.");
      setCameraForm((prev) => ({
        ...prev,
        camera_id: "",
        name: "",
      }));
      await load();
    } catch (err) {
      setError(err.message || "Create camera failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateExam(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await createExam({
        course_code: examForm.course_code.trim(),
        course_name: examForm.course_name.trim(),
        semester: examForm.semester.trim(),
        exam_date: examForm.exam_date,
        start_time: examForm.start_time.length === 5
          ? `${examForm.start_time}:00`
          : examForm.start_time,
        end_time: examForm.end_time.length === 5
          ? `${examForm.end_time}:00`
          : examForm.end_time,
        room_id: Number(examForm.room_id),
      });
      setMessage("Exam created.");
      setExamForm((prev) => ({
        ...prev,
        course_code: "",
        course_name: "",
      }));
      await load();
    } catch (err) {
      setError(err.message || "Create exam failed");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Home / Master Data</p>
        <h1 className="text-2xl font-semibold text-au-navy">Master Data</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage exam rooms, cameras, and exams. Create requires HOD or Exam
          Department.
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

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              "rounded-lg px-4 py-2 text-sm font-semibold",
              tab === t.id
                ? "bg-au-navy text-white"
                : "border border-slate-300 bg-white text-slate-700",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : (
        <>
          {tab === "rooms" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {canCreate ? (
                <form
                  onSubmit={onCreateRoom}
                  className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h2 className="font-semibold text-au-navy">Add Exam Room</h2>
                  <input
                    required
                    className={inputClass}
                    placeholder="Room number (e.g. A-101)"
                    value={roomForm.room_number}
                    onChange={(e) =>
                      setRoomForm((p) => ({ ...p, room_number: e.target.value }))
                    }
                  />
                  <input
                    required
                    className={inputClass}
                    placeholder="Building"
                    value={roomForm.building}
                    onChange={(e) =>
                      setRoomForm((p) => ({ ...p, building: e.target.value }))
                    }
                  />
                  <input
                    required
                    type="number"
                    min="1"
                    className={inputClass}
                    placeholder="Capacity"
                    value={roomForm.capacity}
                    onChange={(e) =>
                      setRoomForm((p) => ({ ...p, capacity: e.target.value }))
                    }
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-au-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "Saving..." : "Create Room"}
                  </button>
                </form>
              ) : (
                <p className="text-sm text-slate-500">
                  View-only for your role. HOD / Exam Dept can create rooms.
                </p>
              )}
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3 font-semibold text-au-navy">
                  Rooms ({rooms.length})
                </div>
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">ID</th>
                      <th className="px-4 py-2">Number</th>
                      <th className="px-4 py-2">Building</th>
                      <th className="px-4 py-2">Capacity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="px-4 py-2">{r.id}</td>
                        <td className="px-4 py-2 font-medium">{r.room_number}</td>
                        <td className="px-4 py-2">{r.building}</td>
                        <td className="px-4 py-2">{r.capacity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          ) : null}

          {tab === "cameras" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {canCreate ? (
                <form
                  onSubmit={onCreateCamera}
                  className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h2 className="font-semibold text-au-navy">Register Camera</h2>
                  <input
                    required
                    className={inputClass}
                    placeholder="Camera ID (e.g. CAM-A101-01)"
                    value={cameraForm.camera_id}
                    onChange={(e) =>
                      setCameraForm((p) => ({ ...p, camera_id: e.target.value }))
                    }
                  />
                  <input
                    required
                    className={inputClass}
                    placeholder="Display name"
                    value={cameraForm.name}
                    onChange={(e) =>
                      setCameraForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                  <select
                    required
                    className={inputClass}
                    value={cameraForm.room_id}
                    onChange={(e) =>
                      setCameraForm((p) => ({ ...p, room_id: e.target.value }))
                    }
                  >
                    <option value="">Select room</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.room_number} — {r.building}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    className={inputClass}
                    placeholder="webcam:0 or rtsp://..."
                    value={cameraForm.stream_url}
                    onChange={(e) =>
                      setCameraForm((p) => ({ ...p, stream_url: e.target.value }))
                    }
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={cameraForm.is_active}
                      onChange={(e) =>
                        setCameraForm((p) => ({
                          ...p,
                          is_active: e.target.checked,
                        }))
                      }
                    />
                    Active
                  </label>
                  <button
                    type="submit"
                    disabled={busy || rooms.length === 0}
                    className="rounded-xl bg-au-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "Saving..." : "Create Camera"}
                  </button>
                  {rooms.length === 0 ? (
                    <p className="text-xs text-amber-700">Create a room first.</p>
                  ) : null}
                </form>
              ) : (
                <p className="text-sm text-slate-500">
                  View-only for your role. HOD / Exam Dept can register cameras.
                </p>
              )}
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3 font-semibold text-au-navy">
                  Cameras ({cameras.length})
                </div>
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Code</th>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Room</th>
                      <th className="px-4 py-2">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cameras.map((c) => (
                      <tr key={c.id} className="border-t border-slate-100">
                        <td className="px-4 py-2 font-medium">{c.camera_id}</td>
                        <td className="px-4 py-2">{c.name}</td>
                        <td className="px-4 py-2">{roomLabel(c.room_id)}</td>
                        <td className="px-4 py-2">
                          {c.is_active ? "Yes" : "No"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          ) : null}

          {tab === "exams" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {canCreate ? (
                <form
                  onSubmit={onCreateExam}
                  className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h2 className="font-semibold text-au-navy">Schedule Exam</h2>
                  <input
                    required
                    className={inputClass}
                    placeholder="Course code"
                    value={examForm.course_code}
                    onChange={(e) =>
                      setExamForm((p) => ({ ...p, course_code: e.target.value }))
                    }
                  />
                  <input
                    required
                    className={inputClass}
                    placeholder="Course name"
                    value={examForm.course_name}
                    onChange={(e) =>
                      setExamForm((p) => ({ ...p, course_name: e.target.value }))
                    }
                  />
                  <input
                    required
                    className={inputClass}
                    placeholder="Semester"
                    value={examForm.semester}
                    onChange={(e) =>
                      setExamForm((p) => ({ ...p, semester: e.target.value }))
                    }
                  />
                  <input
                    required
                    type="date"
                    className={inputClass}
                    value={examForm.exam_date}
                    onChange={(e) =>
                      setExamForm((p) => ({ ...p, exam_date: e.target.value }))
                    }
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      required
                      type="time"
                      className={inputClass}
                      value={examForm.start_time}
                      onChange={(e) =>
                        setExamForm((p) => ({ ...p, start_time: e.target.value }))
                      }
                    />
                    <input
                      required
                      type="time"
                      className={inputClass}
                      value={examForm.end_time}
                      onChange={(e) =>
                        setExamForm((p) => ({ ...p, end_time: e.target.value }))
                      }
                    />
                  </div>
                  <select
                    required
                    className={inputClass}
                    value={examForm.room_id}
                    onChange={(e) =>
                      setExamForm((p) => ({ ...p, room_id: e.target.value }))
                    }
                  >
                    <option value="">Select room</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.room_number} — {r.building}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={busy || rooms.length === 0}
                    className="rounded-xl bg-au-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "Saving..." : "Create Exam"}
                  </button>
                </form>
              ) : (
                <p className="text-sm text-slate-500">
                  View-only for your role. HOD / Exam Dept can schedule exams.
                </p>
              )}
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3 font-semibold text-au-navy">
                  Exams ({exams.length})
                </div>
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Code</th>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Time</th>
                      <th className="px-4 py-2">Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((e) => (
                      <tr key={e.id} className="border-t border-slate-100">
                        <td className="px-4 py-2 font-medium">
                          {e.course_code}
                          <span className="block text-xs font-normal text-slate-500">
                            {e.course_name}
                          </span>
                        </td>
                        <td className="px-4 py-2">{e.exam_date}</td>
                        <td className="px-4 py-2">
                          {String(e.start_time).slice(0, 5)}–
                          {String(e.end_time).slice(0, 5)}
                        </td>
                        <td className="px-4 py-2">{roomLabel(e.room_id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
