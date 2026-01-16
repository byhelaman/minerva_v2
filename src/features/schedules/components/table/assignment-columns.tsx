import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "./data-table-column-header";
import { Schedule } from "@schedules/utils/excel-parser";
import { Checkbox } from "@/components/ui/checkbox";
import { XCircle, RefreshCw, AlertCircle, BadgeCheckIcon, MoreHorizontal, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// Definir la estructura de los datos de asignación
// Esto extiende Schedule pero se centra en el aspecto de la asignación
export interface AssignmentRow extends Schedule {
    id: string; // ID único para la fila (podría ser la clave del horario)
    meetingId: string; // Marcador de posición por ahora, tal vez ID de reunión de Zoom o ID de enlace
    time: string; // Hora combinada/formateada
    // instructor: string; // Ya en Schedule
    // program: string; // Ya en Schedule
    status: 'assigned' | 'to_update' | 'not_found' | 'error';
    reason: string; // Explicación del estado
    originalSchedule: Schedule; // Mantener referencia a los datos originales
}

// Modificado para aceptar lista dinámica de instructores
export const getAssignmentColumns = (instructorsList: string[] = []): ColumnDef<AssignmentRow>[] => [

    {
        id: "select",
        size: 40,
        header: ({ table }) => (
            <div className="flex justify-center items-center mb-1 w-7">
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
    },
    {
        accessorKey: "meetingId",
        size: 120,
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Meeting ID" className="text-center" />
        ),
        cell: ({ row }) => <div className="font-mono text-center min-w-[100px]">{row.getValue("meetingId") || "—"}
        </div>,
        enableSorting: false,
    },
    {
        accessorKey: "time",
        size: 120,
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Time" className="justify-center" />
        ),
        cell: ({ row }) => <div className="text-center">{row.getValue("time")}</div>,
        enableColumnFilter: false,
        enableGlobalFilter: false,
    },
    {
        accessorKey: "instructor",
        size: 200,
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Instructor" />
        ),
        cell: ({ row }) => {
            return (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            className="w-full max-w-[180px] justify-between gap-2 px-3 rounded-lg"
                        >
                            <span className="truncate font-normal">
                                {row.getValue("instructor") || "Select instructor"}
                            </span>
                            <ChevronsUpDown className="text-muted-foreground" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Search instructor..." />
                            <CommandList>
                                <CommandEmpty>No instructor found.</CommandEmpty>
                                <CommandGroup className="max-h-[300px] overflow-y-auto">
                                    {instructorsList.map((instructor) => (
                                        <CommandItem
                                            key={instructor}
                                            value={instructor}
                                        >
                                            <Check
                                                className={
                                                    row.getValue("instructor") === instructor
                                                        ? "opacity-100"
                                                        : "opacity-0"
                                                }
                                            />
                                            <span className="truncate">{instructor}</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            );
        },
    },
    {
        accessorKey: "program",
        size: 350,
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Program" />
        ),
        cell: ({ row }) => (
            <div className="truncate max-w-[320px]">
                {row.getValue("program")}
            </div>
        ),
    },
    {
        accessorKey: "status",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
            const status = row.getValue("status") as string;

            if (status === 'assigned') {
                return (
                    <Badge variant="outline" className="border-green-600 text-green-600 bg-green-50 dark:bg-green-950/20 dark:border-green-500 dark:text-green-400">
                        <BadgeCheckIcon />
                        Assigned
                    </Badge>
                );
            }

            if (status === 'not_found') {
                return (
                    <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/5 dark:border-destructive/50">
                        <XCircle />
                        Not Found
                    </Badge>
                );
            }

            if (status === 'to_update') {
                return (
                    <Badge variant="outline" className="text-muted-foreground">
                        <RefreshCw />
                        To Update
                    </Badge>
                );
            }

            return (
                <Badge variant="outline">
                    <AlertCircle />
                    {status}
                </Badge>
            );
        },
        // enableColumnFilter: false,
        enableGlobalFilter: false,
    },
    {
        accessorKey: "reason",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Reason" />
        ),
        cell: ({ row }) => (
            <div className="max-w-[200px] truncate text-muted-foreground" title={row.getValue("reason")}>
                {row.getValue("reason")}
            </div>
        ),
    },
    {
        id: "actions",
        size: 50,
        cell: () => (
            <div className="flex justify-center">
                <Button variant="ghost" size="icon-sm">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </div>
        ),
    },
];
