import { useMemo } from "react";
import { useZoomStore } from "@/features/matching/stores/useZoomStore";

export function useInstructors() {
    const { users } = useZoomStore();

    const instructors = useMemo(() => {
        const uniqueInstructors = new Set<string>();

        // Solo usuarios de Zoom (los que están sincronizados)
        users.forEach(u => {
            if (u.display_name) uniqueInstructors.add(u.display_name);
        });

        return Array.from(uniqueInstructors).sort();
    }, [users]);

    return instructors;
}
