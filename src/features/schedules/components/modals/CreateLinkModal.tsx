import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScheduleDataTable } from "@schedules/components/table/ScheduleDataTable";
import { useZoomStore } from "@/features/matching/stores/useZoomStore";
import { MatchingService } from "@/features/matching/services/matcher";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@schedules/components/table/data-table-column-header";
import { ArrowLeft, Loader2, CheckCircle2, HelpCircle, RefreshCw, MoreHorizontal, Hand, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface CreateLinkModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Tipos para el resultado de validación
type ValidationStatus = 'to_create' | 'exists' | 'ambiguous' | 'manual';

interface ValidationResult {
    id: string;
    inputName: string;           // Nombre original que ingresó el usuario
    status: ValidationStatus;
    meeting_id?: string;
    join_url?: string;
    matchedTopic?: string;       // Topic del meeting encontrado
    ambiguousCandidates?: Array<{
        meeting_id: string;
        topic: string;
        join_url?: string;
        host_id?: string;
    }>;
    host_id?: string; // Anfitrión preservado
}

// Columnas para la tabla de validación
const getValidationColumns = (
    hostMap: Map<string, string> = new Map(),
    onSelectCandidate?: (rowId: string, candidate: { meeting_id: string; topic: string; join_url?: string; host_id?: string } | null) => void
): ColumnDef<ValidationResult>[] => [
        {
            id: "select",
            size: 36,
            header: ({ table }) => (
                <div className="flex justify-center items-center mb-1">
                    <Checkbox
                        checked={table.getIsAllPageRowsSelected()}
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
                        disabled={!row.getCanSelect()}
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
            accessorKey: "status",
            size: 120,
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Status" className="justify-center" />
            ),
            cell: ({ row }) => {
                const status = row.getValue("status") as ValidationStatus;
                const result = row.original;

                // Badge según status
                let badge;
                if (status === 'to_create') {
                    badge = (
                        <Badge variant="outline" className="border-green-600 text-green-600 bg-green-50 dark:bg-green-950/20 dark:border-green-500 dark:text-green-400 cursor-pointer hover:bg-green-100">
                            <CheckCircle2 />
                            New
                        </Badge>
                    );
                } else if (status === 'exists') {
                    badge = (
                        <Badge variant="outline" className="text-muted-foreground cursor-pointer hover:bg-gray-100">
                            <RefreshCw />
                            Exists
                        </Badge>
                    );
                } else if (status === 'manual') {
                    badge = (
                        <Badge variant="outline" className="border-blue-500/50 text-blue-600 bg-blue-500/10 dark:text-blue-400 cursor-pointer hover:bg-blue-500/20">
                            <Hand />
                            Manual
                        </Badge>
                    );
                } else {
                    badge = (
                        <Badge variant="outline" className="border-orange-500/50 text-orange-600 bg-orange-500/10 dark:text-orange-400 cursor-pointer hover:bg-orange-500/20">
                            <HelpCircle />
                            Ambiguous
                        </Badge>
                    );
                }

                // Si es ambiguo o manual (que viene de ambiguo), mostrar popover
                if ((status === 'ambiguous' || (status === 'manual' && result.ambiguousCandidates && result.ambiguousCandidates.length > 0))) {
                    const candidates = result.ambiguousCandidates || [];

                    if (candidates.length > 0) {
                        return (
                            <div className="flex justify-center">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        {badge}
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0 rounded-lg" onWheel={(e) => e.stopPropagation()}>
                                        <div className="p-4 space-y-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="font-semibold text-sm">
                                                    {status === 'manual' ? 'Manual Selection' : 'Multiple Matches Found'}
                                                </h4>
                                                <Badge variant="secondary" className="text-xs">{candidates.length} options</Badge>
                                            </div>
                                            <div className="space-y-2 max-h-[280px] overflow-y-auto no-scrollbar">
                                                {candidates.map((cand, i) => {
                                                    const isSelected = result.meeting_id === cand.meeting_id;
                                                    return (
                                                        <div
                                                            key={i}
                                                            className={`border rounded-md p-2.5 transition-colors cursor-pointer ${isSelected ? 'border-green-500 bg-green-50/50 dark:bg-green-950/20' : 'hover:bg-accent/50'}`}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    // Deseleccionar (volver a ambiguo)
                                                                    onSelectCandidate?.(result.id, null);
                                                                } else {
                                                                    // Seleccionar
                                                                    onSelectCandidate?.(result.id, cand);
                                                                }
                                                            }}
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-medium text-sm mb-1">{cand.topic}</div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        ID: {cand.meeting_id}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground truncate">
                                                                        Host: {hostMap.get(cand.host_id || '') || cand.host_id}
                                                                    </div>
                                                                </div>
                                                                {isSelected && (
                                                                    <Badge variant="outline" className="border-green-600 text-green-600 bg-green-50 dark:bg-green-950/20">
                                                                        Selected
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        );
                    }
                }

                // Si existe, mostrar popover con detalles del meeting
                if (status === 'exists' && result.meeting_id) {
                    return (
                        <div className="flex justify-center">
                            <Popover>
                                <PopoverTrigger asChild>
                                    {badge}
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-0 rounded-lg" onWheel={(e) => e.stopPropagation()}>
                                    <div className="p-4">
                                        <h4 className="font-semibold text-sm mb-3">Existing Meeting</h4>
                                        <div className="space-y-2.5">
                                            <div>
                                                <div className="text-xs font-medium text-muted-foreground mb-1">Topic</div>
                                                <div className="text-sm">{result.matchedTopic || result.inputName}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-medium text-muted-foreground mb-1">Meeting ID</div>
                                                <div className="text-sm font-mono">
                                                    {result.meeting_id}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-medium text-muted-foreground mb-1">Host</div>
                                                <div className="text-sm">
                                                    {hostMap.get(result.host_id || '') || result.host_id || '—'}
                                                </div>
                                            </div>
                                            {result.join_url && (
                                                <div>
                                                    <div className="text-xs font-medium text-muted-foreground mb-1">Join URL</div>
                                                    <div className="text-sm">
                                                        <a
                                                            href={result.join_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:underline truncate block"
                                                        >
                                                            {result.join_url}
                                                        </a>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    );
                }

                return <div className="flex justify-center">{badge}</div>;
            },
        },
        {
            accessorKey: "inputName",
            size: 400,
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Program" />
            ),
            cell: ({ row }) => (
                <div className="truncate max-w-[380px]">{row.getValue("inputName")}</div>
            ),
        },
        {
            accessorKey: "meeting_id",
            size: 130,
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Meeting ID" className="justify-center" />
            ),
            cell: ({ row }) => {
                const meetingId = row.getValue("meeting_id") as string | undefined;
                if (!meetingId) return <div className="text-center font-mono">—</div>;
                return (
                    <div className="text-center font-mono">
                        <a
                            href={`https://zoom.us/meeting/${meetingId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                        >
                            {meetingId}
                        </a>
                    </div>
                );
            },
        },
        {
            id: "actions",
            size: 50,
            cell: ({ row }) => {
                return (
                    <div className="flex justify-center">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                    Copy details
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ];

export function CreateLinkModal({ open, onOpenChange }: CreateLinkModalProps) {
    const { meetings, users, isLoadingData, fetchZoomData, createMeetings, updateMatchings, isExecuting } = useZoomStore();

    // Crear mapa de anfitriones para búsqueda fácil
    const hostMap = useMemo(() => {
        const map = new Map<string, string>();
        users.forEach(u => {
            map.set(u.id, u.display_name || `${u.first_name} ${u.last_name}`.trim() || u.email);
        });
        return map;
    }, [users]);

    // Estado del asistente
    const [step, setStep] = useState<'input' | 'results'>('input');
    const [inputText, setInputText] = useState("");
    const [isValidating, setIsValidating] = useState(false);
    const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);

    // Reset cuando se cierra el modal
    useEffect(() => {
        if (!open) {
            setStep('input');
            setInputText("");
            setValidationResults([]);
        }
    }, [open]);

    // Cargar datos de Zoom si no están cargados
    useEffect(() => {
        if (open && meetings.length === 0 && !isLoadingData) {
            fetchZoomData();
        }
    }, [open, meetings.length, isLoadingData, fetchZoomData]);

    // Crear instancia del MatchingService (igual que en AssignLinkModal)
    const matcher = useMemo(() => {
        if (meetings.length === 0) return null;
        return new MatchingService(meetings, users);
    }, [meetings, users]);

    // Función de validación usando MatchingService
    const handleValidate = async () => {
        const lines = inputText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length === 0 || !matcher) return;

        setIsValidating(true);

        // Pequeño retraso para UX
        await new Promise(resolve => setTimeout(resolve, 100));

        const results: ValidationResult[] = lines.map((inputName, index) => {
            // Usar findMatchByTopic que no requiere instructor
            // Pasamos ignoreLevelMismatch: true para detectar duplicados incluso si el nivel cambió
            const matchResult = matcher.findMatchByTopic(inputName, { ignoreLevelMismatch: true });

            // Mapear el resultado del matcher a ValidationResult
            if (matchResult.status === 'not_found') {
                // No existe - se puede crear
                return {
                    id: `${index}-${inputName}`,
                    inputName,
                    status: 'to_create' as ValidationStatus,
                };
            }

            if (matchResult.status === 'ambiguous' && matchResult.ambiguousCandidates) {
                // Múltiples coincidencias
                return {
                    id: `${index}-${inputName}`,
                    inputName,
                    status: 'ambiguous' as ValidationStatus,
                    ambiguousCandidates: matchResult.ambiguousCandidates.map(m => ({
                        meeting_id: m.meeting_id,
                        topic: m.topic,
                        join_url: m.join_url,
                        host_id: m.host_id,
                    })),
                };
            }

            // Existe (assigned o to_update)
            const matchedMeeting = matchResult.matchedCandidate || matchResult.bestMatch;
            return {
                id: `${index}-${inputName}`,
                inputName,
                status: 'exists' as ValidationStatus,
                meeting_id: matchedMeeting?.meeting_id,
                join_url: matchedMeeting?.join_url,
                matchedTopic: matchedMeeting?.topic,
                host_id: matchedMeeting?.host_id,
            };
        });

        setValidationResults(results);
        setIsValidating(false);
        setStep('results');
    };

    // Selección de filas
    const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

    // Reset selección al cambiar de paso
    useEffect(() => {
        setRowSelection({});
    }, [step]);

    // Contadores de estado (Totales para la barra de estado)
    const statusCounts = useMemo(() => {
        const counts = { to_create: 0, exists: 0, ambiguous: 0, manual: 0 };
        for (const r of validationResults) {
            if (r.status === 'to_create') counts.to_create++;
            else if (r.status === 'exists') counts.exists++;
            else if (r.status === 'ambiguous') counts.ambiguous++;
            else if (r.status === 'manual') counts.manual++;
        }
        return counts;
    }, [validationResults]);

    // Contadores para selección
    const selectedCount = useMemo(() => {
        return Object.keys(rowSelection).length;
    }, [rowSelection]);

    // Manejador para volver atrás
    const handleBack = () => {
        setStep('input');
        setValidationResults([]);
    };

    // Manejador para seleccionar candidato manualmente
    const handleSelectCandidate = (rowId: string, candidate: { meeting_id: string; topic: string; join_url?: string; host_id?: string } | null) => {
        setValidationResults(prev => prev.map(row => {
            if (row.id === rowId) {
                if (!candidate) {
                    // Reiniciar a ambiguo
                    return {
                        ...row,
                        status: 'ambiguous' as ValidationStatus,
                        meeting_id: undefined,
                        join_url: undefined,
                        matchedTopic: undefined,
                    };
                }

                return {
                    ...row,
                    status: 'manual' as ValidationStatus,
                    meeting_id: candidate.meeting_id,
                    join_url: candidate.join_url,
                    matchedTopic: candidate.topic,
                    matchedCandidate: candidate,
                    host_id: candidate.host_id,
                };
            }
            return row;
        }));
    };

    // Columnas con manejador memorizado
    const columns = useMemo(() =>
        getValidationColumns(hostMap, handleSelectCandidate),
        [hostMap]
    );

    // Líneas analizadas para vista previa
    const parsedLines = inputText.split('\n').filter(l => l.trim().length > 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn(
                "flex flex-col max-h-[85vh]",
                step === 'input' ? "sm:max-w-lg" : "!max-w-4xl"
            )}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {step === 'results' && (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={handleBack}
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        )}
                        Create Zoom Links
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'input'
                            ? "Enter program names (one per line) to validate."
                            : "Review and confirm Zoom meeting links"
                        }
                    </DialogDescription>
                </DialogHeader>

                {/* Step 1: Input */}
                {step === 'input' && (
                    <>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-3">
                                <Label htmlFor="programs">Program Names</Label>
                                <Textarea
                                    id="programs"
                                    placeholder="Corporate English 9AM&#10;Kids Program 10AM&#10;Business English 2PM"
                                    className="min-h-[240px] font-mono text-sm max-h-[400px] resize-none no-scrollbar"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                />
                                <p className="text-sm text-muted-foreground">
                                    {parsedLines.length} program{parsedLines.length !== 1 ? 's' : ''} to validate
                                </p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleValidate}
                                disabled={parsedLines.length === 0 || isValidating || isLoadingData}
                            >
                                {isValidating ? (
                                    <>
                                        <Loader2 className="animate-spin" />
                                        Validating...
                                    </>
                                ) : (
                                    "Validate"
                                )}
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {/* Step 2: Results */}
                {step === 'results' && (
                    <>
                        <div className="flex-1 overflow-auto p-2">
                            <ScheduleDataTable
                                columns={columns}
                                data={validationResults}
                                hideFilters
                                hideUpload
                                hideActions
                                hideOverlaps
                                enableRowSelection={(row) => row.status !== 'ambiguous'}
                                controlledSelection={rowSelection}
                                onControlledSelectionChange={setRowSelection}
                                initialPageSize={25}
                                statusOptions={[
                                    { label: "New", value: "to_create", icon: PlusCircle },
                                    { label: "Exists", value: "exists", icon: RefreshCw },
                                    { label: "Ambiguous", value: "ambiguous", icon: HelpCircle },
                                    { label: "Manual", value: "manual", icon: Hand },
                                ]}
                            />
                        </div>
                        <DialogFooter className="mt-auto flex-col sm:flex-row gap-4">
                            {/* Barra de estado con conteos a la izquierda */}
                            <div className="flex items-center gap-3 mr-auto text-sm text-muted-foreground">
                                {isValidating || isExecuting ? (
                                    <span className="text-muted-foreground">Processing...</span>
                                ) : (
                                    <>
                                        <span>New: <strong className="text-foreground font-medium">{statusCounts.to_create}</strong></span>
                                        <span className="text-border">|</span>
                                        <span>Exists: <strong className="text-foreground font-medium">{statusCounts.exists}</strong></span>
                                        {statusCounts.ambiguous > 0 && (
                                            <>
                                                <span className="text-border">|</span>
                                                <span>Ambiguous: <strong className="text-foreground font-medium">{statusCounts.ambiguous}</strong></span>
                                            </>
                                        )}
                                        {statusCounts.manual > 0 && (
                                            <>
                                                <span className="text-border">|</span>
                                                <span>Manual: <strong className="text-foreground font-medium">{statusCounts.manual}</strong></span>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Botones a la derecha */}
                            <div className="flex items-center gap-2">
                                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExecuting}>
                                    Cancel
                                </Button>

                                <Button
                                    disabled={selectedCount === 0 || isExecuting}
                                    onClick={async () => {
                                        const selectedRows = validationResults.filter(r => rowSelection[r.id]);

                                        // Separar acciones
                                        const toCreate = selectedRows
                                            .filter(r => r.status === 'to_create')
                                            .map(r => r.inputName);

                                        const updates = selectedRows
                                            .filter(r => (r.status === 'exists' || r.status === 'manual') && r.meeting_id)
                                            .map(r => {
                                                let schedule_for = undefined;
                                                if (r.host_id) {
                                                    const hostUser = users.find(u => u.id === r.host_id);
                                                    if (hostUser) schedule_for = hostUser.email;
                                                }
                                                return {
                                                    meeting_id: r.meeting_id!,
                                                    topic: r.inputName,
                                                    schedule_for
                                                };
                                            });

                                        if (toCreate.length === 0 && updates.length === 0) return;

                                        // Ejecutar secuencialmente o paralelo según sea necesario
                                        // El store maneja isExecuting, así que mejor secuencial para no pisar estados si el store es simple
                                        let successCount = 0;

                                        if (toCreate.length > 0) {
                                            const res = await createMeetings(toCreate);
                                            successCount += res.succeeded;
                                        }

                                        if (updates.length > 0) {
                                            const res = await updateMatchings(updates);
                                            successCount += res.succeeded;
                                        }

                                        if (successCount > 0) {
                                            // Validar de nuevo para refrescar estados
                                            handleValidate();
                                        }
                                    }}
                                >
                                    {isExecuting ? (
                                        <>
                                            <Loader2 className="animate-spin" />
                                            Executing...
                                        </>
                                    ) : (
                                        selectedCount > 0 ? `Execute (${selectedCount})` : 'Execute'
                                    )}
                                </Button>
                            </div>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
