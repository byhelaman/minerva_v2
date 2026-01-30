import { create } from 'zustand';
import { Schedule } from '../utils/excel-parser';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface DailyIncidence extends Schedule {
    status?: string;
    substitute?: string;
    type?: string;
    subtype?: string;
    description?: string;
    department?: string;
    feedback?: string;
}

interface ScheduleState {
    // Data
    baseSchedules: Schedule[]; // Loaded from Excel
    incidences: DailyIncidence[]; // Stored locally (eventually published)

    // Computed
    activeDate: string | null;

    // Actions
    setBaseSchedules: (schedules: Schedule[]) => void;
    setIncidences: (incidences: DailyIncidence[]) => void;
    setActiveDate: (date: string | null) => void;

    // Incidence Actions (Local Only)
    upsertIncidence: (incidence: DailyIncidence) => void;
    removeIncidence: (schedule: Schedule) => void; // Remove by matching schedule keys

    // Helpers
    // Returns base schedules with incidence overrides applied
    getComputedSchedules: () => (Schedule | DailyIncidence)[];

    // Microsoft Integration Status
    msConfig: {
        isConnected: boolean;
        schedulesFolderId: string | null;
        incidencesFileId: string | null;
        schedulesFolderName: string | null;
        incidencesFileName: string | null;
    };
    refreshMsConfig: () => Promise<void>;

    // Publish Action
    isPublishing: boolean;
    publishDailyChanges: () => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
    baseSchedules: [],
    incidences: [],
    activeDate: null,
    isPublishing: false,

    msConfig: {
        isConnected: false,
        schedulesFolderId: null,
        incidencesFileId: null,
        schedulesFolderName: null,
        incidencesFileName: null
    },

    setBaseSchedules: (schedules) => set({ baseSchedules: schedules }),
    setIncidences: (incidences) => set({ incidences }),
    setActiveDate: (date) => set({ activeDate: date }),

    upsertIncidence: (newIncidence) => {
        set(state => {
            // Remove existing incidence for this class if any
            const filtered = state.incidences.filter(i =>
                !(i.date === newIncidence.date &&
                    i.program === newIncidence.program &&
                    i.start_time === newIncidence.start_time &&
                    i.instructor === newIncidence.instructor)
            );
            return { incidences: [...filtered, newIncidence] };
        });
    },

    removeIncidence: (target) => {
        set(state => ({
            incidences: state.incidences.filter(i =>
                !(i.date === target.date &&
                    i.program === target.program &&
                    i.start_time === target.start_time &&
                    i.instructor === target.instructor)
            )
        }));
    },

    getComputedSchedules: () => {
        const { baseSchedules, incidences } = get();

        // Merge: If an incidence exists for a schedule, use the incidence (which has extra fields)
        return baseSchedules.map(sch => {
            const match = incidences.find(inc =>
                inc.date === sch.date &&
                inc.program === sch.program &&
                inc.start_time === sch.start_time &&
                inc.instructor === sch.instructor
            );
            return match || sch;
        });
    },

    refreshMsConfig: async () => {
        const { data, error } = await supabase.functions.invoke('microsoft-auth', {
            body: { action: 'status' }
        });

        if (!error && data?.connected) {
            set({
                msConfig: {
                    isConnected: true,
                    schedulesFolderId: data.account.schedules_folder?.id,
                    incidencesFileId: data.account.incidences_file?.id,
                    schedulesFolderName: data.account.schedules_folder?.name,
                    incidencesFileName: data.account.incidences_file?.name
                }
            });
        }
    },

