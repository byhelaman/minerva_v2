import { useEffect } from "react";
import { useLinkedSourceSync } from "../hooks/useLinkedSourceSync";

export function BackgroundSyncer() {
    const { sync } = useLinkedSourceSync();

    useEffect(() => {
        // Initial sync on mount
        const timeout = setTimeout(() => {
            sync();
        }, 3000); // 3-second delay to prioritize initial UI render

        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Intentional: only run once on mount

    return null;
}
