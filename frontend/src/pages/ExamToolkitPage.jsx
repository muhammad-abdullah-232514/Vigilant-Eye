import { useEffect, useMemo, useState } from "react";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import { EXAM_TOOLKIT_ROLES, roleIn } from "../config/roleAccess";
import { useAuth } from "../context/AuthContext";
import {
  createExam,
  createExamRoom,
  fetchExamRooms,
  fetchExams,
} from "../services/api";

const EMPTY_FORM = {
  course_code: "",
  course_name: "",
  semester: "Spring 2026",
  exam_date: "",
  start_time: "09:00",
  end_time: "12:00",
  room_id: "",
  title: "",
  department: "",
  section: "",
  student_count: "",
  required_invigilators: "1",
  notes: "",
};

const EMPTY_ROOM_FORM = {
  room_number: "",
  building: "",
  capacity: "40",
};

export default function ExamToolkitPage() {
  const { user } = useAuth();
  const canManage = roleIn(user?.role, EXAM_TOOLKIT_ROLES);

  const [rooms, setRooms] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [examForm, setExamForm] = useState(EMPTY_FORM);
  const [roomForm, setRoomForm] = useState(EMPTY_ROOM_FORM);
  const [showRoomForm, setShowRoomForm] = useState(false);

  const roomMap = useMemo(
    () =>
      new Map(
        rooms.map((room) => [
          String(room.id),
          `${room.room_number} (${room.building}) · ${room.capacity} seats`,
        ])
      ),
    [rooms]
  );

  async function loadExamData() {
    if (!canManage) return;
    setLoading(true);
    setError("");
    try {
      const [roomData, examData] = await Promise.all([
        fetchExamRooms(),
        fetchExams(),
      ]);

      setRooms(Array.isArray(roomData) ? roomData : []);
      setExams(Array.isArray(examData) ? examData : []);
      if (Array.isArray(roomData) && roomData.length > 0 && !examForm.room_id) {
        setExamForm((current) => ({
          ...current,
          room_id: String(roomData[0].id),
        }));
      }
    } catch (err) {
      setError(err.message || "Unable to load the exam toolkit");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canManage) {
      loadExamData();
    }
  }, [canManage]);

  async function handleCreateExam(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (!examForm.course_code.trim() || !examForm.course_name.trim()) {
        throw new Error("Course code and course name are required.");
      }
      if (!examForm.exam_date) {
        throw new Error("Exam date is required.");
      }
      if (!examForm.room_id) {
        throw new Error("Select a room before creating the exam.");
      }

      const startTime = examForm.start_time || "09:00";
      const endTime = examForm.end_time || "12:00";
      if (endTime <= startTime) {
        throw new Error("End time must be after the start time.");
      }

      const payload = {
        course_code: examForm.course_code.trim(),
        course_name: examForm.course_name.trim(),
        semester: examForm.semester.trim() || "Spring 2026",
        exam_date: examForm.exam_date,
        start_time: startTime,
        end_time: endTime,
        room_id: Number(examForm.room_id),
        title: examForm.title.trim() || null,
        department: examForm.department.trim() || null,
        section: examForm.section.trim() || null,
        student_count:
          examForm.student_count === "" ? null : Number(examForm.student_count),
        required_invigilators: Number(examForm.required_invigilators || 1),
        notes: examForm.notes.trim() || null,
      };

      const created = await createExam(payload);
      setMessage(`Exam ${created.course_code} created.`);
      setExamForm(EMPTY_FORM);
      await loadExamData();
    } catch (err) {
      setError(err.message || "Exam creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateRoom() {
    const roomNumber = roomForm.room_number.trim();
    const building = roomForm.building.trim();
    const capacity = Number(roomForm.capacity);
    if (!roomNumber || !building || !Number.isInteger(capacity) || capacity < 1) {
      setError("Enter a room number, building, and a positive whole-number capacity.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const createdRoom = await createExamRoom({
        room_number: roomNumber,
        building,
        capacity,
      });
      setRooms((current) => [...current, createdRoom]);
      setRoomForm(EMPTY_ROOM_FORM);
      setShowRoomForm(false);
      setMessage(
        `Room ${createdRoom.room_number} created. Select it above to use it for this exam.`
      );
    } catch (err) {
      setError(err.message || "Unable to create examination room.");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900">
        <p className="font-semibold">Exam toolkit is restricted</p>
        <p className="mt-1">Only the Exam Department and HOD can access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Home / Exam Toolkit"
        title="Exam Toolkit"
        description="Create exam schedules and assign examination rooms."
      />

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        <form onSubmit={handleCreateExam} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-au-navy">Create Exam</h2>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Roster build</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              required
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"
              placeholder="Course code"
              value={examForm.course_code}
              onChange={(event) => setExamForm((current) => ({ ...current, course_code: event.target.value }))}
            />
            <input
              required
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"
              placeholder="Course name"
              value={examForm.course_name}
              onChange={(event) => setExamForm((current) => ({ ...current, course_name: event.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"
              placeholder="Title (optional)"
              value={examForm.title}
              onChange={(event) => setExamForm((current) => ({ ...current, title: event.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"
              placeholder="Department"
              value={examForm.department}
              onChange={(event) => setExamForm((current) => ({ ...current, department: event.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"
              placeholder="Section"
              value={examForm.section}
              onChange={(event) => setExamForm((current) => ({ ...current, section: event.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"
              placeholder="Semester"
              value={examForm.semester}
              onChange={(event) => setExamForm((current) => ({ ...current, semester: event.target.value }))}
            />
            <input
              required
              type="date"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"
              value={examForm.exam_date}
              onChange={(event) => setExamForm((current) => ({ ...current, exam_date: event.target.value }))}
            />
            <div className="space-y-2">
              <label
                htmlFor="exam-room-select"
                className="block text-xs font-semibold text-slate-600"
              >
                Examination room
              </label>
              <select
                id="exam-room-select"
                required
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"
                value={examForm.room_id}
                onChange={(event) =>
                  setExamForm((current) => ({
                    ...current,
                    room_id: event.target.value,
                  }))
                }
              >
                <option value="">Select room</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number} · {room.building} · {room.capacity} seats
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowRoomForm((current) => !current)}
                className="text-xs font-semibold text-au-blue hover:underline"
                aria-expanded={showRoomForm}
                aria-controls="create-exam-room-form"
              >
                {showRoomForm ? "Cancel adding room" : "+ Add room"}
              </button>
              {rooms.length === 0 ? (
                <p className="text-xs text-amber-700">
                  No examination rooms are available. Add a room to schedule this exam.
                </p>
              ) : null}
              {showRoomForm ? (
                <div
                  id="create-exam-room-form"
                  className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-sm font-semibold text-au-navy">
                    Add examination room
                  </p>
                  <input
                    aria-label="Room number"
                    maxLength={50}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Room number (e.g. A-101)"
                    value={roomForm.room_number}
                    onChange={(event) =>
                      setRoomForm((current) => ({
                        ...current,
                        room_number: event.target.value,
                      }))
                    }
                  />
                  <input
                    aria-label="Building"
                    maxLength={100}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Building"
                    value={roomForm.building}
                    onChange={(event) =>
                      setRoomForm((current) => ({
                        ...current,
                        building: event.target.value,
                      }))
                    }
                  />
                  <input
                    required
                    type="number"
                    min="1"
                    max="100000"
                    step="1"
                    aria-label="Room capacity"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Capacity"
                    value={roomForm.capacity}
                    onChange={(event) =>
                      setRoomForm((current) => ({
                        ...current,
                        capacity: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    onClick={handleCreateRoom}
                    disabled={busy}
                    className="rounded-lg bg-au-navy px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "Adding…" : "Add room"}
                  </button>
                </div>
              ) : null}
            </div>
            <input
              type="time"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"
              value={examForm.start_time}
              onChange={(event) => setExamForm((current) => ({ ...current, start_time: event.target.value }))}
            />
            <input
              type="time"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"
              value={examForm.end_time}
              onChange={(event) => setExamForm((current) => ({ ...current, end_time: event.target.value }))}
            />
            <input
              type="number"
              min="0"
              step="1"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"
              placeholder="Student count"
              value={examForm.student_count}
              onChange={(event) => setExamForm((current) => ({ ...current, student_count: event.target.value }))}
            />
            <input
              type="number"
              min="1"
              max="20"
              step="1"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"
              placeholder="Required invigilators"
              value={examForm.required_invigilators}
              onChange={(event) => setExamForm((current) => ({ ...current, required_invigilators: event.target.value }))}
            />
          </div>

          <textarea
            rows={4}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"
            placeholder="Exam notes / instructions"
            value={examForm.notes}
            onChange={(event) => setExamForm((current) => ({ ...current, notes: event.target.value }))}
          />

          <button
            type="submit"
            disabled={busy || loading}
            className="rounded-xl bg-au-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Creating..." : "Create Exam"}
          </button>
        </form>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold text-au-navy">Exam Schedule</h2>
            <span className="text-xs uppercase tracking-wide text-slate-500">{exams.length} exams</span>
          </div>

          {loading ? (
            <div className="p-6">
              <LoadingState title="Loading exam data" detail="Checking rooms and scheduled exams." />
            </div>
          ) : (
            <div className="max-h-[700px] overflow-auto">
              {exams.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No exams have been scheduled yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Exam</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((exam) => (
                      <tr
                        key={exam.id}
                        className="border-t border-slate-100 transition hover:bg-slate-50"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-au-navy">{exam.course_code}</div>
                          <div className="text-xs text-slate-500">{exam.course_name}</div>
                        </td>
                        <td className="px-4 py-3">{exam.exam_date}</td>
                        <td className="px-4 py-3">{roomMap.get(String(exam.room_id)) || `Room #${exam.room_id}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      </div>

    </div>
  );
}
