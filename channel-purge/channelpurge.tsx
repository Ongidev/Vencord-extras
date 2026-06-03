/*
 * Vencord User Plugin: ChannelPurge
 *
 * Adds a 🗑 purge button to the channel header toolbar (left of Threads/Search).
 * Opens a dialog to configure and run a bulk message delete in the current channel.
 *
 * Install:
 *   Run install.ps1  (or copy this file to <Vencord>/src/userplugins/ and pnpm build + pnpm inject)
 *   Enable in Vencord Settings → Plugins → ChannelPurge
 */

import {
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalRoot,
    ModalSize,
    openModal,
} from "@utils/modal";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Button, ChannelStore, Forms, React, Select, Tooltip, UserStore } from "@webpack/common";

const AuthStore            = findByPropsLazy("getToken");
const SelectedChannelStore = findByPropsLazy("getCurrentlySelectedChannelId");

// ── Purge logic ───────────────────────────────────────────────────────────────

let activeAbort: AbortController | null = null;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function apiFetch(path: string, init?: RequestInit) {
    return fetch(`https://discord.com/api/v10${path}`, {
        ...init,
        headers: {
            Authorization: AuthStore.getToken(),
            "Content-Type": "application/json",
            ...((init?.headers as object) ?? {}),
        },
    });
}