    publishDailyChanges: async () => {
        const state = get();
        const { msConfig, incidences, activeDate } = state;

        if (!msConfig.isConnected) {
            toast.error('Microsoft account not connected');
            return;
        }

        set({ isPublishing: true });

        try {
            // --- 1. Publish Incidences Log (Historical Append) ---
            if (msConfig.incidencesFileId && incidences.length > 0) {
                // Fetch Tables
                const { data: content, error: listError } = await supabase.functions.invoke('microsoft-graph', {
                    body: { action: 'list-content', fileId: msConfig.incidencesFileId }
                });

                if (listError) throw listError;

                const table = content.value.find((i: any) => i.type === 'table');
                if (!table) {
                    throw new Error('No table found in Incidences file. Please create a table in Excel.');
                }

                // Prepare rows based on DailyIncidence structure
                // Columns: Date, Shift, Branch, Start, End, Code, Instructor, Program, Mins, Units, Status, Substitute, Type, Subtype, Desc, Dept, Feedback
                const rows = incidences.map(inc => [
                    inc.date,
                    inc.shift,
                    inc.branch,
                    inc.start_time,
                    inc.end_time,
                    inc.code,
                    inc.instructor,
                    inc.program,
                    inc.minutes,
                    inc.units,
                    inc.status || '',
                    inc.substitute || '',
                    inc.type || '',
                    inc.subtype || '',
                    inc.description || '',
                    inc.department || '',
                    inc.feedback || ''
                ]);

                // Append
                const { error: appendError } = await supabase.functions.invoke('microsoft-graph', {
                    body: {
                        action: 'append-row',
                        fileId: msConfig.incidencesFileId,
                        tableId: table.id,
                        values: rows
                    }
                });

                if (appendError) throw appendError;
                toast.success(`Synced ${incidences.length} incidences to log`);
            }

            // --- 2. Publish Daily Schedule (Snapshot) ---
            if (msConfig.schedulesFolderId && activeDate) {
                // For now, publishing the MERGED view (computed schedules) to the daily sheet
                const computed = state.getComputedSchedules();

                // Parse activeDate which might be YYYY-MM-DD (init) or DD/MM/YYYY (from Excel)
                let year, month;
                if (activeDate.includes('/')) {
                    const parts = activeDate.split('/');
                    // DD/MM/YYYY
                    year = parts[2];
                    month = parts[1];
                } else {
                    const parts = activeDate.split('-');
                    // YYYY-MM-DD
                    year = parts[0];
                    month = parts[1];
                }

                const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
                const monthName = monthNames[parseInt(month) - 1];
                const yearMonth = `${year}_${month}`; // 2024_02
                const yearMonthHyphen = `${year}-${month}`; // 2024-02

                const { data: children, error: childrenError } = await supabase.functions.invoke('microsoft-graph', {
                    body: { action: 'list-children', folderId: msConfig.schedulesFolderId }
                });
                if (childrenError) throw childrenError;

                const monthlyFile = children.value.find((f: any) => {
                    const name = f.name.toLowerCase();
                    return name.endsWith('.xlsx') && (
                        name.includes(monthName.toLowerCase()) ||
                        name.includes(yearMonth) ||
                        name.includes(yearMonthHyphen)
                    );
                });

                if (!monthlyFile) {
                    throw new Error(`Could not find a schedule file for "${monthName}" or "${year}_${month}"`);
                }

                const sheetName = activeDate;
                let worksheetId = null;

                const { data: createData, error: createError } = await supabase.functions.invoke('microsoft-graph', {
                    body: { action: 'create-worksheet', fileId: monthlyFile.id, name: sheetName }
                });

                if (createError) {
                    const { data: sheetsContent } = await supabase.functions.invoke('microsoft-graph', {
                        body: { action: 'list-worksheets', fileId: monthlyFile.id }
                    });
                    const existingSheet = sheetsContent?.value?.find((s: any) => s.name === sheetName);
                    if (existingSheet) worksheetId = existingSheet.id;
                    else throw createError;
                } else {
                    worksheetId = createData.id;
                }

                if (!worksheetId) throw new Error("Could not target worksheet");

                const headers = ["Time Start", "Time End", "Program", "Instructor", "Room", "Status", "Comments"];
                const dataRows = computed.map(s => {
                    const inc = s as DailyIncidence;
                    return [
                        s.start_time,
                        s.end_time,
                        s.program,
                        s.instructor,
                        s.branch,
                        inc.status || '',         // From incidence if exists
                        inc.description || ''     // From incidence if exists
                    ];
                });

                const values = [headers, ...dataRows];

                const { error: writeError } = await supabase.functions.invoke('microsoft-graph', {
                    body: {
                        action: 'update-range',
                        fileId: monthlyFile.id,
                        sheetId: worksheetId,
                        values: values,
                        range: 'A1'
                    }
                });

                if (writeError) throw writeError;
                toast.success(`Published schedule for ${activeDate}`);
            }

        } catch (error: any) {
            console.error('Publish failed', error);
            toast.error(`Publish failed: ${error.message}`);
        } finally {
            set({ isPublishing: false });
        }
    }
}));
