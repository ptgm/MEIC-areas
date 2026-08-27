from __future__ import annotations

import ast
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
DATA_JS_PATH = ROOT / "data.js"
DEFAULT_OUTPUT_PATH = ROOT / "data_enrolments.js"
DEFAULT_TIMESTAMP_OUTPUT_PATH = ROOT / "data_last_updated.js"
DEGREE_ID = "2761663971475"  # MEIC-A


def read_course_metadata() -> dict[str, dict[str, object]]:
    text = DATA_JS_PATH.read_text(encoding="utf-8")
    match = re.search(r"const courseMetadataByAcronym = (\{.*?\n\});\n\nconst areasMEIC2026 =", text, re.S)
    if not match:
        raise RuntimeError("Could not find course metadata in data.js")

    metadata_as_python = re.sub(
        r"(?m)^(\s*)([A-Za-z_$][\w$]*)(\s*:)",
        r'\1"\2"\3',
        match.group(1),
    )
    metadata_as_python = re.sub(
        r"(?<=:\s)\bnull\b",
        "None",
        metadata_as_python,
    )
    return ast.literal_eval(metadata_as_python)


def get_courses(degree: str) -> dict[str, dict[str, object]]:
    base_url = f"https://fenix.tecnico.ulisboa.pt/api/fenix/v1/degrees/{degree}/courses?academicTerm=2026/2027"
    try:
        response = requests.get(base_url, timeout=30)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(f"Error fetching courses data: {exc}") from exc

    data = response.json()
    courses = {
        course["acronym"]: {
            "id": course["id"],
            "name": course["name"],
            "sem": course["academicTerm"],
            "acronym": course["acronym"],
        }
        for course in data
        if course.get("acronym") is not None
    }
    return courses


def get_students(course_id: object) -> int:
    base_url = f"https://fenix.tecnico.ulisboa.pt/api/fenix/v1/courses/{course_id}/students"
    response = requests.get(base_url, timeout=30)
    if response.status_code != 200:
        raise ValueError("Error fetching students data. Check course key")

    data = response.json()
    return int(data["attendingCount"])


def build_enrolments_data(degree: str) -> dict[str, int | None]:
    try:
        courses = get_courses(degree)
    except Exception:
        return {}

    metadata = read_course_metadata()

    enrolments: dict[str, int | None] = {}
    for course_key, course_data in metadata.items():
        fenix_acronym = course_data.get("fenixAcronym")
        if not isinstance(fenix_acronym, str) or not fenix_acronym:
            continue

        course = courses.get(fenix_acronym)
        if course is None:
            continue

        try:
            enrolments[course_key] = get_students(course["id"])
        except Exception:
            enrolments[course_key] = None

    return enrolments


def write_enrolments_file(output_path: Path, enrolments: dict[str, int | None]) -> None:
    lines = ["window.courseEnrolmentsByAcronym = {"]
    for acronym in sorted(enrolments):
        value = enrolments[acronym]
        if value is None:
            rendered = "null"
        else:
            rendered = str(value)
        lines.append(f'    "{acronym}": {rendered},')
    lines.append("};")
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_last_updated_file(output_path: Path, timestamp: str) -> None:
    output_path.write_text(
        f'window.lastUpdatedTimestamp = "{timestamp}";\n',
        encoding="utf-8",
    )


if __name__ == "__main__":
    output_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_OUTPUT_PATH
    try:
        enrolments = build_enrolments_data(DEGREE_ID)
    except Exception as exc:
        print(f"Warning: {exc}; writing empty enrolment data", file=sys.stderr)
        enrolments = {}

    if enrolments:
        write_enrolments_file(output_path, enrolments)
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        write_last_updated_file(DEFAULT_TIMESTAMP_OUTPUT_PATH, timestamp)
        print(f"Wrote {output_path} and {DEFAULT_TIMESTAMP_OUTPUT_PATH}")
    else:
        print("Warning: no enrolment data fetched; keeping existing file.", file=sys.stderr)


