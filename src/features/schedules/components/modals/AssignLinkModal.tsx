import { useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScheduleDataTable } from "@schedules/components/table/ScheduleDataTable";
import { getAssignmentColumns, AssignmentRow } from "@schedules/components/table/assignment-columns";
import { Schedule } from "@schedules/utils/excel-parser";
import { useZoomStore } from "@/features/matching/stores/useZoomStore";
import { useInstructors } from "@/features/schedules/hooks/useInstructors";

interface AssignLinkModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    schedules: Schedule[];
}

export function AssignLinkModal({ open, onOpenChange, schedules }: AssignLinkModalProps) {
    const { fetchZoomData, runMatching, matchResults, meetings } = useZoomStore();
    const instructorsList = useInstructors(schedules);

    // 1. Cargar datos de Zoom si no están cargados
    useEffect(() => {
        if (open && meetings.length === 0) {
            fetchZoomData();
        }
    }, [open, meetings.length, fetchZoomData]);

    // 2. Ejecutar Matching cuando se abre el modal o cambian los horarios
    // Solo si ya tenemos meetings cargados
    useEffect(() => {
        if (open && schedules.length > 0 && meetings.length > 0) {
            runMatching(schedules);
        }
    }, [open, schedules, meetings.length, runMatching]);

    const columns = useMemo(() => getAssignmentColumns(instructorsList), [instructorsList]);

    // 3. Mapear resultados del matching a filas de la tabla
    const tableData: AssignmentRow[] = useMemo(() => {
        return matchResults.map(r => ({
            ...r.schedule,
            id: r.schedule.code || r.meeting_id || Math.random().toString(), // Fallback ID
            meetingId: r.meeting_id || "-",
            time: `${r.schedule.start_time} - ${r.schedule.end_time}`,
            // instructor: r.schedule.instructor, // Ya en spread
            // program: r.schedule.program, // Ya en spread
            status: r.status,
            reason: r.reason || (r.status === 'not_found' ? 'Sin coincidencia' : ''),
            originalSchedule: r.schedule,
            matchedCandidate: r.matchedCandidate,
            ambiguousCandidates: r.ambiguousCandidates
        }));
    }, [matchResults]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!max-w-[1200px] max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Automatic Assignment</DialogTitle>
                    <DialogDescription>
                        Review and execute the automatic assignment.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 p-2 overflow-auto">
                    <ScheduleDataTable
                        columns={columns}
                        data={tableData}
                        hideFilters={true}
                        hideUpload={true}
                        hideActions={true}
                        hideOverlaps={true}
                    />
                </div>

                <DialogFooter className="mt-auto gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button>
                        Execute
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
