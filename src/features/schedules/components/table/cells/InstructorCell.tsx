import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AssignmentRow } from "../assignment-columns";
import { Row } from "@tanstack/react-table";

interface InstructorCellProps {
    row: Row<AssignmentRow>;
    instructorsList: string[];
    onInstructorChange?: (rowId: string, newInstructor: string) => void;
}

export function InstructorCell({ row, instructorsList, onInstructorChange }: InstructorCellProps) {
    const [open, setOpen] = useState(false);
    const isManualMode = row.original.manualMode === true;
    const instructor = row.getValue("instructor") as string;

    return (
        <Popover open={open} onOpenChange={setOpen} modal={false}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={!isManualMode}
                    className="w-full max-w-[180px] justify-between gap-2 px-3 rounded-lg"
                >
                    <span className="truncate font-normal">
                        {instructor || "Select instructor"}
                    </span>
                    <ChevronsUpDown className="w-4 h-4 text-muted-foreground opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[200px] p-0 z-200 pointer-events-auto"
                align="start"
                onWheel={(e) => e.stopPropagation()}
            >
                <Command>
                    <CommandInput placeholder="Search instructor..." />
                    <CommandList className="max-h-[300px] overflow-y-auto overflow-x-hidden">
                        <CommandEmpty>No instructor found.</CommandEmpty>
                        <CommandGroup>
                            {instructorsList.map((inst) => (
                                <CommandItem
                                    key={inst}
                                    value={inst}
                                    onSelect={() => {
                                        if (onInstructorChange) {
                                            onInstructorChange(row.original.id, inst);
                                        }
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={
                                            instructor === inst
                                                ? "opacity-100"
                                                : "opacity-0"
                                        }
                                    />
                                    <span className="truncate">{inst}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
