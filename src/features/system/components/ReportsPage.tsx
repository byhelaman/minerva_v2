import { useState, useEffect, useCallback } from "react";
import { ScheduleDataTable } from "@/features/schedules/components/table/ScheduleDataTable";
import { getDataSourceColumns } from "./data-source-columns";
import { DataTableColumnHeader } from "@/features/schedules/components/table/data-table-column-header";
import { type ColumnDef, type Column, type Row } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { ReportRowActions } from "./ReportRowActions";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Database, Loader2, ShieldAlert, Table as TableIcon, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
    Empty,
    EmptyHeader,
    EmptyTitle,
    EmptyDescription,
    EmptyMedia,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useLinkedSourceSync } from "../hooks/useLinkedSourceSync";

// Interfaces
interface WorkbookItem {
    id: string;
    name: string;
    position?: number;
    visibility?: string;
    type: 'sheet' | 'table';
}

interface ExcelDataRow {
    [key: string]: any;
}

// Helper: Matching de columnas con esquema predefinido
const findMatchingColumn = (header: string, predefinedColumns: any[]) => {
    const h = header.toLowerCase().trim();
    // 1. Exact match
    const exact = predefinedColumns.find((col: any) => (col.accessorKey || col.id) === h);
    if (exact) return exact;
    // 2. Partial match with rules
    return predefinedColumns.find((col: any) => {
        const key = (col.accessorKey || col.id) as string;
        if (!key) return false;
        if (key === "date" && h.includes("date")) return true;
        if (key === "branch" && h.includes("branch")) return true;
        if (key === "instructor" && h.includes("instructor")) return true;
        if (key === "program" && h.includes("program")) return true;
        if (key === "minutes" && h.includes("mins")) return true;
        if (key === "units" && h.includes("units")) return true;
        if (key === "type" && h.includes("subtype")) return false;
        return h.includes(key.toLowerCase());
    });
};

