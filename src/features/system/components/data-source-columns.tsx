import { type ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { type Schedule } from "@/features/schedules/utils/excel-parser";
import { DataTableColumnHeader } from "@/features/schedules/components/table/data-table-column-header";
import { DataTableRowActions } from "@/features/schedules/components/table/data-table-row-actions";

export const getDataSourceColumns = (onDelete?: (s: Schedule) => void): ColumnDef<Schedule>[] => [
    {
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
    },
    {
        accessorKey: "date",
        size: 120,
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Date" className="justify-center" />
        ),
        cell: ({ row }) => <div className="w-[100px] text-center">{row.getValue("date")}</div>,
    },
    {
        accessorKey: "shift",
        size: 100,
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Shift" />
        ),
        cell: ({ row }) => <div className="w-[100px]">{row.getValue("shift")}</div>,
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id));
        },
    },
    {
        accessorKey: "branch",
        size: 140,
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Branch" />
        ),
        cell: ({ row }) => <div>{row.getValue("branch")}</div>,
        filterFn: (row, id, filterValues: string[]) => {
            const cellValue = row.getValue(id) as string;
            return filterValues.some((filter) => cellValue.includes(filter));
        },
    },
    {
        accessorKey: "instructor",
        size: 200,
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Instructor" />
        ),
        cell: ({ row }) => (
            <div className="truncate w-[180px]" title={row.getValue("instructor")}>{row.getValue("instructor")}</div>
        ),
    },
    {
        accessorKey: "program",
        size: 400,
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Program" />
        ),
        cell: ({ row }) => (
            <div className="truncate max-w-[380px]" title={row.getValue("program")}>
                {row.getValue("program")}
            </div>
        ),
    },
    {
        accessorKey: "minutes",
        size: 70,
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Mins" className="justify-center" />
        ),
        cell: ({ row }) => <div className="w-[50px] text-center">{row.getValue("minutes")}</div>,
    },
    {
        accessorKey: "units",
        size: 70,
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Units" className="justify-center" />
        ),
        cell: ({ row }) => <div className="w-[50px] text-center">{row.getValue("units")}</div>,
    },
    {
        id: "actions",
        size: 50,
        cell: ({ row }) => <DataTableRowActions row={row} onDelete={onDelete} />,
    },
];
