export const UFM_PENALTIES = Object.freeze([
  { value: "F_GRADE", label: "F grade in the affected course" },
  { value: "FINE", label: "Penalty fine" },
  {
    value: "SEMESTER_RELEGATION",
    label: "Relegation for the entire semester",
  },
  {
    value: "SEMESTER_F_ALL_SUBJECTS",
    label: "F grade in all subjects of the semester",
  },
  { value: "EXPULSION", label: "Expulsion from the university" },
]);

export function penaltyLabel(value) {
  return UFM_PENALTIES.find((penalty) => penalty.value === value)?.label || value;
}
