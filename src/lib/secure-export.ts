
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface SaveFileOptions {
    title?: string;
    defaultName: string;
    content: Uint8Array | number[];
    openAfterExport?: boolean;
}

/**
 * Guarda un archivo de forma segura invocando el diálogo nativo del sistema.
 * Permite guardar fuera del sandbox sin comprometer la seguridad de la app.
 * Retorna true si se guardó, false si se canceló.
 */
export async function secureSaveFile({
    title = "Save File",
    defaultName,
    content,
    openAfterExport = true
}: SaveFileOptions): Promise<boolean> {
    try {
        // Convert to Array.from if it's strictly typed as Uint8Array, as Tauri invokes expects serialization
        // number[] is safe for Vec<u8>
        const body = content instanceof Uint8Array ? Array.from(content) : content;

        const saved = await invoke<boolean>("save_file", {
            title,
            defaultName,
            content: body,
            openFile: openAfterExport
        });

        return saved;
    } catch (error) {
        console.error("Failed to save file:", error);
        toast.error("Failed to save file: " + String(error));
        throw error;
    }
}