async function fetchMessages(channelId: string, before?: string): Promise<any[]> {
    const qs = new URLSearchParams({ limit: "100" });
    if (before) qs.set("before", before);
    const res = await apiFetch(`/channels/${channelId}/messages?${qs}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function deleteOne(channelId: string, msgId: string): Promise<boolean> {
    const res = await apiFetch(`/channels/${channelId}/messages/${msgId}`, { method: "DELETE" });
    if (res.status === 429) {
        const d = await res.json().catch(() => ({}));
        await sleep(((d as any).retry_after ?? 1) * 1000);
        return deleteOne(channelId, msgId);
    }
    return res.status === 204 || res.status === 404;
}

async function runPurge(opts: {
    channelId: string;
    delayMs: number;
    cutoff: Date | null;
    selfOnly: boolean;
    onProgress(deleted: number, total: number): void;
    onDone(deleted: number, errors: number): void;
}) {
    const abort = new AbortController();
    activeAbort = abort;
    const { channelId, delayMs, cutoff, selfOnly, onProgress, onDone } = opts;
    const myId = UserStore.getCurrentUser()?.id;

    // ── collect matching messages ──
    const queue: any[] = [];
    let before: string | undefined;
    while (!abort.signal.aborted) {
        let page: any[];
        try { page = await fetchMessages(channelId, before); }
        catch { break; }
        if (!page.length) break;

        for (const m of page) {
            if (selfOnly && m.author.id !== myId) continue;
            if (cutoff && new Date(m.timestamp) < cutoff) continue;
            queue.push(m);
        }

        const oldest = page[page.length - 1];
        if (page.length < 100 || (cutoff && new Date(oldest.timestamp) < cutoff)) break;
        before = oldest.id;
        await sleep(250);
    }

    // ── delete collected messages ──
    let deleted = 0, errors = 0;
    for (const m of queue) {
        if (abort.signal.aborted) break;
        (await deleteOne(channelId, m.id)) ? deleted++ : errors++;
        onProgress(deleted, queue.length);
        await sleep(delayMs);
    }
    onDone(deleted, errors);
}

// ── Modal ─────────────────────────────────────────────────────────────────────

const RANGE_OPTIONS = [
    { label: "All messages",  value: "all" },
    { label: "Last 1 hour",   value: "1h"  },
    { label: "Last 24 hours", value: "24h" },
    { label: "Last 7 days",   value: "7d"  },
    { label: "Last 30 days",  value: "30d" },
];

function toCutoff(v: string): Date | null {
    if (v === "all") return null;
    const ms: Record<string, number> = {
        "1h":  3.6e6,
        "24h": 8.64e7,
        "7d":  6.048e8,
        "30d": 2.592e9,
    };
    return new Date(Date.now() - ms[v]);
}

function PurgeModal({ onClose, transitionState, channelId }: {
    onClose(): void;
    transitionState: any;
    channelId: string;
}) {
    const [range, setRange]       = React.useState("24h");
    const [delay, setDelay]       = React.useState("500");
    const [selfOnly, setSelfOnly] = React.useState(false);
    const [running, setRunning]   = React.useState(false);
    const [progress, setProgress] = React.useState<{ d: number; t: number; } | null>(null);
    const [done, setDone]         = React.useState<{ deleted: number; errors: number; } | null>(null);

    const ch = ChannelStore.getChannel(channelId);

    function start() {
        setRunning(true);
        setDone(null);
        setProgress({ d: 0, t: 0 });
        runPurge({
            channelId,
            delayMs: Math.max(100, parseInt(delay, 10) || 500),
            cutoff: toCutoff(range),
            selfOnly,
            onProgress: (d, t) => setProgress({ d, t }),
            onDone: (deleted, errors) => { setRunning(false); setDone({ deleted, errors }); },
        });
    }

    function stop() { activeAbort?.abort(); setRunning(false); }

    const inputStyle: React.CSSProperties = {
        background: "var(--input-background)",
        border: "1px solid var(--input-border)",
        borderRadius: "4px",
        color: "var(--text-normal)",
        padding: "6px 8px",
        width: "100%",
        fontSize: "14px",
        boxSizing: "border-box",
        marginTop: "6px",
        outline: "none",
    };

    return (
        <ModalRoot size={ModalSize.SMALL} transitionState={transitionState}>
            <ModalHeader>
                <span style={{ fontWeight: "bold", fontSize: "16px", flexGrow: 1 }}>
                    🗑 Purge #{ch?.name ?? channelId}
                </span>
                <ModalCloseButton onClick={onClose} />
            </ModalHeader>

            <ModalContent style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* Range */}
                <div>
                    <Forms.FormTitle>Delete messages from</Forms.FormTitle>
                    <Select
                        options={RANGE_OPTIONS}
                        select={setRange}
                        isSelected={v => v === range}
                        serialize={v => v}
                        isDisabled={running}
                    />
                </div>

                {/* Delay */}
                <div>
                    <Forms.FormTitle>Delay between deletions (ms)</Forms.FormTitle>
                    <input
                        type="number"
                        min={100}
                        value={delay}
                        onChange={e => setDelay(e.currentTarget.value)}
                        disabled={running}
                        style={inputStyle}
                    />
                    <Forms.FormText style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                        Recommended: 500 ms — lower values may trigger rate limits or flag your account.
                    </Forms.FormText>
                </div>

                {/* Self only */}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: running ? "default" : "pointer" }}>
                    <input
                        type="checkbox"
                        checked={selfOnly}
                        onChange={e => setSelfOnly(e.currentTarget.checked)}
                        disabled={running}
                    />
                    <span style={{ color: "var(--text-normal)", fontSize: "14px" }}>
                        Only delete my own messages
                    </span>
                </label>

                {/* Progress */}
                {progress && (
                    <div style={{
                        background: "var(--background-secondary)",
                        borderRadius: "4px",
                        padding: "10px",
                        fontSize: "13px",
                        color: "var(--text-normal)",
                    }}>
                        {done
                            ? `✅ Done — ${done.deleted} deleted${done.errors ? `, ${done.errors} error(s)` : ""}`
                            : `Deleting… ${progress.d} / ${progress.t || "?"}`
                        }
                    </div>
                )}
            </ModalContent>

            <ModalFooter style={{ gap: "8px" }}>
                {running
                    ? <Button color={Button.Colors.YELLOW} onClick={stop}>Stop</Button>
                    : <Button color={Button.Colors.RED} onClick={start} disabled={!!done}>
                        {done ? "Finished" : "Start Purge"}
                      </Button>
                }
                <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={onClose}>
                    Close
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}

// ── Header toolbar button ─────────────────────────────────────────────────────

function PurgeButton() {
    const channelId: string = SelectedChannelStore.getCurrentlySelectedChannelId?.() ?? "";
    if (!channelId) return null;

    return (
        <Tooltip text="Purge channel messages">
            {({ onMouseEnter, onMouseLeave }: any) => (
                <button
                    aria-label="Purge channel messages"
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onClick={() => openModal(p => <PurgeModal {...p} channelId={channelId} />)}
                    style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--interactive-normal)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "4px",
                        padding: "0 4px",
                        height: "24px",
                        fontSize: "18px",
                        lineHeight: 1,
                    }}
                >
                    🗑
                </button>
            )}
        </Tooltip>
    );
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "ChannelPurge",
    description: "Adds a 🗑 purge button to the channel header to bulk-delete messages.",
    authors: [{ name: "ongi", id: 1071360913849974814n }],

    patches: [
        {
            // Inject our button into the channel header toolbar array
            find: "toolbar:function",
            replacement: {
                match: /(?<=toolbar:function.{0,100}(\i)\.push.{0,100})\]/,
                replace: ",$self.renderToolbarButton()]",
            },
        },
    ],

    renderToolbarButton() {
        return <PurgeButton />;
    },
});
