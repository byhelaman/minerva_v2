import { useState, useEffect, useCallback } from "react";
import { ScheduleDataTable } from "@/features/schedules/components/table/ScheduleDataTable";
import { getDataSourceColumns } from "./data-source-columns";
import { DataTableColumnHeader } from "@/features/schedules/components/table/data-table-column-header";
import { type ColumnDef } from "@tanstack/react-table";
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
import { STORAGE_KEYS } from "@/lib/constants";

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

// Helper: Matching de columnas con esquema predefinido (ESTRICTO)
const findMatchingColumn = (header: string, predefinedColumns: any[]) => {
    const h = header.toLowerCase().trim();
    // Solo coincidencia exacta por ID o accessorKey
    return predefinedColumns.find((col: any) => (col.accessorKey || col.id) === h);
};

export function ReportsPage() {
    // Estado
    // Inicialización perezosa: Intentar recuperar configuración de LocalStorage inmediatamente
    const [selectedFile, setSelectedFile] = useState<{ id: string; name: string } | null>(() => {
        const stored = localStorage.getItem(STORAGE_KEYS.CONNECTION_CONFIG);
        return stored ? JSON.parse(stored) : null;
    });

    // Inicializar hojas desde localStorage para evitar esqueletos
    const [sheets, setSheets] = useState<WorkbookItem[]>(() => {
        if (!selectedFile?.id) return [];
        const stored = localStorage.getItem(`${STORAGE_KEYS.UI_SHEETS_CACHE_PREFIX}${selectedFile.id}`);
        return stored ? JSON.parse(stored) : [];
    });

    const [selectedSheet, setSelectedSheet] = useState<string | null>(null);

    const [isLoadingSheets, setIsLoadingSheets] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    // Si ya tenemos archivo por localStorage, no bloqueamos la UI con carga inicial
    const [isLoadingFile, setIsLoadingFile] = useState(!selectedFile);

    const { cachedData, cachedSheets, isSyncing: isSyncingBackground, isRestoringCache, fileName: cachedFileName, fileId: cachedFileId, sync } = useLinkedSourceSync();

    const [tableData, setTableData] = useState<ExcelDataRow[]>([]);
    const [tableColumns, setTableColumns] = useState<any[]>([]);
    const [formatError, setFormatError] = useState<string | null>(null);

    // Carga Inicial: Intentar desde caché primero (Backup si localStorage falla pero hook tiene datos)
    useEffect(() => {
        if (cachedData) {
            // Soporte para caché legado (array) y nuevo (objeto multi-hoja)
            // Si hay info del archivo en caché, poblarla para mostrar cabecera
            // Si hay info del archivo en caché, poblarla para mostrar cabecera
            if (cachedFileId && cachedFileName) {
                // Si no hay archivo seleccionado O hay desincronización (caché tiene prioridad)
                if (!selectedFile || selectedFile.id !== cachedFileId) {
                    setSelectedFile({ id: cachedFileId, name: cachedFileName });
                }
            }
        }
        if (cachedSheets && cachedSheets.length > 0) {
            setSheets(cachedSheets);
            // Actualizar localStorage con lo que venga del caché (file system > local storage visual)
            if (cachedFileId) {
                localStorage.setItem(`${STORAGE_KEYS.UI_SHEETS_CACHE_PREFIX}${cachedFileId}`, JSON.stringify(cachedSheets));
            }
        }
    }, [cachedData, cachedSheets, cachedFileId, cachedFileName, selectedFile]);

    // Auto-sincronización si no hay datos en caché y tenemos un archivo seleccionado
    useEffect(() => {
        // Solo intentar sincronizar si ya terminamos de mirar el disco y no encontramos nada,
        // y tenemos un archivo configurado que deberíamos tener.
        if (!isRestoringCache && selectedFile?.id && (!cachedData || (Array.isArray(cachedData) && cachedData.length === 0))) {
            // Pequeño debounce o check extra para no spammear si hay error de sync
            console.log("Cache empty, triggering auto-sync...");
            sync();
        }
    }, [isRestoringCache, cachedData, selectedFile, sync]);

    const validateAndProcessData = useCallback((headers: string[], dataRows: any[]) => {
        const predefinedColumns = getDataSourceColumns();

        // VALIDACIÓN DE FORMATO
        const REQUIRED_COLUMNS = [
            "date", "shift", "branch", "start_time", "end_time", "code", "instructor",
            "program", "minutes", "units", "status", "substitute", "type", "subtype",
            "description", "department", "feedback"
        ];

        // Filtrar encabezados vacíos
        const validHeaders = headers
            .map((header, index) => ({ header, index }))
            .filter(h => h.header.trim() !== "");

        const detectedKeys = validHeaders.map(({ header }) => {
            const match = findMatchingColumn(header, predefinedColumns);
            return match ? (match as any).accessorKey || match.id : null;
        }).filter(Boolean);

        // Generar Columnas
        const headerKeyMap: Record<string, string> = {};
        const isCrowded = validHeaders.length >= 8;

        const dynamicColumns: ColumnDef<ExcelDataRow>[] = validHeaders.map(({ header }, index) => {
            const matchedCol = findMatchingColumn(header, predefinedColumns);
            const schemaKey = matchedCol ? ((matchedCol as any).accessorKey || matchedCol.id) as string : undefined;
            const finalKey = schemaKey || header;

            headerKeyMap[header] = finalKey;

            if (matchedCol) {
                return { ...matchedCol, id: finalKey, accessorKey: finalKey } as ColumnDef<ExcelDataRow>;
            }

            // Fallback styles
            const isFirst = index === 0;
            const shouldUseFixedWidth = isCrowded && isFirst;
            const finalSize = shouldUseFixedWidth ? 120 : undefined;
            const isCentered = shouldUseFixedWidth;

            return {
                id: header,
                accessorKey: finalKey,
                size: finalSize,
                minSize: finalSize,
                header: ({ column }) => <DataTableColumnHeader column={column} title={header} className={isCentered ? "justify-center" : ""} />,
                cell: ({ row }) => <div className={isCentered ? "min-w-[100px] text-center" : "truncate"} title={String(row.getValue(finalKey))}>{row.getValue(finalKey)}</div>
            };
        });

        // Mapear Datos
        const cleanData = dataRows.map((row: any) => {
            // Si row es array (viene de Graph API)
            if (Array.isArray(row)) {
                const obj: any = {};
                headers.forEach((originalHeader, index) => {
                    const keyToUse = headerKeyMap[originalHeader];
                    if (keyToUse) obj[keyToUse] = row[index];
                });
                if (!obj.id) obj.id = crypto.randomUUID();
                return obj;
            }

            // Si row es objeto (viene de caché o procesado previo)
            const newRow: any = { id: row.id || crypto.randomUUID() };
            headers.forEach(originalKey => {
                const newKey = headerKeyMap[originalKey] || originalKey;
                newRow[newKey] = row[originalKey];
            });
            return newRow;
        });

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

        const missingColumns = REQUIRED_COLUMNS.filter(req => !detectedKeys.includes(req));
        if (missingColumns.length > 0) {
            setFormatError('The file does not contain the columns needed to generate the report.');
            return false;
        }

        setFormatError(null);
        return true;
    }, []);

    const processData = useCallback((data: any[]) => {
        if (!data || data.length === 0) {
            setTableData([]);
            setTableColumns([]);
            return;
        }

        const sampleRow = data[0];
        const headers = Object.keys(sampleRow).filter(k => k !== 'id');
        validateAndProcessData(headers, data);
    }, [validateAndProcessData]);

    // Carga Inicial: Verificar archivo persistido
    useEffect(() => {
        const fetchConfig = async () => {
            // Solo mostrar carga si NO tenemos un archivo ya seleccionado (optimista)
            if (!selectedFile) {
                setIsLoadingFile(true);
            }

            try {
                const { data, error } = await supabase.functions.invoke('microsoft-auth', {
                    body: { action: 'status' },
                    method: 'POST'
                });

                if (!error && data?.connected && data?.account?.incidences_file?.id) {
                    const newConfig = {
                        id: data.account.incidences_file.id,
                        name: data.account.incidences_file.name || 'Linked File'
                    };

                    // Actualizar estado y persistir
                    setSelectedFile(newConfig);
                    localStorage.setItem(STORAGE_KEYS.CONNECTION_CONFIG, JSON.stringify(newConfig));
                } else {
                    setSelectedFile(null);
                    localStorage.removeItem(STORAGE_KEYS.CONNECTION_CONFIG);
                }
            } catch (error) {
                // setSelectedFile(null); // Keep handling offline tolerance
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
            try {
                // Solo mostrar carga si no tenemos hojas y no estamos tirando de cache
                if (sheets.length === 0 && (!cachedSheets || cachedSheets.length === 0)) {
                    setIsLoadingSheets(true);
                }
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
                // Persistir hojas actualizadas
                localStorage.setItem(`${STORAGE_KEYS.UI_SHEETS_CACHE_PREFIX}${selectedFile.id}`, JSON.stringify(items));


                // Validar la selección actual o aplicar fallback
                // Si ya tenemos una hoja seleccionada (optimista), verificar que exista en la nueva lista
                if (selectedSheet) {
                    const exists = items.some(i => i.id === selectedSheet);
                    if (!exists) {
                        // Si la hoja seleccionada optimísticamente no existe en realidad, reiniciar
                        applyFallbackSelection(items);
                    }
                } else {
                    // Si no hay selección, intentar recuperar de storage o aplicar fallback
                    const storedSheetId = localStorage.getItem(`${STORAGE_KEYS.UI_LAST_VIEWED_SHEET_PREFIX}${selectedFile.id}`);
                    const storedItem = items.find(i => i.id === storedSheetId);

                    if (storedItem) {
                        setSelectedSheet(storedItem.id);
                    } else {
                        applyFallbackSelection(items);
                    }
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

        const applyFallbackSelection = (items: WorkbookItem[]) => {
            const firstTable = items.find(i => i.type === 'table');
            if (firstTable) {
                setSelectedSheet(firstTable.id);
            } else if (items.length > 0) {
                setSelectedSheet(null);
            }
        };

        fetchSheets();
    }, [selectedFile, cachedData, cachedSheets]); // ¿Se agregó cachedData a dependencias? No.

    // Selección Optimista: Intentar establecer hoja desde LocalStorage o Caché inmediatamente
    useEffect(() => {
        if (selectedFile?.id && !selectedSheet) {
            // 1. Intentar LocalStorage
            const stored = localStorage.getItem(`${STORAGE_KEYS.UI_LAST_VIEWED_SHEET_PREFIX}${selectedFile.id}`);
            if (stored) {
                setSelectedSheet(stored);
                return;
            }

            // 2. Intentar inferir de CachedData (si es estructura nueva)
            if (cachedData && !Array.isArray(cachedData)) {
                const keys = Object.keys(cachedData);
                if (keys.length > 0) {
                    setSelectedSheet(keys[0]);
                }
            }
        }
    }, [selectedFile, cachedData, selectedSheet]);

    // Persistir selección de hoja
    useEffect(() => {
        if (selectedFile?.id && selectedSheet) {
            localStorage.setItem(`${STORAGE_KEYS.UI_LAST_VIEWED_SHEET_PREFIX}${selectedFile.id}`, selectedSheet);
        }
    }, [selectedFile, selectedSheet]);

    const fetchData = useCallback(async () => {

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

        // Si aún no tenemos la lista de hojas (metadatos), no podemos saber si llamar a /table o /sheet.
        // Esperamos a que 'sheets' se cargue (lo cual disparará este efecto nuevamente).
        if (sheets.length === 0) {
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

            // Usar la función de validación unificada
            validateAndProcessData(headers, dataRows);


        } catch (error) {
            console.error("Failed to fetch data", error);
            toast.error("Could not load sheet data");
        } finally {
            setIsLoadingData(false);
        }
    }, [selectedFile, selectedSheet, sheets, cachedData, processData, validateAndProcessData]);

    // Obtener Datos cuando cambia la Hoja
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Estado de carga global
    // 1. Bootstrapping: Bloquear solo si no tenemos datos mostrados (para evitar pantallazo de carga si hay caché)
    const isBootstrapping = (isLoadingFile || isRestoringCache) && tableData.length === 0;
    // 2. Acciones explícitas: Bloquear siempre para dar feedback (Sync manual, cambio de hoja)
    // NOTA: Incluimos isLoadingSheets solo si la tabla está vacía para evitar flash de carga si ya tenemos caché
    const isWorking = isSyncingBackground || (selectedFile && (isLoadingData || (isLoadingSheets && sheets.length === 0)));

    const isLoading = isBootstrapping || isWorking;

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
                        {/* Solo mostrar esqueletos si estamos cargando Y no hay hojas para mostrar */}
                        {(isLoadingSheets || isLoadingFile) && sheets.length === 0 ? (
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
                                    {/* Mostrar título si tenemos hoja seleccionada, aunque estemos validando archivo */}
                                    {((isLoadingSheets || isLoadingFile) && !selectedSheet) ? (
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
                                            {/* Header Content */}
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
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <p className="text-sm font-medium">
                                            {isSyncingBackground ? "Updating reports..." : (isLoadingFile ? "Connecting to Microsoft..." : (isLoadingSheets ? "Loading worksheets..." : "Downloading data..."))}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {isSyncingBackground
                                                ? "Syncing data with Microsoft Excel"
                                                : (isLoadingData ? "Reading data may take a few seconds." : "Please wait while we fetch the latest info")
                                            }
                                        </p>
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
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setFormatError(null)}
                                        className="mt-2"
                                    >
                                        Load anyway
                                    </Button>
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