export function ReportsPage() {
    // Estado
    const [selectedFile, setSelectedFile] = useState<{ id: string; name: string } | null>(null);
    const [sheets, setSheets] = useState<WorkbookItem[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string | null>(null);

    const [isLoadingSheets, setIsLoadingSheets] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isLoadingFile, setIsLoadingFile] = useState(true);

    const { cachedData, isSyncing: isSyncingBackground, isRestoringCache, fileName: cachedFileName, fileId: cachedFileId, sync } = useLinkedSourceSync();

    const [tableData, setTableData] = useState<ExcelDataRow[]>([]);
    const [tableColumns, setTableColumns] = useState<any[]>([]);
    const [formatError, setFormatError] = useState<string | null>(null);

    // Carga Inicial: Intentar desde caché primero
    useEffect(() => {
        if (cachedData) {
            // Soporte para caché legado (array) y nuevo (objeto multi-hoja)
            // Si hay info del archivo en caché, poblarla para mostrar cabecera
            if (cachedFileId && cachedFileName) {
                setSelectedFile({ id: cachedFileId, name: cachedFileName });
            }
        }
    }, [cachedData, cachedFileId, cachedFileName]);

    const processData = (data: any[]) => {
        if (!data || data.length === 0) {
            setTableData([]);
            setTableColumns([]);
            return;
        }

        const sampleRow = data[0];
        const headers = Object.keys(sampleRow).filter(k => k !== 'id');

        const predefinedColumns = getDataSourceColumns();

        const headerKeyMap: Record<string, string> = {};

        const dynamicColumns: ColumnDef<ExcelDataRow>[] = headers.map((key) => {
            const matchedCol = findMatchingColumn(key, predefinedColumns);

            // Si coincide, usar la clave del esquema. Si no, usar la clave cruda.
            const schemaKey = matchedCol ? ((matchedCol as any).accessorKey || matchedCol.id) as string : key;
            headerKeyMap[key] = schemaKey;

            if (matchedCol) {
                return { ...matchedCol, id: schemaKey, accessorKey: schemaKey } as ColumnDef<ExcelDataRow>;
            }

            return {
                id: key,
                accessorKey: key,
                header: ({ column }) => <DataTableColumnHeader column={column} title={key} />,
                cell: ({ row }) => <div className="truncate">{row.getValue(key)}</div>
            };
        });

        // Remapear datos para usar claves del esquema
        const cleanData = data.map(row => {
            const newRow: any = { id: row.id || crypto.randomUUID() };
            headers.forEach(originalKey => {
                const newKey = headerKeyMap[originalKey] || originalKey;
                newRow[newKey] = row[originalKey];
            });
            return newRow;
        });

        // Columna de Selección y Acciones (reutilizar estándar)
        // ... (Omitido por brevedad, pero necesito incluirlos en el contenido de reemplazo)

        // ... Re-declarando columnas estándar para inclusión en reemplazo ...
        const selectColumn: ColumnDef<ExcelDataRow> = {
            id: "select",
            size: 36,
            header: ({ table }) => (
                <div className="flex justify-center items-center mb-1">
                    <Checkbox
                        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                        aria-label="Select all"
                        className="translate-y-[2px]"
                    />
                </div>
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                        className="translate-y-[2px] mb-1"
                    />
                </div>
            ),
            enableSorting: false,
            enableHiding: false,
        };

        const actionColumn: ColumnDef<ExcelDataRow> = {
            id: "actions",
            size: 50,
            cell: ({ row }) => <ReportRowActions row={row} />,
            enableHiding: false,
        };

        setTableColumns([selectColumn, ...dynamicColumns, actionColumn]);
        setTableData(cleanData);
    };

    // Carga Inicial: Verificar archivo persistido
    useEffect(() => {
        const fetchConfig = async () => {
            setIsLoadingFile(true);
            try {
                const { data, error } = await supabase.functions.invoke('microsoft-auth', {
                    body: { action: 'status' },
                    method: 'POST'
                });

                if (!error && data?.connected && data?.account?.incidences_file?.id) {
                    setSelectedFile({
                        id: data.account.incidences_file.id,
                        name: data.account.incidences_file.name || 'Linked File'
                    });
                } else {
                    setSelectedFile(null);
                }
            } catch (error) {
                setSelectedFile(null);
                console.error("Failed to load config", error);
            } finally {
                setIsLoadingFile(false);
            }
        };
        fetchConfig();
    }, []);

    // Obtener Hojas cuando cambia el archivo
    useEffect(() => {
        if (!selectedFile?.id) {
            setSheets([]);
            setSelectedSheet(null);
            return;
        }

        const fetchSheets = async () => {
            // ... lógica de obtención existente ...
            // Podemos seguir obteniendo hojas en segundo plano para poblar la barra lateral,
            // pero la tabla ya debería mostrar datos en caché.

            // Mantener lógica no relacionada sin cambios por ahora, enfocarse en consumo de datos.

            try {
                setIsLoadingSheets(true);
                const { data, error } = await supabase.functions.invoke('microsoft-graph', {
                    body: {
                        action: 'list-content',
                        fileId: selectedFile.id
                    },
                    method: 'POST'
                });

                if (error) throw error;

                const items = data.value as WorkbookItem[];
                setSheets(items);

                // Seleccionar tabla/hoja por defecto si no hay selección
                const firstTable = items.find(i => i.type === 'table');
                if (firstTable) {
                    setSelectedSheet(firstTable.id);
                } else if (items.length > 0) {
                    setSelectedSheet(null);
                }

            } catch (error) {
                console.error("Failed to fetch worksheets", error);

                // Si fallan las hojas pero tenemos caché, ¿seguimos bien?
                if (cachedData.length === 0) {
                    toast.error("Could not load worksheets");
                }
            } finally {
                setIsLoadingSheets(false);
            }
        };

        fetchSheets();
    }, [selectedFile, cachedData]); // ¿Se agregó cachedData a dependencias? No.

    const fetchData = useCallback(async () => {
        // Esta función obtiene datos en vivo.
        // Si se llama manualmente (actualizar) -> Hacer fetch.
        // Al montar/cambiar hoja -> ¿Verificar si debemos hacer fetch o usar caché?

        // Si tenemos datos en caché y son suficientemente frescos (o simplemente existen), ¿quizás no auto-fetch datos en vivo?
        // El usuario pidió "leer del archivo cargado en segundo plano".
        // Así que `fetchData` debería probablemente ser reemplazado o aumentado por `loadFromCache`.

        // ¿Hacer que `fetchData` realmente dispare la Sincronización en Segundo Plano en lugar de fetch directo?
        // ¿O fetch directo como "Forzar Actualización"?

        // Estrategia:
        // 1. App carga -> Sync Segundo Plano corre -> Caché actualiza -> `cachedData` actualiza -> `processData` corre -> Tabla actualiza.
        // 2. DataSourcesPage monta -> ve `cachedData` -> lo muestra.
        // 3. `fetchData` (En Vivo) es ahora opcional.

        // Deberíamos deshabilitar el auto-fetch en `useEffect` si tenemos caché.

        if (cachedData) {
            let hit = null;
            if (Array.isArray(cachedData) && cachedData.length > 0) {
                hit = cachedData; // Soporte legado
                // ¿Solo usar caché legado si no tenemos selección de hoja o coincide?
                // Para legado, asumimos que coincide con la primera hoja o lo que se haya sincronizado.
            } else if (!Array.isArray(cachedData) && selectedSheet && cachedData[selectedSheet]) {
                hit = cachedData[selectedSheet];
            }

            if (hit && hit.length > 0) {
                processData(hit);
                return; // Omitir fetch en vivo si existe caché para esta hoja
            }
        }

        if (!selectedFile?.id || !selectedSheet) {
            setTableData([]);
            setTableColumns([]);
            return;
        }

        try {
            setIsLoadingData(true);
            const selectedItem = sheets.find(s => s.id === selectedSheet);
            const isTable = selectedItem?.type === 'table';

            // Primero obtener el rango para determinar dimensiones y contenido
            const payload: any = {
                action: 'get-range',
                fileId: selectedFile.id
            };

            if (isTable) {
                payload.tableId = selectedSheet;
            } else {
                payload.sheetId = selectedSheet;
            }

            const { data, error } = await supabase.functions.invoke('microsoft-graph', {
                body: payload,
                method: 'POST'
            });

            if (error) throw error;

            // Procesar Datos
            // data.text es un array 2D: [ ["Col1", "Col2"], ["Val1", "Val2"] ]
            const rawRows = data.text;
            if (!rawRows || rawRows.length === 0) {
                setTableData([]);
                setTableColumns([]);
                return;
            }

            // Asumir que la primera fila es encabezado
            const headers = rawRows[0].map((h: any) => String(h || ""));
            const dataRows = rawRows.slice(1);

            // Filtrar encabezados vacíos y mantener seguimiento del índice original
            const validHeaders = headers
                .map((header: string, index: number) => ({ header, index }))
                .filter((h: { header: string, index: number }) => h.header.trim() !== "");

            const isCrowded = validHeaders.length >= 8;

            // Generar columnas dinámicas basadas en encabezados válidos
            const predefinedColumns = getDataSourceColumns();
            // Inicializar mapa para almacenar mapeo Encabezado -> Clave de Esquema
            const headerKeyMap: Record<string, string> = {};


            // VALIDACIÓN DE FORMATO
            const REQUIRED_COLUMNS = [
                "date", "shift", "branch", "start_time", "end_time", "code", "instructor",
                "program", "minutes", "units", "status", "substitute", "type", "subtype",
                "description", "department", "feedback"
            ];

            const detectedKeys = validHeaders.map(({ header }: { header: string }) => {
                const match = findMatchingColumn(header, predefinedColumns);
                return match ? (match as any).accessorKey || match.id : null;
            }).filter(Boolean);

            const missingColumns = REQUIRED_COLUMNS.filter(req => !detectedKeys.includes(req));

            if (missingColumns.length > 0) {
                setFormatError('The file does not have the required format.');
                setTableData([]);
                setTableColumns([]);
                setIsLoadingData(false);
                return;
            } else {
                setFormatError(null);
            }

            const dynamicColumns: ColumnDef<ExcelDataRow>[] = validHeaders.map(({ header }: { header: string }, index: number) => {
                const matchedCol = findMatchingColumn(header, predefinedColumns);

                // Determinar la clave para mapeo de datos (Clave de Esquema si coincide, sino encabezado)
                const schemaKey = matchedCol ? ((matchedCol as any).accessorKey || matchedCol.id) as string : undefined;
                const finalKey = schemaKey || header;

                // LLENAR EL MAPA
                headerKeyMap[header] = finalKey;

                // Si encontramos coincidencia en el esquema, usar su definición directamente
                if (matchedCol) {
                    return {
                        ...matchedCol,
                        id: finalKey,
                        accessorKey: finalKey,
                    } as ColumnDef<ExcelDataRow>;
                }

                // Fallback para columnas no coincidentes
                // Determinar estilos solo para columnas desconocidas (ej. primera columna fija si está llena)
                const isFirst = index === 0;
                const shouldUseFixedWidth = isCrowded && isFirst;
                const finalSize = shouldUseFixedWidth ? 120 : undefined;
                const isCentered = shouldUseFixedWidth;

                return {
                    id: header,
                    accessorKey: finalKey,
                    size: finalSize,
                    minSize: finalSize,
                    header: ({ column }: { column: Column<ExcelDataRow> }) => (
                        <DataTableColumnHeader
                            column={column}
                            title={header}
                            className={isCentered ? "justify-center" : ""}
                        />
                    ),
                    cell: ({ row }: { row: Row<ExcelDataRow> }) => (
                        <div
                            className={isCentered ? "min-w-[100px] text-center" : "truncate"}
                            title={String(row.getValue(finalKey))}
                        >
                            {row.getValue(finalKey)}
                        </div>
                    ),
                };
            });

            // Transformar filas a objetos usando encabezados válidos
            const mappedData = dataRows.map((row: any[]) => {
                const obj: any = {};
                // headers es el array original incluyendo vacíos, pero solo nos importa el mapeo de validHeaders
                // Debemos iterar encabezados originales para coincidir con índice de fila
                headers.forEach((originalHeader: string, index: number) => {
                    // Usar el mapa para obtener la clave correcta (ej. 'instructor' en lugar de 'Instructor')
                    const keyToUse = headerKeyMap[originalHeader];
                    if (keyToUse) {
                        obj[keyToUse] = row[index];
                    }
                });

                // Fallbacks/Valores por defecto para claves estándar faltantes para evitar errores de tabla
                if (!obj.id) obj.id = crypto.randomUUID();
                return obj;
            });

            // Columna de Selección Estándar
            const selectColumn: ColumnDef<ExcelDataRow> = {
                id: "select",
                size: 36,
                header: ({ table }) => (
                    <div className="flex justify-center items-center mb-1">
                        <Checkbox
                            checked={
                                table.getIsAllPageRowsSelected() ||
                                (table.getIsSomePageRowsSelected() && "indeterminate")
                            }
                            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                            aria-label="Select all"
                            className="translate-y-[2px]"
                        />
                    </div>
                ),
                cell: ({ row }) => (
                    <div className="flex justify-center">
                        <Checkbox
                            checked={row.getIsSelected()}
                            onCheckedChange={(value) => row.toggleSelected(!!value)}
                            aria-label="Select row"
                            className="translate-y-[2px] mb-1"
                        />
                    </div>
                ),
                enableSorting: false,
                enableHiding: false,
            };

            // Columna de Acciones Estándar
            const actionColumn: ColumnDef<ExcelDataRow> = {
                id: "actions",
                size: 50,
                cell: ({ row }) => <ReportRowActions row={row} />,
                enableHiding: false,
            };

            setTableColumns([selectColumn, ...dynamicColumns, actionColumn]);
            setTableData(mappedData);

        } catch (error) {
            console.error("Failed to fetch data", error);
            toast.error("Could not load sheet data");
        } finally {
            setIsLoadingData(false);
        }
    }, [selectedFile, selectedSheet, sheets]);

    // Obtener Datos cuando cambia la Hoja
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Estado de carga global - Solo bloqueante si NO tenemos datos mostrandose
    const isLoading = (isLoadingFile || (selectedFile && (isLoadingSheets || isLoadingData))) && tableData.length === 0;

    // Empty state solo si no estamos restaurando cache, no está cargando archivo, y no hay archivo ni datos
    const showEmptyState = !isLoadingFile && !selectedFile && !isRestoringCache && tableData.length === 0;

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-row items-center justify-between py-8 my-4 gap-1 flex-none">
                <div className="flex flex-col gap-1">
                    <h1 className="text-xl font-bold tracking-tight">Reports</h1>
                    <p className="text-muted-foreground">View daily reports from linked sources</p>
                </div>
                {(selectedFile || isLoadingFile || isRestoringCache) && (
                    <div className="flex items-center gap-3 px-3 py-2 min-w-44 border rounded-md border-dashed bg-muted/40">
                        {isLoadingFile || isRestoringCache || (isLoading && !selectedFile) ? (
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-8 w-8 rounded-md" />
                                <div className="flex flex-col gap-1">
                                    <Skeleton className="h-3 w-20" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                            </div>
                        ) : (
                            selectedFile && (
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-md">
                                        <FileSpreadsheet className="h-4 w-4 text-green-600 dark:text-green-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-muted-foreground font-medium">Linked Source</span>
                                        <span className="text-sm font-semibold max-w-[200px] truncate">{selectedFile.name}</span>
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>

            {showEmptyState ? (
                <Empty className="min-h-[400px]">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <ShieldAlert />
                        </EmptyMedia>
                        <EmptyTitle>No reports loaded.</EmptyTitle>
                        <EmptyDescription>
                            Connect a Microsoft account and select a file to view reports.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <div className="grid gap-8 md:grid-cols-[200px_1fr] h-full">
                    {/* Sidebar */}
                    <aside className="hidden md:flex flex-col gap-1 flex-none p-1">
                        <h3 className="text-sm font-medium text-muted-foreground px-2 mb-2">Worksheets</h3>
                        {isLoadingSheets || isLoadingFile ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className="h-9 w-full" />
                            ))
                        ) : (
                            sheets.map((item) => (
                                <Button
                                    key={item.id}
                                    variant={selectedSheet === item.id ? "secondary" : "ghost"}
                                    className={cn("justify-start gap-2 h-9", selectedSheet === item.id && "text-primary")}
                                    disabled={item.type === 'sheet'}
                                    onClick={() => setSelectedSheet(item.id)}
                                >
                                    {item.type === 'table' ? (
                                        <TableIcon className="h-4 w-4 opacity-70" />
                                    ) : (
                                        <Database className="h-4 w-4 opacity-70" />
                                    )}
                                    <span className="truncate">{item.name}</span>
                                </Button>
                            ))
                        )}
                    </aside>

                    {/* Contenido Principal */}
                    <div className="overflow-hidden px-1 pb-1 flex flex-col h-full">
                        {/* Sección de Encabezado */}
                        <div className="flex items-center justify-between pb-4 flex-none">
                            <div className="flex items-center justify-between mb-0">
                                <div>
                                    {isLoadingSheets || isLoadingFile || !selectedSheet ? (
                                        <div className="flex flex-col gap-2">
                                            <Skeleton className="h-7 w-48" />
                                            <div className="flex items-center gap-2">
                                                <Skeleton className="h-4 w-24" />
                                                <Skeleton className="h-4 w-4 rounded-full" />
                                                <Skeleton className="h-4 w-20" />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <h2 className="text-lg font-semibold tracking-tight">
                                                {sheets.find(s => s.id === selectedSheet)?.name || 'Sheet'}
                                            </h2>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <span className="capitalize">Sheet Preview</span>
                                                <span>•</span>
                                                {isLoadingData ? (
                                                    <Skeleton className="h-4 w-20 inline-block align-middle" />
                                                ) : (
                                                    <span>{tableData.length} Records</span>
                                                )}
                                                <Badge variant="outline">Read-only</Badge>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {isLoading ? (
                                    <Skeleton className="h-4 w-24 hidden sm:block" />
                                ) : (
                                    <div className="text-right hidden sm:block">
                                        <p className="text-sm text-muted-foreground">
                                            Up to date
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sección del Cuerpo */}
                        <div className="flex-1 overflow-hidden flex flex-col">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center gap-2 h-full border border-dashed rounded-lg bg-muted/10 p-8 min-h-[400px]">
                                    <div className="relative flex items-center justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    </div>
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="font-medium text-foreground text-sm">
                                            {isLoadingFile && "Connecting to Microsoft..."}
                                            {!isLoadingFile && isLoadingSheets && "Loading worksheets..."}
                                            {!isLoadingFile && !isLoadingSheets && isLoadingData && "Downloading data..."}
                                        </span>
                                        <span className="text-muted-foreground text-xs text-center max-w-[300px]">
                                            {isLoadingData && "Reading data may take a few seconds."}
                                        </span>
                                    </div>
                                </div>
                            ) : formatError ? (
                                <div className="flex flex-col items-center justify-center gap-2 h-full border border-dashed rounded-lg bg-muted/10 p-8 min-h-[400px]">
                                    <div className="relative flex items-center justify-center">
                                        <AlertCircle className="h-6 w-6" />
                                    </div>
                                    <div className="flex flex-col gap-1 text-center max-w-[240px]">
                                        <div className="font-medium text-sm">Format Error</div>
                                        <div className="text-muted-foreground text-xs">
                                            {formatError}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-auto">
                                    <ScheduleDataTable
                                        columns={tableColumns}
                                        data={tableData}
                                        hideFilters={true}
                                        hideUpload={true}
                                        hideActions={true}
                                        hideOverlaps={true}
                                        initialColumnVisibility={{
                                            shift: false,
                                            end_time: false,
                                            code: false,
                                            minutes: false,
                                            units: false,
                                            substitute: false,
                                            type: false,
                                            subtype: false,
                                            description: false,
                                            department: false,
                                            feedback: false,
                                        }}
                                        initialPageSize={100}
                                        onRefresh={() => sync()}
                                        disableRefresh={isSyncingBackground}
                                        isRefreshing={isSyncingBackground}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
