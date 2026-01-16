import { useMemo } from "react";
import { Schedule } from "../utils/excel-parser";
import { useZoomStore } from "@/features/matching/stores/useZoomStore";

export function useInstructors(schedules: Schedule[]) {
    const { users } = useZoomStore();

    const instructors = useMemo(() => {
        const uniqueInstructors = new Set<string>();

        // 1. From Schedules (Excel)
        schedules.forEach(s => {
            if (s.instructor) uniqueInstructors.add(s.instructor);
        });

        // 2. From Zoom Users (candidates)
        users.forEach(u => {
            if (u.display_name) uniqueInstructors.add(u.display_name);
            // Optionally add full name if needed
            // if (u.first_name || u.last_name) uniqueInstructors.add(`${u.first_name} ${u.last_name}`.trim());
        });

        return Array.from(uniqueInstructors).sort();
    }, [schedules, users]);

    return instructors;
}
