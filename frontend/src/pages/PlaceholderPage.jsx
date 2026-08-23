import { useOutletContext } from "react-router-dom";

export default function PlaceholderPage({ title, description }) {
  useOutletContext();
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-sm text-slate-500">Coming soon</p>
      <h1 className="mt-1 text-2xl font-semibold text-au-navy">{title}</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        {description ||
          "This page is reserved to match your mockup navigation. It will be connected to the backend in a later step."}
      </p>
    </div>
  );
}
