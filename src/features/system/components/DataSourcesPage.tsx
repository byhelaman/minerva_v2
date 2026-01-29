import { useState, useEffect, useCallback } from "react";
import { ScheduleDataTable } from "@/features/schedules/components/table/ScheduleDataTable";
import { getDataSourceColumns } from "./data-source-columns";
import { DataTableColumnHeader } from "@/features/schedules/components/table/data-table-column-header";
import { type ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableRowActions } from "@/features/schedules/components/table/data-table-row-actions";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Database, Loader2, ShieldAlert, Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";
// Eliminadas importaciones no utilizadas
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

export function DataSourcesPage() {
    // Estado
    const [selectedFile, setSelectedFile] = useState<{ id: string; name: string } | null>(null);
    const [sheets, setSheets] = useState<WorkbookItem[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string | null>(null);

    const [isLoadingSheets, setIsLoadingSheets] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isLoadingFile, setIsLoadingFile] = useState(true);

    const [tableData, setTableData] = useState<ExcelDataRow[]>([]);
    const [tableColumns, setTableColumns] = useState<any[]>([]);

    // Carga Inicial: Verificar archivo persistido
    useEffect(() => {
        const fetchConfig = async () => {
            setIsLoadingFile(true);
            try {
                const { data, error } = await supabase.functions.invoke('microsoft-auth', {
                    body: { action: 'status' },
                    method: 'POST'
                });

                if (!error && data?.connected && data?.account?.file_id) {
                    setSelectedFile({
                        id: data.account.file_id,
                        name: data.account.file_name || 'Linked File'
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

                // data.value contiene una mezcla de hojas y tablas
                const items = data.value as WorkbookItem[];
                setSheets(items);

                // Seleccionar automáticamente la primera tabla, o nada si solo existen hojas (ya que están deshabilitadas)
                const firstTable = items.find(i => i.type === 'table');
                if (firstTable) {
                    setSelectedSheet(firstTable.id);
                } else if (items.length > 0) {
                    // Seleccionar solo la primera tabla.
                    setSelectedSheet(null);
                }

            } catch (error) {
                console.error("Failed to fetch worksheets", error);
                toast.error("Could not load worksheets");
            } finally {
                setIsLoadingSheets(false);
            }
        };

        fetchSheets();
    }, [selectedFile]);

    const fetchData = useCallback(async () => {
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

            const findMatchingColumn = (header: string) => {
                const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
                // Intentar coincidencia exacta en accessorKey o palabras clave específicas
                return predefinedColumns.find((col: any) => {
                    const key = (col.accessorKey || col.id) as string;
                    if (!key) return false;

                    if (key === "date" && (h.includes("date"))) return true;
                    if (key === "branch" && (h.includes("branch"))) return true;
                    if (key === "instructor" && (h.includes("instructor"))) return true;
                    if (key === "program" && (h.includes("program"))) return true;
                    if (key === "minutes" && (h.includes("mins"))) return true;
                    if (key === "units" && (h.includes("units"))) return true;

                    // Fallback a contención simple
                    return h.includes(key.toLowerCase());
                });
            };

            const dynamicColumns: ColumnDef<ExcelDataRow>[] = validHeaders.map(({ header }: { header: string }, index: number) => {
                const matchedCol = findMatchingColumn(header);

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
                    header: ({ column }) => (
                        <DataTableColumnHeader
                            column={column}
                            title={header}
                            className={isCentered ? "justify-center" : ""}
                        />
                    ),
                    cell: ({ row }) => (
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
                cell: ({ row }) => <DataTableRowActions row={row as any} />,
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

    // Estado de carga global
    const isLoading = isLoadingFile || (selectedFile && (isLoadingSheets || isLoadingData));
    const showEmptyState = !isLoadingFile && !selectedFile;

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-row items-center justify-between py-8 my-4 gap-1 flex-none">
                <div className="flex flex-col gap-1">
                    <h1 className="text-xl font-bold tracking-tight">Data Sources</h1>
                    <p className="text-muted-foreground">View data from the connected OneDrive file.</p>
                </div>
                {(selectedFile || isLoadingFile) && (
                    <div className="flex items-center gap-3 px-3 py-2 min-w-44 border rounded-md border-dashed bg-muted/40">
                        {isLoadingFile ? (
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
                        <EmptyTitle>No Data Source Configured</EmptyTitle>
                        <EmptyDescription>
                            To view data here, an administrator must first link an Excel file in the <a href="/system" className="font-medium">System Settings</a>.
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

                    {/* Main Content */}
                    <div className="overflow-hidden px-1 pb-1 flex flex-col h-full">
                        {/* Header Section - Constant Layout */}
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

                        {/* Body Section */}
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
                            ) : (
                                <div className="flex-1 overflow-auto">
                                    <ScheduleDataTable
                                        columns={tableColumns}
                                        data={tableData}
                                        hideFilters={true}
                                        hideUpload={true}
                                        hideActions={true}
                                        hideOverlaps={true}
                                        initialPageSize={100}
                                        onRefresh={fetchData}
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
