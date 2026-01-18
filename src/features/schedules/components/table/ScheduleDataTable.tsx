import * as React from "react";
import {
    flexRender,
    getCoreRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnDef,
    type ColumnFiltersState,
    type SortingState,
    type VisibilityState,
} from "@tanstack/react-table";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";
import { detectOverlaps, getScheduleKey } from "@schedules/utils/overlap-utils";
import { Schedule } from "@schedules/utils/excel-parser";

interface ScheduleDataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[] | ((addStatusFilter: (status: string) => void) => ColumnDef<TData, TValue>[]);
    data: TData[];
    onUploadClick?: () => void;
    onClearSchedule?: () => void;
    onRefresh?: () => void;
    hideFilters?: boolean;
    hideUpload?: boolean;
    hideActions?: boolean;
    hideOverlaps?: boolean;
}

export function ScheduleDataTable<TData, TValue>({
    columns,
    data,
    onClearSchedule,
    onUploadClick,
    onRefresh,
    ...props
}: ScheduleDataTableProps<TData, TValue>) {
    const [rowSelection, setRowSelection] = React.useState({});
    // Columna shift oculta por defecto
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({ shift: false });
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
        []
    );
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = React.useState("");
    const [showOverlapsOnly, setShowOverlapsOnly] = React.useState(false);

    // Función para agregar un status al filtro de status
    const addStatusFilter = React.useCallback((status: string) => {
        setColumnFilters(prev => {
            const statusFilter = prev.find(f => f.id === 'status');
            if (statusFilter) {
                const currentValues = statusFilter.value as string[];
                if (!currentValues.includes(status)) {
                    return prev.map(f =>
                        f.id === 'status'
                            ? { ...f, value: [...currentValues, status] }
                            : f
                    );
                }
            }
            // Si no hay filtro de status activo, no hacer nada
            return prev;
        });
    }, []);

    // Resolver columns - pueden ser una función o un array directo
    const resolvedColumns = React.useMemo(() => {
        if (typeof columns === 'function') {
            return columns(addStatusFilter);
        }
        return columns;
    }, [columns, addStatusFilter]);

    const overlapResult = React.useMemo(() => {
        if (props.hideOverlaps) {
            return {
                timeConflicts: new Set<string>(),
                duplicateClasses: new Set<string>(),
                allOverlaps: new Set<string>(),
                overlapCount: 0
            };
        }
        return detectOverlaps(data as unknown as Schedule[]);
    }, [data, props.hideOverlaps]);

    const tableData = React.useMemo(() => {
        if (!showOverlapsOnly) return data;
        return data.filter((item) =>
            overlapResult.allOverlaps.has(getScheduleKey(item as unknown as Schedule))
        );
    }, [data, showOverlapsOnly, overlapResult]);

    const table = useReactTable({
        data: tableData,
        columns: resolvedColumns,
        state: {
            sorting,
            columnVisibility,
            rowSelection,
            columnFilters,
            globalFilter,
        },
        initialState: {
            pagination: {
                pageSize: 25,
            },
        },
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        autoResetPageIndex: false, // Mantener la página actual cuando los datos cambian
    });

    return (
        <div className="flex flex-col gap-4">
            {/* Toolbar with Search, Filters, and View Options */}
            <DataTableToolbar
                table={table}
                showOverlapsOnly={showOverlapsOnly}
                setShowOverlapsOnly={setShowOverlapsOnly}
                overlapCount={overlapResult.overlapCount}
                onClearSchedule={onClearSchedule}
                onUploadClick={onUploadClick}
                onRefresh={onRefresh}
                fullData={data}
                hideFilters={props.hideFilters}
                hideUpload={props.hideUpload}
                hideActions={props.hideActions}
            />

            {/* Table */}
            <div className="overflow-hidden rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead
                                            key={header.id}
                                            colSpan={header.colSpan}
                                            style={{
                                                width: header.getSize() !== 150 ? header.getSize() : undefined,
                                            }}
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => {
                                const isConflict = overlapResult.allOverlaps.has(
                                    getScheduleKey(row.original as Schedule)
                                );

                                return (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className={
                                            isConflict
                                                ? "text-destructive"
                                                : undefined
                                        }
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={resolvedColumns.length}
                                    className="h-24 text-center"
                                >
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <DataTablePagination table={table} />
        </div>
    );
}
