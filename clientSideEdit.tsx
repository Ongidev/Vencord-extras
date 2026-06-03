/*
 * Vencord User Plugin: ClientSideEdit
 *
 * Right-click any message → "Edit locally ✎" to replace its displayed text.
 * Only you see the change. Edits are lost on reconnect/reload.
 *
 * Install:
 *   Copy this file to  <Vencord>/src/userplugins/clientSideEdit.tsx
 *   Then run: pnpm build  (or pnpm watch for dev)
 *   Enable the plugin in Vencord Settings → Plugins → ClientSideEdit
 */

import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
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
import { FluxDispatcher, Menu, React } from "@webpack/common";

// Persists local edits for this session: messageId → replacement text
const edits = new Map<string, string>();

// ── Modal component ──────────────────────────────────────────────────────────

interface EditModalProps {
    onClose: () => void;
    transitionState: any;
    message: any;
}

function EditModal({ onClose, transitionState, message }: EditModalProps) {
    const [text, setText] = React.useState<string>(
        edits.get(message.id) ?? message.content ?? ""
    );

    function dispatchUpdate(content: string) {
        FluxDispatcher.dispatch({
            type: "MESSAGE_UPDATE",
            message: {
                ...message,
                content,
                channel_id: message.channel_id,
            },
            log_edit: false,
        });
    }

    function apply() {
        if (text.trim() === "") {
            edits.delete(message.id);
            dispatchUpdate(message.content ?? "");
        } else {
            edits.set(message.id, text);
            dispatchUpdate(text);
        }
        onClose();
    }

    function reset() {
        edits.delete(message.id);
        dispatchUpdate(message.content ?? "");
        onClose();
    }

    const btnBase: React.CSSProperties = {
        border: "none",
        borderRadius: "3px",
        padding: "8px 16px",
        cursor: "pointer",
        fontWeight: "500",
        fontSize: "14px",
    };

    return (
        <ModalRoot size={ModalSize.MEDIUM} transitionState={transitionState}>
            <ModalHeader>
                <span style={{ fontWeight: "bold", fontSize: "16px", flexGrow: 1 }}>
                    Edit locally ✎
                </span>
                <ModalCloseButton onClick={onClose} />
            </ModalHeader>

            <ModalContent style={{ padding: "16px" }}>
                <p style={{
                    color: "var(--text-muted)",
                    fontSize: "12px",
                    marginBottom: "10px",
                    marginTop: "0",
                }}>
                    Only you see this change. It will be lost on reconnect or reload.
                </p>
                <textarea
                    autoFocus
                    value={text}
                    onChange={e => setText(e.currentTarget.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); apply(); }
                        if (e.key === "Escape") onClose();
                    }}
                    rows={5}
                    style={{
                        width: "100%",
                        resize: "vertical",
                        background: "var(--input-background)",
                        color: "var(--text-normal)",
                        border: "1px solid var(--input-border)",
                        borderRadius: "3px",
                        padding: "8px",
                        fontSize: "14px",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                    }}
                />
            </ModalContent>

            <ModalFooter style={{ gap: "8px" }}>
                <button
                    onClick={apply}
                    style={{ ...btnBase, background: "var(--brand-500)", color: "#fff" }}
                >
                    Apply
                </button>
                {edits.has(message.id) && (
                    <button
                        onClick={reset}
                        style={{ ...btnBase, background: "var(--button-danger-background)", color: "#fff" }}
                    >
                        Reset to original
                    </button>
                )}
                <button
                    onClick={onClose}
                    style={{ ...btnBase, background: "var(--button-secondary-background)", color: "var(--text-normal)" }}
                >
                    Cancel
                </button>
            </ModalFooter>
        </ModalRoot>
    );
}

// ── Context menu patch ────────────────────────────────────────────────────────

const patchMessageMenu: NavContextMenuPatchCallback = (children, props) => {
    const message = props?.message;
    if (!message) return;

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuItem
            id="client-side-edit"
            label={edits.has(message.id) ? "Edit locally ✎ (active)" : "Edit locally ✎"}
            action={() =>
                openModal(modalProps => (
                    <EditModal {...modalProps} message={message} />
                ))
            }
        />
    );
};

// ── Plugin definition ─────────────────────────────────────────────────────────

export default definePlugin({
    name: "ClientSideEdit",
    description: "Edit any message's displayed text locally — only you see the change.",
    authors: [{ name: "ongi", id: 1071360913849974814n }],

    start() {
        addContextMenuPatch("message", patchMessageMenu);
    },

    stop() {
        removeContextMenuPatch("message", patchMessageMenu);
        edits.clear();
    },
});
