import { useMemo, useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScheduleDataTable } from "@schedules/components/table/ScheduleDataTable";
import { getAssignmentColumns, AssignmentRow } from "@schedules/components/table/assignment-columns";
import { Schedule } from "@schedules/utils/excel-parser";
import { useZoomStore } from "@/features/matching/stores/useZoomStore";
import { useInstructors } from "@/features/schedules/hooks/useInstructors";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AssignLinkModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    schedules: Schedule[];
}

export function AssignLinkModal({ open, onOpenChange, schedules }: AssignLinkModalProps) {
    const { fetchZoomData, runMatching, matchResults, meetings, users, isLoadingData, executeAssignments, isExecuting } = useZoomStore();
    const instructorsList = useInstructors();
    const [isMatching, setIsMatching] = useState(false);
    const [selectedRows, setSelectedRows] = useState<AssignmentRow[]>([]);

    // Limpiar selectedRows cuando el modal se cierra
    useEffect(() => {
        if (!open) {
            setSelectedRows([]);
        }
    }, [open]);

    // Helper para generar ID único por fila (date + start_time + program)
    const getRowId = (schedule: Schedule): string => {
        return `${schedule.date}-${schedule.start_time}-${schedule.program}-${schedule.instructor}`;
    };

    // 1. Cargar datos de Zoom si no están cargados
    useEffect(() => {
        if (open && meetings.length === 0 && !isLoadingData) {
            fetchZoomData();
        }
    }, [open, meetings.length, isLoadingData, fetchZoomData]);

    // 2. Ejecutar Matching cuando se abre el modal o cambian los horarios
    // Solo si ya tenemos meetings cargados
    useEffect(() => {
        const doMatching = async () => {
            if (open && schedules.length > 0 && meetings.length > 0 && !isLoadingData) {
                setIsMatching(true);
                await runMatching(schedules);
                setIsMatching(false);
            }
        };
        doMatching();
    }, [open, schedules, meetings.length, runMatching, isLoadingData]);

    // Resetear estado cuando el modal se cierra
    useEffect(() => {
        if (!open) {
            setIsMatching(false);
        }
    }, [open]);

    // Función para refrescar los datos y re-ejecutar el matching
    const handleRefresh = async () => {
        setIsMatching(true);
        try {
            await fetchZoomData();
            const store = useZoomStore.getState();
            if (schedules.length > 0 && store.meetings.length > 0) {
                await runMatching(schedules);
            }
        } catch (error) {
            console.error("Refresh failed:", error);
        } finally {
            setIsMatching(false);
        }
    };

    // Create host ID to name map
    const hostMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const user of users) {
            map.set(user.id, user.display_name || `${user.first_name} ${user.last_name}`);
        }
        return map;
    }, [users]);

    // Handler para cambiar instructor de una fila
    const handleInstructorChange = (rowId: string, newInstructor: string) => {
        // Actualizar el instructor en los matchResults del store
        const currentResults = useZoomStore.getState().matchResults;
        const zoomUsers = useZoomStore.getState().users;

        // Buscar el usuario de Zoom por display_name exacto (viene del dropdown)
        const foundUser = zoomUsers.find(u => u.display_name === newInstructor);
        const newFoundInstructor = foundUser ? {
            id: foundUser.id,
            email: foundUser.email,
            display_name: foundUser.display_name || `${foundUser.first_name} ${foundUser.last_name}`
        } : undefined;

        const updatedResults = currentResults.map(r => {
            const id = getRowId(r.schedule);
            if (id === rowId) {
                // Crear backup del estado si no existe
                const { originalState: existingBackup, ...currentState } = r;
                const backup = existingBackup || (currentState as any);

                // Mantener 'manual' si ya era manual, de lo contrario 'to_update'
                const newStatus = r.status === 'manual' ? 'manual' as const : 'to_update' as const;

                return {
                    ...r,
                    schedule: { ...r.schedule, instructor: newInstructor },
                    originalState: backup,
                    found_instructor: newFoundInstructor,
                    status: newStatus,
                    reason: 'Change host'
                };
            }
            return r;
        });
        useZoomStore.setState({ matchResults: updatedResults });
    };

    // Handler para toggle de modo manual
    const handleManualModeToggle = (rowId: string) => {
        const currentResults = useZoomStore.getState().matchResults;
        const updatedResults = currentResults.map(r => {
            const id = getRowId(r.schedule);
            if (id === rowId) {
                return {
                    ...r,
                    manualMode: !r.manualMode
                };
            }
            return r;
        });
        useZoomStore.setState({ matchResults: updatedResults });
    };

    // Handler para seleccionar un candidato de la lista de ambiguos
    const handleSelectCandidate = (rowId: string, candidate: import("@/features/matching/services/matcher").ZoomMeetingCandidate) => {
        const currentResults = useZoomStore.getState().matchResults;
        const updatedResults = currentResults.map(r => {
            const id = getRowId(r.schedule);
            if (id === rowId) {
                // Crear backup del estado si no existe
                const { originalState: existingBackup, ...currentState } = r;
                const backup = existingBackup || (currentState as any);

                return {
                    ...r,
                    status: 'manual' as const,
                    matchedCandidate: candidate,
                    meeting_id: candidate.meeting_id,
                    manualMode: true,
                    reason: 'Manually selected',
                    originalState: backup
                };
            }
            return r;
        });
        useZoomStore.setState({ matchResults: updatedResults });
    };

    // Handler para deseleccionar un candidato (volver a ambiguous)
    const handleDeselectCandidate = (rowId: string) => {
        const currentResults = useZoomStore.getState().matchResults;
        const updatedResults = currentResults.map(r => {
            const id = getRowId(r.schedule);
            if (id === rowId) {
                return {
                    ...r,
                    status: 'ambiguous' as const,
                    matchedCandidate: undefined,
                    meeting_id: undefined,
                    manualMode: false,
                    reason: 'Multiple matches found'
                };
            }
            return r;
        });
        useZoomStore.setState({ matchResults: updatedResults });
    };

    // Handler para resetear fila
    const handleResetRow = (rowId: string) => {
        const currentResults = useZoomStore.getState().matchResults;
        const updatedResults = currentResults.map(r => {
            const id = getRowId(r.schedule);
            if (id === rowId && r.originalState) {
                // Restaurar estado completo
                return {
                    ...r.originalState,
                    originalState: r.originalState, // Mantener el backup por si quiere resetear de nuevo tras más cambios
                    manualMode: false // Salir de manual mode
                } as any;
            }
            return r;
        });
        useZoomStore.setState({ matchResults: updatedResults });
    };

    // 2. Definir columnas usando el helper
    const getColumns = useCallback(
        (addStatusFilter: (status: string) => void) =>
            getAssignmentColumns(instructorsList, hostMap, handleInstructorChange, handleManualModeToggle, handleSelectCandidate, handleDeselectCandidate, addStatusFilter, handleResetRow),
        [instructorsList, hostMap]
    );

    // 3. Mapear resultados del matching a filas de la tabla
    const tableData: AssignmentRow[] = useMemo(() => {
        return matchResults.map(r => {
            // Determinar el instructor a mostrar:
            // - Si found_instructor existe (usuario de Zoom matcheado), usarlo
            // - Si no, mantener el del Excel
            const resolvedInstructor = r.found_instructor?.display_name || r.schedule.instructor;

            return {
                ...r.schedule,
                id: getRowId(r.schedule),
                meetingId: r.meeting_id || "-",
                time: `${r.schedule.start_time} - ${r.schedule.end_time}`,
                instructor: resolvedInstructor, // Usar el resuelto
                status: r.status,
                reason: r.reason || (r.status === 'not_found' ? 'No match found' : ''),
                detailedReason: r.detailedReason,
                originalSchedule: r.schedule,
                matchedCandidate: r.matchedCandidate,
                ambiguousCandidates: r.ambiguousCandidates,
                manualMode: r.manualMode,
                found_instructor: r.found_instructor
            };
        });
    }, [matchResults]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!max-w-[1240px] max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Automatic Assignment</DialogTitle>
                    <DialogDescription>
                        Review and execute the automatic assignment.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 p-2 overflow-auto">
                    {isLoadingData || isMatching ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[400px] space-y-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <div className="text-center space-y-2">
                                <p className="text-sm font-medium">
                                    {isLoadingData ? "Loading Zoom data..." : "Matching schedules..."}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {isLoadingData
                                        ? "Fetching meetings and users"
                                        : "Analyzing and matching meetings"}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <ScheduleDataTable
                            columns={getColumns}
                            data={tableData}
                            onRefresh={handleRefresh}
                            onSelectionChange={(rows) => setSelectedRows(rows as AssignmentRow[])}
                            enableRowSelection={(row: AssignmentRow) =>
                                (row.status === 'to_update' || row.status === 'manual') &&
                                !!row.meetingId &&
                                row.meetingId !== '-' &&
                                !!row.found_instructor
                            }
                            hideFilters={true}
                            hideUpload={true}
                            hideActions={true}
                            hideOverlaps={true}
                        />
                    )}
                </div>

                <DialogFooter className="mt-auto gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExecuting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={async () => {
                            // Filtrar filas elegibles de las seleccionadas
                            // Elegibles: 'to_update' o 'manual' (ambiguedad resuelta) con meetingId y instructor
                            const eligibleMeetingIds = selectedRows
                                .filter(row =>
                                    (row.status === 'to_update' || row.status === 'manual') &&
                                    row.meetingId &&
                                    row.meetingId !== '-' &&
                                    row.found_instructor
                                )
                                .map(row => row.meetingId!);

                            if (eligibleMeetingIds.length === 0) {
                                toast.error('No eligible meetings selected. Select meetings with "To Update" or resolved ambiguity.');
                                return;
                            }

                            const result = await executeAssignments(eligibleMeetingIds);
                            if (result.succeeded > 0) {
                                toast.success(`${result.succeeded} meetings updated successfully`);
                                // Refrescar datos en lugar de cerrar el modal
                                await handleRefresh();
                            }
                            if (result.failed > 0) {
                                toast.error(`${result.failed} meetings failed to update`);
                            }
                        }}
                        disabled={isExecuting || selectedRows.filter(r => (r.status === 'to_update' || r.status === 'manual') && r.meetingId && r.meetingId !== '-' && r.found_instructor).length === 0}
                    >
                        {isExecuting ? (
                            <>
                                <Loader2 className="animate-spin" />
                                Executing...
                            </>
                        ) : (
                            (() => {
                                const count = selectedRows.filter(r => (r.status === 'to_update' || r.status === 'manual') && r.meetingId && r.meetingId !== '-' && r.found_instructor).length;
                                return count > 0 ? `Execute (${count})` : 'Execute';
                            })()
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
